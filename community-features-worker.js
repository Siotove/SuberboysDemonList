import { round } from "./js/score.js";
import { captureDailyRankSnapshot } from "./rank-history-quests-worker.js";

const ASSET_ORIGIN = "https://suberboys-assets.internal";
const NO_STORE = { "Cache-Control": "no-store" };
const ACCENTS = new Set(["#a855f7", "#6366f1", "#3b82f6", "#06b6d4", "#14b8a6", "#22c55e", "#eab308", "#f97316", "#ef4444", "#ec4899"]);
let schemaPromise = null;

const json = (value, status = 200, headers = {}) =>
    Response.json(value, { status, headers });
const normalise = value => typeof value === "string"
    ? value.trim().toLocaleLowerCase("en")
    : "";
const cleanText = (value, max) => typeof value === "string"
    ? value.normalize("NFKC").replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, max)
    : "";
const isoDay = date => new Date(date).toISOString().slice(0, 10);

export async function ensureCommunitySchema(env) {
    if (!schemaPromise) {
        schemaPromise = (async () => {
            await env.db.batch([
                // Bootstrap the existing rank-history/weekly-quest tables too. This
                // prevents a fresh install from failing just because the SQL migration
                // has not yet been run manually in the D1 Console.
                env.db.prepare(`CREATE TABLE IF NOT EXISTS rank_history_snapshots (
                    snapshot_date TEXT NOT NULL,
                    player_key TEXT NOT NULL,
                    player_name TEXT NOT NULL,
                    rank INTEGER NOT NULL CHECK (rank >= 1),
                    total_points REAL NOT NULL DEFAULT 0,
                    completed_count INTEGER NOT NULL DEFAULT 0,
                    verified_count INTEGER NOT NULL DEFAULT 0,
                    progressed_count INTEGER NOT NULL DEFAULT 0,
                    packs_count INTEGER NOT NULL DEFAULT 0,
                    PRIMARY KEY (snapshot_date, player_key)
                )`),
                env.db.prepare(`CREATE INDEX IF NOT EXISTS idx_rank_history_player_date
                    ON rank_history_snapshots (player_key, snapshot_date)`),
                env.db.prepare(`CREATE TABLE IF NOT EXISTS rank_history_snapshot_runs (
                    snapshot_date TEXT PRIMARY KEY,
                    player_count INTEGER NOT NULL DEFAULT 0,
                    created_at TEXT NOT NULL
                )`),
                env.db.prepare(`CREATE TABLE IF NOT EXISTS weekly_quest_baselines (
                    week_start TEXT NOT NULL,
                    player_key TEXT NOT NULL,
                    player_name TEXT NOT NULL,
                    baseline_date TEXT NOT NULL,
                    rank INTEGER NOT NULL,
                    total_points REAL NOT NULL DEFAULT 0,
                    completed_count INTEGER NOT NULL DEFAULT 0,
                    verified_count INTEGER NOT NULL DEFAULT 0,
                    progressed_count INTEGER NOT NULL DEFAULT 0,
                    packs_count INTEGER NOT NULL DEFAULT 0,
                    PRIMARY KEY (week_start, player_key)
                )`),
                env.db.prepare(`CREATE INDEX IF NOT EXISTS idx_weekly_quest_baselines_player
                    ON weekly_quest_baselines (player_key, week_start)`),
                env.db.prepare(`CREATE TABLE IF NOT EXISTS weekly_quest_completions (
                    week_start TEXT NOT NULL,
                    player_key TEXT NOT NULL,
                    quest_id TEXT NOT NULL,
                    completed_at TEXT NOT NULL,
                    PRIMARY KEY (week_start, player_key, quest_id)
                )`),
                env.db.prepare(`CREATE INDEX IF NOT EXISTS idx_weekly_quest_completions_player
                    ON weekly_quest_completions (player_key, week_start)`),
                env.db.prepare(`CREATE TABLE IF NOT EXISTS secret_achievement_unlocks (
                    player_key TEXT NOT NULL,
                    achievement_id TEXT NOT NULL,
                    unlocked_at TEXT NOT NULL,
                    PRIMARY KEY (player_key, achievement_id)
                )`),
                env.db.prepare(`CREATE INDEX IF NOT EXISTS idx_secret_achievement_player
                    ON secret_achievement_unlocks (player_key)`),
                env.db.prepare(`CREATE TABLE IF NOT EXISTS community_clans (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL UNIQUE COLLATE NOCASE,
                    tag TEXT NOT NULL UNIQUE COLLATE NOCASE,
                    description TEXT NOT NULL DEFAULT '',
                    accent_color TEXT NOT NULL DEFAULT '#a855f7',
                    owner_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    created_at TEXT NOT NULL DEFAULT (datetime('now')),
                    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
                )`),
                env.db.prepare(`CREATE TABLE IF NOT EXISTS community_clan_members (
                    clan_id TEXT NOT NULL REFERENCES community_clans(id) ON DELETE CASCADE,
                    user_id TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
                    role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner','officer','member')),
                    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','member')),
                    requested_at TEXT NOT NULL DEFAULT (datetime('now')),
                    joined_at TEXT,
                    PRIMARY KEY (clan_id, user_id)
                )`),
                env.db.prepare(`CREATE INDEX IF NOT EXISTS idx_community_clan_members_clan_status
                    ON community_clan_members (clan_id, status, role)`),
                env.db.prepare(`CREATE TABLE IF NOT EXISTS community_activity (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    event_key TEXT NOT NULL UNIQUE,
                    event_type TEXT NOT NULL,
                    actor_user_id TEXT,
                    actor_name TEXT NOT NULL,
                    message TEXT NOT NULL,
                    metadata_json TEXT,
                    created_at TEXT NOT NULL DEFAULT (datetime('now'))
                )`),
                env.db.prepare(`CREATE INDEX IF NOT EXISTS idx_community_activity_created
                    ON community_activity (created_at DESC, id DESC)`),
                env.db.prepare(`CREATE TABLE IF NOT EXISTS community_hall_snapshots (
                    snapshot_date TEXT NOT NULL,
                    player_key TEXT NOT NULL,
                    player_name TEXT NOT NULL,
                    rank INTEGER NOT NULL,
                    total_points REAL NOT NULL DEFAULT 0,
                    completed_count INTEGER NOT NULL DEFAULT 0,
                    verified_count INTEGER NOT NULL DEFAULT 0,
                    progressed_count INTEGER NOT NULL DEFAULT 0,
                    packs_count INTEGER NOT NULL DEFAULT 0,
                    PRIMARY KEY (snapshot_date, player_key)
                )`),
                env.db.prepare(`CREATE INDEX IF NOT EXISTS idx_community_hall_rank_date
                    ON community_hall_snapshots (rank, snapshot_date DESC)`),
                env.db.prepare(`CREATE TABLE IF NOT EXISTS community_hall_snapshot_runs (
                    snapshot_date TEXT PRIMARY KEY,
                    player_count INTEGER NOT NULL DEFAULT 0,
                    created_at TEXT NOT NULL DEFAULT (datetime('now'))
                )`),
                env.db.prepare(`CREATE TABLE IF NOT EXISTS community_player_records (
                    player_key TEXT PRIMARY KEY,
                    player_name TEXT NOT NULL,
                    best_rank INTEGER NOT NULL,
                    best_rank_date TEXT NOT NULL,
                    best_points REAL NOT NULL DEFAULT 0,
                    best_points_date TEXT NOT NULL,
                    first_seen TEXT NOT NULL,
                    last_seen TEXT NOT NULL
                )`)
            ]);
        })().catch(error => {
            schemaPromise = null;
            throw error;
        });
    }
    await schemaPromise;
}

async function getAssetJson(env, path) {
    const response = await env.ASSETS.fetch(new Request(new URL(path, ASSET_ORIGIN)));
    if (!response.ok) throw new Error(`Could not read published asset ${path} (${response.status}).`);
    return response.json();
}

async function batchInChunks(db, statements, size = 50) {
    for (let index = 0; index < statements.length; index += size) {
        await db.batch(statements.slice(index, index + size));
    }
}

async function logActivity(env, { eventKey, type, actorUserId = null, actorName, message, metadata = null }) {
    await env.db.prepare(`
        INSERT OR IGNORE INTO community_activity
            (event_key, event_type, actor_user_id, actor_name, message, metadata_json)
        VALUES (?, ?, ?, ?, ?, ?)
    `).bind(
        eventKey || crypto.randomUUID(), type, actorUserId, cleanText(actorName || "Community", 80),
        cleanText(message, 280), metadata ? JSON.stringify(metadata) : null
    ).run();
}

/**
 * Keep the all-time Hall of Fame separate from the rolling 730-day rank-history table.
 * This copies a compact daily top-ten snapshot and maintains each player's best-ever
 * rank/points. It is idempotent for a UTC date and may be called by a cron or page view.
 */
export async function captureCommunitySnapshot(env, now = new Date(), ensureRank = true) {
    await ensureCommunitySchema(env);
    let snapshotDate = isoDay(now);
    if (ensureRank) {
        const existingRankSnapshot = await env.db.prepare(
            "SELECT snapshot_date FROM rank_history_snapshot_runs WHERE snapshot_date = ?"
        ).bind(snapshotDate).first();
        if (!existingRankSnapshot) {
            const rankSnapshot = await captureDailyRankSnapshot(env, now);
            snapshotDate = rankSnapshot.snapshotDate || snapshotDate;
        }
    }

    const already = await env.db.prepare(
        "SELECT snapshot_date FROM community_hall_snapshot_runs WHERE snapshot_date = ?"
    ).bind(snapshotDate).first();
    if (already) return { snapshotDate, alreadyCaptured: true };

    const currentResult = await env.db.prepare(`
        SELECT snapshot_date, player_key, player_name, rank, total_points,
               completed_count, verified_count, progressed_count, packs_count
        FROM rank_history_snapshots
        WHERE snapshot_date = ?
        ORDER BY rank ASC
    `).bind(snapshotDate).all();
    const currentRows = currentResult.results || [];
    if (!currentRows.length) return { snapshotDate, alreadyCaptured: false, playerCount: 0 };

    const previousDateResult = await env.db.prepare(`
        SELECT MAX(snapshot_date) AS snapshot_date
        FROM community_hall_snapshot_runs
        WHERE snapshot_date < ?
    `).bind(snapshotDate).first();
    const previousDate = previousDateResult?.snapshot_date || null;
    let previousRows = [];
    if (previousDate) {
        const result = await env.db.prepare(`
            SELECT player_key, player_name, rank, total_points,
                   completed_count, verified_count, progressed_count, packs_count
            FROM rank_history_snapshots
            WHERE snapshot_date = ?
        `).bind(previousDate).all();
        previousRows = result.results || [];
    }
    const previousByKey = new Map(previousRows.map(row => [row.player_key, row]));

    const topStatements = currentRows.filter(row => Number(row.rank) <= 10).map(row => env.db.prepare(`
        INSERT OR IGNORE INTO community_hall_snapshots
            (snapshot_date, player_key, player_name, rank, total_points,
             completed_count, verified_count, progressed_count, packs_count)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
        snapshotDate, row.player_key, row.player_name, Number(row.rank), Number(row.total_points) || 0,
        Number(row.completed_count) || 0, Number(row.verified_count) || 0,
        Number(row.progressed_count) || 0, Number(row.packs_count) || 0
    ));
    await batchInChunks(env.db, topStatements);

    const peakStatements = currentRows.map(row => env.db.prepare(`
        INSERT INTO community_player_records
            (player_key, player_name, best_rank, best_rank_date, best_points,
             best_points_date, first_seen, last_seen)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(player_key) DO UPDATE SET
            player_name = excluded.player_name,
            best_rank = CASE
                WHEN excluded.best_rank < community_player_records.best_rank THEN excluded.best_rank
                ELSE community_player_records.best_rank END,
            best_rank_date = CASE
                WHEN excluded.best_rank < community_player_records.best_rank THEN excluded.best_rank_date
                ELSE community_player_records.best_rank_date END,
            best_points = CASE
                WHEN excluded.best_points > community_player_records.best_points THEN excluded.best_points
                ELSE community_player_records.best_points END,
            best_points_date = CASE
                WHEN excluded.best_points > community_player_records.best_points THEN excluded.best_points_date
                ELSE community_player_records.best_points_date END,
            first_seen = CASE
                WHEN excluded.first_seen < community_player_records.first_seen THEN excluded.first_seen
                ELSE community_player_records.first_seen END,
            last_seen = excluded.last_seen
    `).bind(
        row.player_key, row.player_name, Number(row.rank), snapshotDate,
        Number(row.total_points) || 0, snapshotDate, snapshotDate, snapshotDate
    ));
    await batchInChunks(env.db, peakStatements);

    const events = [];
    const previousLeader = previousRows.find(row => Number(row.rank) === 1);
    const currentLeader = currentRows.find(row => Number(row.rank) === 1);
    if (currentLeader && (!previousLeader || previousLeader.player_key !== currentLeader.player_key)) {
        events.push({
            eventKey: `daily-leader:${snapshotDate}`,
            type: "number_one",
            actorName: currentLeader.player_name,
            message: previousLeader
                ? `${currentLeader.player_name} took the #1 spot with ${round(Number(currentLeader.total_points) || 0)} points.`
                : `First Hall of Fame snapshot: ${currentLeader.player_name} led the list with ${round(Number(currentLeader.total_points) || 0)} points.`,
            metadata: { snapshotDate, rank: 1 }
        });
    }

    if (previousByKey.size) {
        for (const row of currentRows) {
            const old = previousByKey.get(row.player_key);
            if (!old) continue;
            const rankDelta = Number(old.rank) - Number(row.rank);
            const pointDelta = (Number(row.total_points) || 0) - (Number(old.total_points) || 0);
            const completeDelta = (Number(row.completed_count) || 0) - (Number(old.completed_count) || 0);
            const verifyDelta = (Number(row.verified_count) || 0) - (Number(old.verified_count) || 0);
            const progressDelta = (Number(row.progressed_count) || 0) - (Number(old.progressed_count) || 0);
            if (rankDelta !== 0) {
                const climbed = rankDelta > 0;
                events.push({
                    eventKey: `rank:${snapshotDate}:${row.player_key}`,
                    type: climbed ? "rank_up" : "rank_down",
                    actorName: row.player_name,
                    message: climbed
                        ? `${row.player_name} climbed ${rankDelta} place${rankDelta === 1 ? "" : "s"} to #${row.rank}.`
                        : `${row.player_name} moved down ${Math.abs(rankDelta)} place${Math.abs(rankDelta) === 1 ? "" : "s"} to #${row.rank}.`,
                    metadata: { snapshotDate, rank: Number(row.rank), rankDelta }
                });
            }
            if (pointDelta >= 0.001) {
                events.push({
                    eventKey: `points:${snapshotDate}:${row.player_key}`,
                    type: "points_gain",
                    actorName: row.player_name,
                    message: `${row.player_name} gained ${round(pointDelta)} leaderboard points.`,
                    metadata: { snapshotDate, points: round(pointDelta) }
                });
            }
            if (completeDelta > 0) {
                events.push({
                    eventKey: `completions:${snapshotDate}:${row.player_key}`,
                    type: "completion_gain",
                    actorName: row.player_name,
                    message: `${row.player_name} added ${completeDelta} completed level${completeDelta === 1 ? "" : "s"}.`,
                    metadata: { snapshotDate, count: completeDelta }
                });
            }
            if (verifyDelta > 0) {
                events.push({
                    eventKey: `verifications:${snapshotDate}:${row.player_key}`,
                    type: "verification_gain",
                    actorName: row.player_name,
                    message: `${row.player_name} added ${verifyDelta} verification${verifyDelta === 1 ? "" : "s"}.`,
                    metadata: { snapshotDate, count: verifyDelta }
                });
            }
            if (progressDelta > 0) {
                events.push({
                    eventKey: `progress:${snapshotDate}:${row.player_key}`,
                    type: "progress_gain",
                    actorName: row.player_name,
                    message: `${row.player_name} added ${progressDelta} progress record${progressDelta === 1 ? "" : "s"}.`,
                    metadata: { snapshotDate, count: progressDelta }
                });
            }
        }
    }
    // Keep the shared public activity feed readable when a daily diff is large.
    const eventPriority = event => event.type === "number_one" ? 0 : event.type === "rank_up" ? 1 : event.type === "completion_gain" ? 2 : event.type === "verification_gain" ? 3 : 4;
    events.sort((a, b) => eventPriority(a) - eventPriority(b));
    const eventStatements = events.slice(0, 80).map(event => env.db.prepare(`
        INSERT OR IGNORE INTO community_activity
            (event_key, event_type, actor_user_id, actor_name, message, metadata_json)
        VALUES (?, ?, NULL, ?, ?, ?)
    `).bind(event.eventKey, event.type, cleanText(event.actorName, 80), cleanText(event.message, 280), JSON.stringify(event.metadata)));
    await batchInChunks(env.db, eventStatements);

    await env.db.prepare(`
        INSERT OR IGNORE INTO community_hall_snapshot_runs (snapshot_date, player_count)
        VALUES (?, ?)
    `).bind(snapshotDate, currentRows.length).run();
    return { snapshotDate, alreadyCaptured: false, playerCount: currentRows.length };
}

async function getCurrentSnapshotRows(env, limit = 1000) {
    const latest = await env.db.prepare(
        "SELECT MAX(snapshot_date) AS snapshot_date FROM rank_history_snapshot_runs"
    ).first();
    if (!latest?.snapshot_date) return [];
    const result = await env.db.prepare(`
        SELECT snapshot_date, player_key, player_name, rank, total_points,
               completed_count, verified_count, progressed_count, packs_count
        FROM rank_history_snapshots WHERE snapshot_date = ? ORDER BY rank ASC LIMIT ?
    `).bind(latest.snapshot_date, limit).all();
    return result.results || [];
}

async function calculatePlayerDetails(env, names) {
    const requested = new Map(names.map(name => [normalise(name), { name, verified: [], completed: [], progressed: [], completedPaths: new Set() }]));
    const files = await getAssetJson(env, "/data/_list.json");
    if (!Array.isArray(files)) throw new Error("The published level list is invalid.");
    for (let index = 0; index < files.length; index++) {
        const file = files[index];
        if (typeof file !== "string" || !/^[a-zA-Z0-9_-]{1,80}$/.test(file)) continue;
        const level = await getAssetJson(env, `/data/${encodeURIComponent(file)}.json`);
        if (!level || typeof level !== "object") continue;
        const rank = index + 1;
        const required = Number.isFinite(Number(level.percentToQualify)) ? Number(level.percentToQualify) : 100;
        const levelName = cleanText(level.name || file, 120);
        const verifierKey = normalise(level.verifier);
        if (verifierKey && requested.has(verifierKey)) {
            const player = requested.get(verifierKey);
            player.verified.push({ file, name: levelName, rank, link: "" });
            player.completedPaths.add(file);
        }
        if (!Array.isArray(level.records)) continue;
        for (const record of level.records) {
            if (!record || typeof record.user !== "string" || !Number.isFinite(Number(record.percent))) continue;
            const key = normalise(record.user);
            if (!requested.has(key)) continue;
            const percent = Number(record.percent);
            const entry = { file, name: levelName, rank, percent, link: typeof record.link === "string" ? record.link : "" };
            const player = requested.get(key);
            if (percent === 100) {
                player.completed.push(entry);
                player.completedPaths.add(file);
            } else {
                player.progressed.push(entry);
            }
        }
    }
    // Pack totals are taken from the leaderboard snapshot, where pack bonuses
    // and the site's canonical qualifying rules are already calculated.
    return requested;
}

async function clansList(env, request, currentUser) {
    await captureCommunitySnapshot(env);
    const result = await env.db.prepare(`
        WITH latest AS (
            SELECT s.* FROM rank_history_snapshots s
            WHERE s.snapshot_date = (SELECT MAX(snapshot_date) FROM rank_history_snapshot_runs)
        )
        SELECT c.id, c.name, c.tag, c.description, c.accent_color, c.created_at,
               COUNT(m.user_id) AS member_count,
               ROUND(COALESCE(SUM(latest.total_points), 0), 3) AS total_points
        FROM community_clans c
        LEFT JOIN community_clan_members m ON m.clan_id = c.id AND m.status = 'member'
        LEFT JOIN leaderboard_profiles lp ON lp.user_id = m.user_id
        LEFT JOIN latest ON latest.player_key = LOWER(lp.leaderboard_name)
        GROUP BY c.id
        ORDER BY total_points DESC, member_count DESC, c.name COLLATE NOCASE
        LIMIT 100
    `).all();
    const user = await currentUser(request, env.db);
    let myMembership = null;
    if (user) {
        myMembership = await env.db.prepare(`
            SELECT m.clan_id, m.role, m.status, c.name AS clan_name, c.tag AS clan_tag
            FROM community_clan_members m JOIN community_clans c ON c.id = m.clan_id
            WHERE m.user_id = ?
        `).bind(user.id).first();
    }
    return json({ clans: result.results || [], myMembership: myMembership || null }, 200, NO_STORE);
}

async function clanDetail(env, request, currentUser, url) {
    await captureCommunitySnapshot(env);
    const clanId = cleanText(url.searchParams.get("id"), 80);
    if (!clanId) return json({ error: "Choose a clan." }, 400, NO_STORE);
    const clan = await env.db.prepare(`
        WITH latest AS (
            SELECT s.* FROM rank_history_snapshots s
            WHERE s.snapshot_date = (SELECT MAX(snapshot_date) FROM rank_history_snapshot_runs)
        )
        SELECT c.id, c.name, c.tag, c.description, c.accent_color, c.created_at,
               COUNT(m.user_id) AS member_count,
               ROUND(COALESCE(SUM(latest.total_points), 0), 3) AS total_points
        FROM community_clans c
        LEFT JOIN community_clan_members m ON m.clan_id = c.id AND m.status = 'member'
        LEFT JOIN leaderboard_profiles lp ON lp.user_id = m.user_id
        LEFT JOIN latest ON latest.player_key = LOWER(lp.leaderboard_name)
        WHERE c.id = ? GROUP BY c.id
    `).bind(clanId).first();
    if (!clan) return json({ error: "Clan not found." }, 404, NO_STORE);
    const memberResult = await env.db.prepare(`
        WITH latest AS (
            SELECT s.* FROM rank_history_snapshots s
            WHERE s.snapshot_date = (SELECT MAX(snapshot_date) FROM rank_history_snapshot_runs)
        )
        SELECT u.username, lp.leaderboard_name, m.role, m.joined_at,
               COALESCE(latest.rank, 0) AS rank,
               COALESCE(latest.total_points, 0) AS total_points
        FROM community_clan_members m
        JOIN users u ON u.id = m.user_id
        LEFT JOIN leaderboard_profiles lp ON lp.user_id = u.id
        LEFT JOIN latest ON latest.player_key = LOWER(lp.leaderboard_name)
        WHERE m.clan_id = ? AND m.status = 'member'
        ORDER BY CASE m.role WHEN 'owner' THEN 0 WHEN 'officer' THEN 1 ELSE 2 END,
                 latest.total_points DESC, u.username COLLATE NOCASE
    `).bind(clanId).all();
    const user = await currentUser(request, env.db);
    const ownMembership = user ? await env.db.prepare(`
        SELECT role, status FROM community_clan_members WHERE clan_id = ? AND user_id = ?
    `).bind(clanId, user.id).first() : null;
    return json({ clan, members: memberResult.results || [], ownMembership: ownMembership || null }, 200, NO_STORE);
}

async function getMyClan(env, request, currentUser) {
    const user = await currentUser(request, env.db);
    if (!user) return json({ error: "Log in to manage a clan." }, 401, NO_STORE);
    const membership = await env.db.prepare(`
        SELECT m.clan_id, m.role, m.status, m.requested_at, m.joined_at,
               c.name AS clan_name, c.tag AS clan_tag, c.description, c.accent_color, c.owner_user_id
        FROM community_clan_members m JOIN community_clans c ON c.id = m.clan_id
        WHERE m.user_id = ?
    `).bind(user.id).first();
    if (!membership) return json({ membership: null, members: [], requests: [] }, 200, NO_STORE);
    let members = [];
    let requests = [];
    if (membership.status === "member") {
        const memberResult = await env.db.prepare(`
            SELECT u.id AS user_id, u.username, lp.leaderboard_name, m.role, m.status, m.joined_at
            FROM community_clan_members m JOIN users u ON u.id = m.user_id
            LEFT JOIN leaderboard_profiles lp ON lp.user_id = u.id
            WHERE m.clan_id = ? AND m.status = 'member'
            ORDER BY CASE m.role WHEN 'owner' THEN 0 WHEN 'officer' THEN 1 ELSE 2 END, u.username COLLATE NOCASE
        `).bind(membership.clan_id).all();
        members = memberResult.results || [];
        if (membership.role === "owner" || membership.role === "officer") {
            const requestResult = await env.db.prepare(`
                SELECT u.id AS user_id, u.username, lp.leaderboard_name, m.requested_at
                FROM community_clan_members m JOIN users u ON u.id = m.user_id
                LEFT JOIN leaderboard_profiles lp ON lp.user_id = u.id
                WHERE m.clan_id = ? AND m.status = 'pending'
                ORDER BY m.requested_at ASC
            `).bind(membership.clan_id).all();
            requests = requestResult.results || [];
        }
    }
    return json({ membership, members, requests }, 200, NO_STORE);
}

async function createClan(env, request, currentUser) {
    const user = await currentUser(request, env.db);
    if (!user) return json({ error: "Log in before creating a clan." }, 401, NO_STORE);
    const linked = await env.db.prepare("SELECT leaderboard_name FROM leaderboard_profiles WHERE user_id = ?").bind(user.id).first();
    if (!linked?.leaderboard_name) return json({ error: "Link your leaderboard identity on the Profile page before creating a clan." }, 409, NO_STORE);
    const existing = await env.db.prepare("SELECT clan_id FROM community_clan_members WHERE user_id = ?").bind(user.id).first();
    if (existing) return json({ error: "Leave your current clan or cancel your pending request first." }, 409, NO_STORE);
    let body;
    try { body = await request.json(); } catch { return json({ error: "Invalid JSON body." }, 400, NO_STORE); }
    const name = cleanText(body?.name, 32);
    const tag = cleanText(body?.tag, 6).toUpperCase();
    const description = cleanText(body?.description, 240);
    const accent = ACCENTS.has(body?.accentColor) ? body.accentColor : "#a855f7";
    if (name.length < 3) return json({ error: "Clan name must be at least 3 characters." }, 400, NO_STORE);
    if (!/^[A-Z0-9]{2,6}$/.test(tag)) return json({ error: "Clan tag must be 2–6 letters or numbers." }, 400, NO_STORE);
    const duplicate = await env.db.prepare("SELECT id FROM community_clans WHERE name = ? COLLATE NOCASE OR tag = ? COLLATE NOCASE").bind(name, tag).first();
    if (duplicate) return json({ error: "That clan name or tag is already used." }, 409, NO_STORE);
    const id = crypto.randomUUID();
    try {
        await env.db.batch([
            env.db.prepare(`INSERT INTO community_clans (id, name, tag, description, accent_color, owner_user_id) VALUES (?, ?, ?, ?, ?, ?)`).bind(id, name, tag, description, accent, user.id),
            env.db.prepare(`INSERT INTO community_clan_members (clan_id, user_id, role, status, joined_at) VALUES (?, ?, 'owner', 'member', datetime('now'))`).bind(id, user.id),
            env.db.prepare(`INSERT OR IGNORE INTO community_activity (event_key, event_type, actor_user_id, actor_name, message, metadata_json) VALUES (?, 'clan_created', ?, ?, ?, ?)`).bind(`clan-created:${id}`, user.id, user.username, `${user.username} created clan [${tag}] ${name}.`, JSON.stringify({ clanId: id, tag }))
        ]);
    } catch (error) {
        if (/unique constraint/i.test(String(error?.message || ""))) return json({ error: "That clan name/tag is taken, or your account already belongs to a clan." }, 409, NO_STORE);
        throw error;
    }
    return json({ success: true, clan: { id, name, tag, description, accent_color: accent } }, 201, NO_STORE);
}

async function requestToJoinClan(env, request, currentUser) {
    const user = await currentUser(request, env.db);
    if (!user) return json({ error: "Log in to request to join a clan." }, 401, NO_STORE);
    const linked = await env.db.prepare("SELECT leaderboard_name FROM leaderboard_profiles WHERE user_id = ?").bind(user.id).first();
    if (!linked?.leaderboard_name) return json({ error: "Link your leaderboard identity on the Profile page first." }, 409, NO_STORE);
    let body;
    try { body = await request.json(); } catch { return json({ error: "Invalid JSON body." }, 400, NO_STORE); }
    const clanId = cleanText(body?.clanId, 80);
    if (!clanId) return json({ error: "Choose a clan." }, 400, NO_STORE);
    const clan = await env.db.prepare("SELECT id, name, tag FROM community_clans WHERE id = ?").bind(clanId).first();
    if (!clan) return json({ error: "Clan not found." }, 404, NO_STORE);
    const existing = await env.db.prepare("SELECT clan_id, status FROM community_clan_members WHERE user_id = ?").bind(user.id).first();
    if (existing) return json({ error: existing.clan_id === clanId ? "You've already joined or requested this clan." : "You can only belong to or request one clan at a time." }, 409, NO_STORE);
    try {
        await env.db.batch([
            env.db.prepare(`INSERT INTO community_clan_members (clan_id, user_id, role, status) VALUES (?, ?, 'member', 'pending')`).bind(clanId, user.id),
            env.db.prepare(`INSERT OR IGNORE INTO community_activity (event_key, event_type, actor_user_id, actor_name, message, metadata_json) VALUES (?, 'clan_join_request', ?, ?, ?, ?)`).bind(`clan-join-request:${clanId}:${user.id}`, user.id, user.username, `${user.username} requested to join [${clan.tag}] ${clan.name}.`, JSON.stringify({ clanId }))
        ]);
    } catch (error) {
        if (/unique constraint/i.test(String(error?.message || ""))) return json({ error: "You already belong to or have requested a clan." }, 409, NO_STORE);
        throw error;
    }
    return json({ success: true, message: "Join request sent to the clan's leaders." }, 201, NO_STORE);
}

async function manageClanRequest(env, request, currentUser) {
    const user = await currentUser(request, env.db);
    if (!user) return json({ error: "Log in to manage clan requests." }, 401, NO_STORE);
    let body;
    try { body = await request.json(); } catch { return json({ error: "Invalid JSON body." }, 400, NO_STORE); }
    const targetId = cleanText(body?.userId, 128);
    const action = body?.action;
    if (!targetId || !["approve", "reject"].includes(action)) return json({ error: "Choose a valid request and action." }, 400, NO_STORE);
    const myRole = await env.db.prepare(`SELECT clan_id, role, status FROM community_clan_members WHERE user_id = ?`).bind(user.id).first();
    if (!myRole || myRole.status !== "member" || !["owner", "officer"].includes(myRole.role)) return json({ error: "Only clan leaders and officers can manage requests." }, 403, NO_STORE);
    const target = await env.db.prepare(`SELECT u.username, m.status FROM community_clan_members m JOIN users u ON u.id = m.user_id WHERE m.clan_id = ? AND m.user_id = ?`).bind(myRole.clan_id, targetId).first();
    if (!target || target.status !== "pending") return json({ error: "That request is no longer pending." }, 404, NO_STORE);
    if (action === "approve") {
        await env.db.prepare(`UPDATE community_clan_members SET status = 'member', role = 'member', joined_at = datetime('now') WHERE clan_id = ? AND user_id = ?`).bind(myRole.clan_id, targetId).run();
        await logActivity(env, { eventKey: `clan-approved:${myRole.clan_id}:${targetId}`, type: "clan_member_joined", actorUserId: user.id, actorName: target.username, message: `${target.username} joined a clan.` });
    } else {
        await env.db.prepare("DELETE FROM community_clan_members WHERE clan_id = ? AND user_id = ? AND status = 'pending'").bind(myRole.clan_id, targetId).run();
    }
    return json({ success: true, action }, 200, NO_STORE);
}

async function leaveClan(env, request, currentUser) {
    const user = await currentUser(request, env.db);
    if (!user) return json({ error: "Log in first." }, 401, NO_STORE);
    const membership = await env.db.prepare(`SELECT m.clan_id, m.role, m.status, c.name, c.tag FROM community_clan_members m JOIN community_clans c ON c.id = m.clan_id WHERE m.user_id = ?`).bind(user.id).first();
    if (!membership) return json({ error: "You aren't in a clan or waiting on a request." }, 404, NO_STORE);
    if (membership.role === "owner" && membership.status === "member") return json({ error: "The clan owner must disband the clan or transfer leadership before leaving." }, 409, NO_STORE);
    await env.db.prepare("DELETE FROM community_clan_members WHERE user_id = ?").bind(user.id).run();
    await logActivity(env, { eventKey: `clan-left:${membership.clan_id}:${user.id}:${Date.now()}`, type: "clan_member_left", actorUserId: user.id, actorName: user.username, message: `${user.username} left [${membership.tag}] ${membership.name}.` });
    return json({ success: true }, 200, NO_STORE);
}

async function disbandClan(env, request, currentUser) {
    const user = await currentUser(request, env.db);
    if (!user) return json({ error: "Log in first." }, 401, NO_STORE);
    const membership = await env.db.prepare(`SELECT m.clan_id, m.role, m.status, c.name, c.tag FROM community_clan_members m JOIN community_clans c ON c.id = m.clan_id WHERE m.user_id = ?`).bind(user.id).first();
    if (!membership || membership.status !== "member" || membership.role !== "owner") return json({ error: "Only the clan owner can disband the clan." }, 403, NO_STORE);
    await logActivity(env, { eventKey: `clan-disbanded:${membership.clan_id}`, type: "clan_disbanded", actorUserId: user.id, actorName: user.username, message: `${user.username} disbanded [${membership.tag}] ${membership.name}.` });
    await env.db.prepare("DELETE FROM community_clans WHERE id = ?").bind(membership.clan_id).run();
    return json({ success: true }, 200, NO_STORE);
}

async function updateClan(env, request, currentUser) {
    const user = await currentUser(request, env.db);
    if (!user) return json({ error: "Log in first." }, 401, NO_STORE);
    const membership = await env.db.prepare(`SELECT m.clan_id, m.role, m.status FROM community_clan_members m WHERE m.user_id = ?`).bind(user.id).first();
    if (!membership || membership.status !== "member" || membership.role !== "owner") return json({ error: "Only the clan owner can edit clan details." }, 403, NO_STORE);
    let body;
    try { body = await request.json(); } catch { return json({ error: "Invalid JSON body." }, 400, NO_STORE); }
    const name = cleanText(body?.name, 32);
    const tag = cleanText(body?.tag, 6).toUpperCase();
    const description = cleanText(body?.description, 240);
    const accent = ACCENTS.has(body?.accentColor) ? body.accentColor : "#a855f7";
    if (name.length < 3 || !/^[A-Z0-9]{2,6}$/.test(tag)) return json({ error: "Use a clan name of at least 3 characters and a tag of 2–6 letters/numbers." }, 400, NO_STORE);
    const duplicate = await env.db.prepare("SELECT id FROM community_clans WHERE (name = ? COLLATE NOCASE OR tag = ? COLLATE NOCASE) AND id <> ?").bind(name, tag, membership.clan_id).first();
    if (duplicate) return json({ error: "That clan name or tag is already used." }, 409, NO_STORE);
    await env.db.prepare(`UPDATE community_clans SET name = ?, tag = ?, description = ?, accent_color = ?, updated_at = datetime('now') WHERE id = ?`).bind(name, tag, description, accent, membership.clan_id).run();
    await logActivity(env, { eventKey: `clan-updated:${membership.clan_id}:${Date.now()}`, type: "clan_updated", actorUserId: user.id, actorName: user.username, message: `${user.username} updated clan [${tag}] ${name}.` });
    return json({ success: true }, 200, NO_STORE);
}

async function removeClanMember(env, request, currentUser) {
    const user = await currentUser(request, env.db);
    if (!user) return json({ error: "Log in first." }, 401, NO_STORE);
    let body;
    try { body = await request.json(); } catch { return json({ error: "Invalid JSON body." }, 400, NO_STORE); }
    const targetId = cleanText(body?.userId, 128);
    if (!targetId || targetId === user.id) return json({ error: "Choose another clan member." }, 400, NO_STORE);
    const own = await env.db.prepare("SELECT clan_id, role, status FROM community_clan_members WHERE user_id = ?").bind(user.id).first();
    if (!own || own.status !== "member" || !["owner", "officer"].includes(own.role)) return json({ error: "Only clan leaders and officers can remove members." }, 403, NO_STORE);
    const target = await env.db.prepare("SELECT user_id, role, status FROM community_clan_members WHERE clan_id = ? AND user_id = ?").bind(own.clan_id, targetId).first();
    if (!target || target.status !== "member" || target.role === "owner" || (own.role === "officer" && target.role !== "member")) return json({ error: "You cannot remove that member." }, 403, NO_STORE);
    const nameRow = await env.db.prepare("SELECT username FROM users WHERE id = ?").bind(targetId).first();
    await env.db.prepare("DELETE FROM community_clan_members WHERE clan_id = ? AND user_id = ?").bind(own.clan_id, targetId).run();
    await logActivity(env, { eventKey: `clan-member-removed:${own.clan_id}:${targetId}:${Date.now()}`, type: "clan_member_left", actorUserId: user.id, actorName: nameRow?.username || "A member", message: `${nameRow?.username || "A member"} left their clan.` });
    return json({ success: true }, 200, NO_STORE);
}

async function updateMemberRole(env, request, currentUser) {
    const user = await currentUser(request, env.db);
    if (!user) return json({ error: "Log in first." }, 401, NO_STORE);
    let body;
    try { body = await request.json(); } catch { return json({ error: "Invalid JSON body." }, 400, NO_STORE); }
    const targetId = cleanText(body?.userId, 128);
    const role = body?.role;
    if (!targetId || !["officer", "member"].includes(role)) return json({ error: "Choose a valid member and role." }, 400, NO_STORE);
    const own = await env.db.prepare("SELECT clan_id, role, status FROM community_clan_members WHERE user_id = ?").bind(user.id).first();
    if (!own || own.status !== "member" || own.role !== "owner") return json({ error: "Only the clan owner can change roles." }, 403, NO_STORE);
    const target = await env.db.prepare("SELECT user_id, role, status FROM community_clan_members WHERE clan_id = ? AND user_id = ?").bind(own.clan_id, targetId).first();
    if (!target || target.status !== "member" || target.role === "owner") return json({ error: "Choose a current clan member other than the owner." }, 404, NO_STORE);
    await env.db.prepare("UPDATE community_clan_members SET role = ? WHERE clan_id = ? AND user_id = ?").bind(role, own.clan_id, targetId).run();
    await logActivity(env, { eventKey: `clan-role:${own.clan_id}:${targetId}:${role}:${Date.now()}`, type: "clan_role_changed", actorUserId: user.id, actorName: user.username, message: `${user.username} updated a clan member's role.` });
    return json({ success: true }, 200, NO_STORE);
}

async function getActivity(env, url) {
    await captureCommunitySnapshot(env);
    const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit")) || 50));
    const result = await env.db.prepare(`
        SELECT id, event_type, actor_name, message, created_at
        FROM community_activity ORDER BY created_at DESC, id DESC LIMIT ?
    `).bind(limit).all();
    return json({ activity: result.results || [] }, 200, NO_STORE);
}

async function getPlayers(env) {
    await captureCommunitySnapshot(env);
    const players = await getCurrentSnapshotRows(env, 1000);
    return json({ players: players.map(row => ({ name: row.player_name, rank: Number(row.rank), totalPoints: Number(row.total_points) || 0 })) }, 200, NO_STORE);
}

async function comparePlayers(env, url) {
    await captureCommunitySnapshot(env);
    const playerAName = cleanText(url.searchParams.get("playerA"), 100);
    const playerBName = cleanText(url.searchParams.get("playerB"), 100);
    if (!playerAName || !playerBName) return json({ error: "Choose two players to compare." }, 400, NO_STORE);
    if (normalise(playerAName) === normalise(playerBName)) return json({ error: "Choose two different players." }, 400, NO_STORE);
    const snapshots = await getCurrentSnapshotRows(env, 2000);
    const snapshotByKey = new Map(snapshots.map(row => [row.player_key, row]));
    const realA = snapshotByKey.get(normalise(playerAName));
    const realB = snapshotByKey.get(normalise(playerBName));
    if (!realA || !realB) return json({ error: "One or both players aren't on the current leaderboard." }, 404, NO_STORE);
    const details = await calculatePlayerDetails(env, [realA.player_name, realB.player_name]);
    const decorate = row => {
        const detail = details.get(row.player_key);
        const rank = Number(row.rank);
        const allLevels = [
            ...(detail?.verified || []).map(item => ({ ...item, kind: "Verified" })),
            ...(detail?.completed || []).map(item => ({ ...item, kind: "Completed" })),
            ...(detail?.progressed || []).map(item => ({ ...item, kind: "Progress" }))
        ];
        return {
            name: row.player_name,
            rank,
            totalPoints: Number(row.total_points) || 0,
            completedCount: Number(row.completed_count) || 0,
            verifiedCount: Number(row.verified_count) || 0,
            progressedCount: Number(row.progressed_count) || 0,
            packsCount: Number(row.packs_count) || 0,
            hardest: allLevels.sort((a, b) => a.rank - b.rank).slice(0, 5),
            completedPaths: detail ? [...detail.completedPaths] : []
        };
    };
    const a = decorate(realA);
    const b = decorate(realB);
    const aSet = new Set(a.completedPaths);
    const bSet = new Set(b.completedPaths);
    const files = await getAssetJson(env, "/data/_list.json");
    const shared = [];
    if (Array.isArray(files)) {
        for (let index = 0; index < files.length; index++) {
            const file = files[index];
            if (aSet.has(file) && bSet.has(file)) {
                const level = await getAssetJson(env, `/data/${encodeURIComponent(file)}.json`);
                shared.push({ file, name: cleanText(level?.name || file, 120), rank: index + 1 });
                if (shared.length >= 20) break;
            }
        }
    }
    delete a.completedPaths;
    delete b.completedPaths;
    return json({ playerA: a, playerB: b, pointDifference: round(a.totalPoints - b.totalPoints), sharedCompletions: shared }, 200, NO_STORE);
}

async function getHallOfFame(env) {
    const snapshot = await captureCommunitySnapshot(env);
    const current = await getCurrentSnapshotRows(env, 10);
    const leadersResult = await env.db.prepare(`
        SELECT player_key, MAX(player_name) AS player_name,
               COUNT(*) AS number_one_days,
               MIN(snapshot_date) AS first_number_one,
               MAX(snapshot_date) AS latest_number_one
        FROM community_hall_snapshots WHERE rank = 1
        GROUP BY player_key
        ORDER BY number_one_days DESC, player_name COLLATE NOCASE
        LIMIT 20
    `).all();
    const peaksResult = await env.db.prepare(`
        SELECT player_key, player_name, best_rank, best_rank_date, best_points, best_points_date, first_seen, last_seen
        FROM community_player_records
        ORDER BY best_points DESC, best_rank ASC, player_name COLLATE NOCASE LIMIT 20
    `).all();
    const bestRanksResult = await env.db.prepare(`
        SELECT player_key, player_name, best_rank, best_rank_date, best_points, best_points_date, first_seen, last_seen
        FROM community_player_records
        ORDER BY best_rank ASC, best_points DESC, player_name COLLATE NOCASE LIMIT 20
    `).all();
    const championRowsResult = await env.db.prepare(`
        SELECT snapshot_date, player_name, total_points
        FROM community_hall_snapshots WHERE rank = 1
        ORDER BY snapshot_date DESC LIMIT 90
    `).all();
    const allChampionRowsResult = await env.db.prepare(`
        SELECT snapshot_date, player_key, player_name
        FROM community_hall_snapshots WHERE rank = 1
        ORDER BY snapshot_date ASC
    `).all();
    const championRows = (championRowsResult.results || []).slice().reverse();
    const allChampionRows = allChampionRowsResult.results || [];
    const streaks = new Map();
    const lastDates = new Map();
    const streakNow = new Map();
    const championNames = new Map();
    for (const row of allChampionRows) {
        const key = row.player_key || normalise(row.player_name);
        championNames.set(key, row.player_name);
        const date = row.snapshot_date;
        const previous = lastDates.get(key);
        const dayDelta = previous ? Math.round((Date.parse(`${date}T00:00:00Z`) - Date.parse(`${previous}T00:00:00Z`)) / 86400000) : null;
        const nextStreak = dayDelta === 1 ? (streakNow.get(key) || 1) + 1 : 1;
        streakNow.set(key, nextStreak);
        streaks.set(key, Math.max(streaks.get(key) || 0, nextStreak));
        lastDates.set(key, date);
    }
    const longestStreak = [...streaks.entries()]
        .map(([key, days]) => ({ player: championNames.get(key) || key, player_key: key, days }))
        .sort((a, b) => b.days - a.days)[0] || null;
    const currentLeader = current.find(row => Number(row.rank) === 1) || null;
    const archiveSummary = await env.db.prepare(`
        SELECT COUNT(DISTINCT snapshot_date) AS days, MIN(snapshot_date) AS started
        FROM community_hall_snapshot_runs
    `).first();
    return json({
        snapshotDate: snapshot.snapshotDate,
        archiveDays: Number(archiveSummary?.days) || 0,
        archiveStarted: archiveSummary?.started || null,
        currentTop: current.map(row => ({ rank: Number(row.rank), name: row.player_name, totalPoints: Number(row.total_points) || 0 })),
        numberOneDays: leadersResult.results || [],
        pointsRecords: peaksResult.results || [],
        bestRankRecords: bestRanksResult.results || [],
        recentChampions: championRows,
        longestStreak,
        currentLeader: currentLeader ? { name: currentLeader.player_name, rank: Number(currentLeader.rank), totalPoints: Number(currentLeader.total_points) || 0 } : null,
        note: "Historical records begin when this feature is installed. No earlier champions have been invented."
    }, 200, NO_STORE);
}

export async function handleCommunityRequest(request, env, url, currentUser) {
    if (!url.pathname.startsWith("/api/community/")) return null;
    await ensureCommunitySchema(env);
    const path = url.pathname;

    if (path === "/api/community/clans" && request.method === "GET") return clansList(env, request, currentUser);
    if (path === "/api/community/clans/detail" && request.method === "GET") return clanDetail(env, request, currentUser, url);
    if (path === "/api/community/clans/me" && request.method === "GET") return getMyClan(env, request, currentUser);
    if (path === "/api/community/clans" && request.method === "POST") return createClan(env, request, currentUser);
    if (path === "/api/community/clans/join" && request.method === "POST") return requestToJoinClan(env, request, currentUser);
    if (path === "/api/community/clans/requests" && request.method === "POST") return manageClanRequest(env, request, currentUser);
    if (path === "/api/community/clans/remove-member" && request.method === "POST") return removeClanMember(env, request, currentUser);
    if (path === "/api/community/clans/leave" && request.method === "POST") return leaveClan(env, request, currentUser);
    if (path === "/api/community/clans/disband" && request.method === "POST") return disbandClan(env, request, currentUser);
    if (path === "/api/community/clans/update" && request.method === "POST") return updateClan(env, request, currentUser);
    if (path === "/api/community/clans/role" && request.method === "POST") return updateMemberRole(env, request, currentUser);
    if (path === "/api/community/activity" && request.method === "GET") return getActivity(env, url);
    if (path === "/api/community/players" && request.method === "GET") return getPlayers(env);
    if (path === "/api/community/compare" && request.method === "GET") return comparePlayers(env, url);
    if (path === "/api/community/hall-of-fame" && request.method === "GET") return getHallOfFame(env);
    return json({ error: "Community endpoint not found." }, 404, NO_STORE);
}
