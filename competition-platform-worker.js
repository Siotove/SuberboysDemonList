// Competition platform: in-app notifications, seasonal standings, rank movement,
// player goals and a safer admin operations dashboard. Uses the existing D1 binding.
const NO_STORE = { "Cache-Control": "no-store" };
let schemaPromise = null;

const json = (body, status = 200, headers = {}) =>
    Response.json(body, { status, headers: { ...NO_STORE, ...headers } });
const clean = (value, max = 200) => typeof value === "string"
    ? value.normalize("NFKC").replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, max)
    : "";
const nameKey = value => clean(value, 100).toLocaleLowerCase("en");
const isoDay = date => new Date(date).toISOString().slice(0, 10);
const validDate = value => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;

export async function ensureCompetitionPlatformSchema(env) {
    if (!schemaPromise) {
        schemaPromise = (async () => {
            await env.db.batch([
                env.db.prepare(`CREATE TABLE IF NOT EXISTS competition_notifications (
                    id TEXT PRIMARY KEY,
                    user_id TEXT NOT NULL,
                    event_key TEXT NOT NULL,
                    category TEXT NOT NULL DEFAULT 'site',
                    title TEXT NOT NULL,
                    body TEXT NOT NULL DEFAULT '',
                    href TEXT NOT NULL DEFAULT '/profile',
                    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    read_at TEXT,
                    UNIQUE(user_id, event_key)
                )`),
                env.db.prepare(`CREATE INDEX IF NOT EXISTS idx_competition_notifications_user_unread
                    ON competition_notifications(user_id, read_at, created_at)`),
                env.db.prepare(`CREATE TABLE IF NOT EXISTS competition_seasons (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    start_date TEXT NOT NULL,
                    end_date TEXT NOT NULL,
                    is_active INTEGER NOT NULL DEFAULT 0,
                    is_system INTEGER NOT NULL DEFAULT 0,
                    created_by TEXT,
                    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    CHECK (end_date >= start_date)
                )`),
                env.db.prepare(`CREATE INDEX IF NOT EXISTS idx_competition_seasons_dates
                    ON competition_seasons(start_date, end_date)`),
                env.db.prepare(`CREATE TABLE IF NOT EXISTS competition_admin_audit (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    admin_user_id TEXT NOT NULL,
                    admin_username TEXT NOT NULL,
                    action TEXT NOT NULL,
                    details_json TEXT NOT NULL DEFAULT '{}',
                    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
                )`),
                env.db.prepare(`CREATE INDEX IF NOT EXISTS idx_competition_admin_audit_created
                    ON competition_admin_audit(created_at)`)
            ]);
        })().catch(error => {
            schemaPromise = null;
            throw error;
        });
    }
    await schemaPromise;
}

function quarterFor(date) {
    const year = date.getUTCFullYear();
    const quarter = Math.floor(date.getUTCMonth() / 3) + 1;
    const start = new Date(Date.UTC(year, (quarter - 1) * 3, 1));
    const end = new Date(Date.UTC(year, quarter * 3, 0));
    return {
        id: `calendar-${year}-q${quarter}`,
        name: `Season ${year} · Q${quarter}`,
        startDate: isoDay(start),
        endDate: isoDay(end)
    };
}

function nextQuarter(date) {
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 3, 1));
}

async function ensureCalendarSeasons(env) {
    const today = new Date();
    const currentQuarter = quarterFor(today);
    const first = await env.db.prepare(
        "SELECT MIN(snapshot_date) AS first_date FROM rank_history_snapshots"
    ).first();
    const startDate = first?.first_date || currentQuarter.startDate;
    let cursor = new Date(`${quarterFor(new Date(`${startDate}T00:00:00Z`)).startDate}T00:00:00Z`);
    const current = new Date(`${currentQuarter.startDate}T00:00:00Z`);
    let loops = 0;
    while (cursor <= current && loops < 12) {
        const season = quarterFor(cursor);
        await env.db.prepare(`
            INSERT OR IGNORE INTO competition_seasons
                (id, name, start_date, end_date, is_active, is_system, created_by)
            VALUES (?, ?, ?, ?, 0, 1, 'system')
        `).bind(season.id, season.name, season.startDate, season.endDate).run();
        cursor = nextQuarter(cursor);
        loops += 1;
    }
    const active = await env.db.prepare(
        "SELECT id, is_system FROM competition_seasons WHERE is_active = 1 ORDER BY start_date DESC LIMIT 1"
    ).first();
    if (!active || (Number(active.is_system) === 1 && active.id !== currentQuarter.id)) {
        await env.db.prepare("UPDATE competition_seasons SET is_active = 0 WHERE is_active = 1").run();
        await env.db.prepare("UPDATE competition_seasons SET is_active = 1 WHERE id = ?").bind(currentQuarter.id).run();
    }
}

async function audit(env, user, action, details = {}) {
    await env.db.prepare(`INSERT INTO competition_admin_audit
        (admin_user_id, admin_username, action, details_json)
        VALUES (?, ?, ?, ?)`)
        .bind(String(user.id), clean(user.username, 40) || "admin", action, JSON.stringify(details))
        .run();
}

async function adminGuard(request, env, currentUser) {
    const user = await currentUser(request, env.db);
    if (!user) return { response: json({ error: "Please log in." }, 401) };
    if (Number(user.is_admin) !== 1) return { response: json({ error: "Admin access required." }, 403) };
    return { user };
}

async function profileForUser(env, userId) {
    return env.db.prepare(
        "SELECT leaderboard_name FROM leaderboard_profiles WHERE user_id = ?"
    ).bind(userId).first();
}

async function createNotification(env, userId, eventKey, category, title, body, href) {
    await env.db.prepare(`INSERT OR IGNORE INTO competition_notifications
        (id, user_id, event_key, category, title, body, href)
        VALUES (?, ?, ?, ?, ?, ?, ?)`)
        .bind(crypto.randomUUID(), String(userId), eventKey, category, title, body, href)
        .run();
}

async function seedPersonalNotifications(env, user, profileName) {
    const key = nameKey(profileName);
    if (!key) return;
    const datesResult = await env.db.prepare(
        "SELECT DISTINCT snapshot_date FROM rank_history_snapshots ORDER BY snapshot_date DESC LIMIT 2"
    ).all();
    const dates = (datesResult.results || []).map(row => row.snapshot_date);
    if (dates.length >= 2) {
        const current = await env.db.prepare(`SELECT player_name, rank, total_points FROM rank_history_snapshots
            WHERE snapshot_date = ? AND player_key = ?`).bind(dates[0], key).first();
        const previous = await env.db.prepare(`SELECT player_name, rank, total_points FROM rank_history_snapshots
            WHERE snapshot_date = ? AND player_key = ?`).bind(dates[1], key).first();
        if (current && previous) {
            const movement = Number(previous.rank) - Number(current.rank);
            const pointDelta = Number(current.total_points) - Number(previous.total_points);
            if (movement !== 0) {
                const direction = movement > 0 ? "up" : "down";
                await createNotification(env, user.id, `rank:${dates[0]}:${key}`, "rank",
                    movement > 0 ? `You moved up ${movement} ${movement === 1 ? "place" : "places"}` : `Your rank moved down ${Math.abs(movement)} ${Math.abs(movement) === 1 ? "place" : "places"}`,
                    movement < 0
                        ? `Another player moved ahead of you. You are now #${current.rank} on the points leaderboard.`
                        : `You are now #${current.rank} on the points leaderboard.`, "/leaderboard");
            }
            if (pointDelta > 0.0001) {
                await createNotification(env, user.id, `points:${dates[0]}:${key}`, "points",
                    "You gained leaderboard points",
                    `You earned ${pointDelta.toLocaleString("en-GB", { maximumFractionDigits: 3 })} points since the previous daily snapshot.`, "/leaderboard");
            }
        }
    }
    const quests = await env.db.prepare(`SELECT week_start, quest_id, completed_at
        FROM weekly_quest_completions
        WHERE player_key = ? AND completed_at >= date('now', '-14 days')
        ORDER BY completed_at DESC LIMIT 30`).bind(key).all();
    for (const item of quests.results || []) {
        await createNotification(env, user.id, `quest:${item.week_start}:${item.quest_id}`, "quest",
            "Weekly quest completed", `You completed the ${clean(item.quest_id, 60).replace(/-/g, " ")} quest.`, "/quests");
    }
    const secrets = await env.db.prepare(`SELECT achievement_id, unlocked_at
        FROM secret_achievement_unlocks
        WHERE player_key = ? AND unlocked_at >= date('now', '-30 days')
        ORDER BY unlocked_at DESC LIMIT 30`).bind(key).all();
    for (const item of secrets.results || []) {
        await createNotification(env, user.id, `secret:${item.achievement_id}:${item.unlocked_at}`, "achievement",
            "Secret achievement unlocked", `You unlocked a hidden achievement: ${clean(item.achievement_id, 60).replace(/-/g, " ")}.`, "/quests");
    }
}

async function seedClanRequestNotifications(env, user) {
    // The existing clan system uses member requests (rather than direct invitations).
    // Alert owners/officers when a request is awaiting their review.
    const result = await env.db.prepare(`
        SELECT request.clan_id, request.user_id AS requester_id,
               requester.username AS requester_name, clan.name AS clan_name, clan.tag AS clan_tag
        FROM community_clan_members request
        JOIN community_clans clan ON clan.id = request.clan_id
        JOIN users requester ON requester.id = request.user_id
        JOIN community_clan_members manager
          ON manager.clan_id = request.clan_id
         AND manager.user_id = ?
         AND manager.status = 'member'
         AND manager.role IN ('owner', 'officer')
        WHERE request.status = 'pending'
          AND request.user_id <> ?
        ORDER BY request.requested_at DESC
        LIMIT 50
    `).bind(String(user.id), String(user.id)).all();
    for (const row of result.results || []) {
        await createNotification(env, user.id,
            `clan-request:${row.clan_id}:${row.requester_id}`, 'clan',
            'New clan join request',
            `${clean(row.requester_name, 40)} requested to join [${clean(row.clan_tag, 12)}] ${clean(row.clan_name, 60)}.`,
            '/clans');
    }
}

async function notificationsResponse(request, env, url, currentUser, captureSnapshot) {
    const user = await currentUser(request, env.db);
    if (!user) return json({ error: "Log in to view notifications." }, 401);
    if (captureSnapshot) await captureSnapshot(env);
    const profile = await profileForUser(env, user.id);
    if (profile?.leaderboard_name) await seedPersonalNotifications(env, user, profile.leaderboard_name);
    await seedClanRequestNotifications(env, user);
    const unread = await env.db.prepare(`SELECT COUNT(*) AS count FROM competition_notifications
        WHERE user_id = ? AND read_at IS NULL`).bind(user.id).first();
    const limit = Math.min(50, Math.max(1, Number(url.searchParams.get("limit")) || 20));
    const items = await env.db.prepare(`SELECT id, category, title, body, href, created_at, read_at
        FROM competition_notifications WHERE user_id = ? ORDER BY created_at DESC, rowid DESC LIMIT ?`)
        .bind(user.id, limit).all();
    return json({ notifications: items.results || [], unreadCount: Number(unread?.count) || 0 });
}

async function readNotifications(request, env, currentUser) {
    const user = await currentUser(request, env.db);
    if (!user) return json({ error: "Please log in." }, 401);
    let body;
    try { body = await request.json(); } catch { return json({ error: "Invalid JSON body." }, 400); }
    if (body?.all === true) {
        await env.db.prepare(`UPDATE competition_notifications SET read_at = CURRENT_TIMESTAMP
            WHERE user_id = ? AND read_at IS NULL`).bind(user.id).run();
    } else {
        const ids = Array.isArray(body?.ids) ? body.ids.filter(id => typeof id === "string" && id.length <= 80).slice(0, 50) : [];
        if (!ids.length) return json({ error: "Provide notification ids or all: true." }, 400);
        const statements = ids.map(id => env.db.prepare(`UPDATE competition_notifications SET read_at = CURRENT_TIMESTAMP
            WHERE id = ? AND user_id = ? AND read_at IS NULL`).bind(id, user.id));
        for (let i = 0; i < statements.length; i += 50) await env.db.batch(statements.slice(i, i + 50));
    }
    const unread = await env.db.prepare(`SELECT COUNT(*) AS count FROM competition_notifications
        WHERE user_id = ? AND read_at IS NULL`).bind(user.id).first();
    return json({ success: true, unreadCount: Number(unread?.count) || 0 });
}

async function movementResponse(env, captureSnapshot) {
    if (captureSnapshot) await captureSnapshot(env);
    const today = isoDay(new Date());
    const previousDate = await env.db.prepare(`SELECT MAX(snapshot_date) AS snapshot_date
        FROM rank_history_snapshots WHERE snapshot_date < ?`).bind(today).first();
    if (!previousDate?.snapshot_date) return json({ previousDate: null, previousRanks: {} });
    const result = await env.db.prepare(`SELECT player_key, player_name, rank, total_points
        FROM rank_history_snapshots WHERE snapshot_date = ? ORDER BY rank ASC LIMIT 5000`)
        .bind(previousDate.snapshot_date).all();
    const previousRanks = {};
    for (const row of result.results || []) {
        previousRanks[row.player_key] = { name: row.player_name, rank: Number(row.rank), totalPoints: Number(row.total_points) || 0 };
    }
    return json({ previousDate: previousDate.snapshot_date, previousRanks });
}

async function ensureSeasonsAndGet(env) {
    await ensureCalendarSeasons(env);
    const result = await env.db.prepare(`SELECT id, name, start_date, end_date, is_active, is_system, created_at
        FROM competition_seasons ORDER BY is_active DESC, start_date DESC LIMIT 20`).all();
    return result.results || [];
}

async function seasonResponse(env, url, captureSnapshot) {
    if (captureSnapshot) await captureSnapshot(env);
    const seasons = await ensureSeasonsAndGet(env);
    const active = seasons.find(item => Number(item.is_active) === 1) || seasons[0] || null;
    const requested = url.searchParams.get("season");
    const season = seasons.find(item => item.id === requested) || active;
    if (!season) return json({ seasons: [], activeSeasonId: null, selectedSeason: null, baselinePoints: {}, standings: [], liveMode: false });
    const today = isoDay(new Date());
    const seasonEndLimit = season.end_date > today ? today : season.end_date;
    const liveMode = season.start_date <= today && season.end_date >= today && Number(season.is_active) === 1;
    if (season.start_date > today) {
        return json({ seasons, activeSeasonId: active?.id || null, selectedSeason: season,
            baselinePoints: {}, standings: [], liveMode: false, status: "upcoming" });
    }
    const endRow = await env.db.prepare(`SELECT MAX(snapshot_date) AS snapshot_date FROM rank_history_snapshots
        WHERE snapshot_date <= ?`).bind(seasonEndLimit).first();
    if (!endRow?.snapshot_date) {
        return json({ seasons, activeSeasonId: active?.id || null, selectedSeason: season,
            baselinePoints: {}, standings: [], liveMode, status: "waiting-for-snapshots" });
    }
    const baselineDateBefore = await env.db.prepare(`SELECT MAX(snapshot_date) AS snapshot_date FROM rank_history_snapshots
        WHERE snapshot_date < ?`).bind(season.start_date).first();
    const baselineDateFallback = await env.db.prepare(`SELECT MIN(snapshot_date) AS snapshot_date FROM rank_history_snapshots
        WHERE snapshot_date >= ? AND snapshot_date <= ?`).bind(season.start_date, endRow.snapshot_date).first();
    const baseDate = baselineDateBefore?.snapshot_date || baselineDateFallback?.snapshot_date || endRow.snapshot_date;
    const endRows = await env.db.prepare(`SELECT player_key, player_name, rank, total_points, completed_count, verified_count, progressed_count, packs_count,
        COALESCE(
            (SELECT b.total_points FROM rank_history_snapshots b WHERE b.player_key = e.player_key AND b.snapshot_date < ? ORDER BY b.snapshot_date DESC LIMIT 1),
            (SELECT b.total_points FROM rank_history_snapshots b WHERE b.player_key = e.player_key AND b.snapshot_date >= ? AND b.snapshot_date <= ? ORDER BY b.snapshot_date ASC LIMIT 1),
            e.total_points
        ) AS baseline_points
        FROM rank_history_snapshots e WHERE e.snapshot_date = ? ORDER BY e.rank ASC LIMIT 5000`)
        .bind(season.start_date, season.start_date, endRow.snapshot_date, endRow.snapshot_date).all();
    const baselinePoints = {};
    const standings = (endRows.results || []).map(row => {
        const key = row.player_key;
        const points = Math.max(0, (Number(row.total_points) || 0) - (Number(row.baseline_points) || 0));
        baselinePoints[key] = Number(row.baseline_points) || 0;
        return { name: row.player_name, playerKey: key, rank: Number(row.rank), totalPoints: Number(row.total_points) || 0,
            points, completedCount: Number(row.completed_count) || 0, verifiedCount: Number(row.verified_count) || 0 };
    }).sort((a, b) => b.points - a.points || b.totalPoints - a.totalPoints || a.name.localeCompare(b.name));
    standings.forEach((item, index) => { item.seasonRank = index + 1; });
    return json({ seasons, activeSeasonId: active?.id || null, selectedSeason: season, snapshotDate: endRow.snapshot_date,
        baselineDate: baseDate, baselinePoints, standings: standings.slice(0, 250), liveMode,
        status: liveMode ? "live" : "historical" });
}

async function goalsResponse(request, env, currentUser, captureSnapshot) {
    const user = await currentUser(request, env.db);
    if (!user) return json({ error: "Log in to see your personal goal." }, 401);
    const profile = await profileForUser(env, user.id);
    if (!profile?.leaderboard_name) return json({ error: "Link your leaderboard identity in Profile to see your next target." }, 409);
    if (captureSnapshot) await captureSnapshot(env);
    const rows = await env.db.prepare(`SELECT snapshot_date, player_key, player_name, rank, total_points
        FROM rank_history_snapshots WHERE snapshot_date = (SELECT MAX(snapshot_date) FROM rank_history_snapshots)
        ORDER BY rank ASC LIMIT 5000`).all();
    const all = rows.results || [];
    const index = all.findIndex(row => row.player_key === nameKey(profile.leaderboard_name));
    if (index < 0) return json({ error: "Your identity has no leaderboard snapshot yet. Try again shortly." }, 404);
    const current = all[index];
    const next = index > 0 ? all[index - 1] : null;
    const needed = next ? Math.max(0, Number(next.total_points) - Number(current.total_points) + 0.001) : 0;
    return json({ playerName: current.player_name, rank: Number(current.rank), totalPoints: Number(current.total_points),
        target: next ? { name: next.player_name, rank: Number(next.rank), totalPoints: Number(next.total_points) } : null,
        pointsNeeded: Number(needed.toFixed(3)), isFirst: !next, snapshotDate: current.snapshot_date });
}

async function adminOverview(request, env, currentUser) {
    const guard = await adminGuard(request, env, currentUser);
    if (guard.response) return guard.response;
    const accounts = await env.db.prepare(`SELECT COUNT(*) AS total,
        SUM(CASE WHEN is_banned = 1 THEN 1 ELSE 0 END) AS banned,
        SUM(CASE WHEN created_at >= datetime('now', '-7 days') THEN 1 ELSE 0 END) AS new_week
        FROM users`).first();
    const snapshots = await env.db.prepare(`SELECT COUNT(*) AS rows, COUNT(DISTINCT snapshot_date) AS days,
        MAX(snapshot_date) AS latest_date FROM rank_history_snapshots`).first();
    const notices = await env.db.prepare(`SELECT COUNT(*) AS total,
        SUM(CASE WHEN read_at IS NULL THEN 1 ELSE 0 END) AS unread,
        SUM(CASE WHEN created_at >= datetime('now', '-1 day') THEN 1 ELSE 0 END) AS last_day
        FROM competition_notifications`).first();
    const seasons = await env.db.prepare(`SELECT COUNT(*) AS total,
        SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) AS active FROM competition_seasons`).first();
    const auditRows = await env.db.prepare(`SELECT id, admin_username, action, details_json, created_at
        FROM competition_admin_audit ORDER BY id DESC LIMIT 20`).all();
    const activeSeason = await env.db.prepare(`SELECT name, start_date, end_date FROM competition_seasons
        WHERE is_active = 1 ORDER BY start_date DESC LIMIT 1`).first();
    return json({ accountCount: Number(accounts?.total) || 0, bannedCount: Number(accounts?.banned) || 0,
        newAccountsWeek: Number(accounts?.new_week) || 0, snapshotRows: Number(snapshots?.rows) || 0,
        snapshotDays: Number(snapshots?.days) || 0, latestSnapshot: snapshots?.latest_date || null,
        notificationCount: Number(notices?.total) || 0, unreadNotifications: Number(notices?.unread) || 0,
        notificationsLastDay: Number(notices?.last_day) || 0, seasonCount: Number(seasons?.total) || 0,
        activeSeasonCount: Number(seasons?.active) || 0, activeSeason: activeSeason || null,
        recentActions: (auditRows.results || []).map(row => ({ ...row, details: safeParse(row.details_json) })) });
}

function safeParse(value) {
    try { return JSON.parse(value || "{}"); } catch { return {}; }
}

async function adminAnnouncement(request, env, currentUser) {
    const guard = await adminGuard(request, env, currentUser);
    if (guard.response) return guard.response;
    let body;
    try { body = await request.json(); } catch { return json({ error: "Invalid JSON body." }, 400); }
    const title = clean(body?.title, 100);
    const message = clean(body?.message, 500);
    let href = clean(body?.href || "/leaderboard", 180);
    if (!title || title.length < 3 || !message) return json({ error: "Enter a title of at least 3 characters and a message." }, 400);
    if (!href.startsWith("/") || href.startsWith("//") || href.includes("\\")) href = "/leaderboard";
    const result = await env.db.prepare("SELECT id FROM users WHERE COALESCE(is_banned, 0) = 0 ORDER BY id").all();
    const recipients = result.results || [];
    const notificationId = crypto.randomUUID();
    const statements = recipients.map(row => env.db.prepare(`INSERT OR IGNORE INTO competition_notifications
        (id, user_id, event_key, category, title, body, href)
        VALUES (?, ?, ?, 'announcement', ?, ?, ?)`)
        .bind(crypto.randomUUID(), String(row.id), `announcement:${notificationId}:${row.id}`, title, message, href));
    for (let i = 0; i < statements.length; i += 50) await env.db.batch(statements.slice(i, i + 50));
    await audit(env, guard.user, "broadcast_announcement", { title, recipientCount: recipients.length, href });
    return json({ success: true, recipientCount: recipients.length });
}

async function adminCreateSeason(request, env, currentUser) {
    const guard = await adminGuard(request, env, currentUser);
    if (guard.response) return guard.response;
    let body;
    try { body = await request.json(); } catch { return json({ error: "Invalid JSON body." }, 400); }
    const name = clean(body?.name, 60);
    const startDate = body?.startDate;
    const endDate = body?.endDate;
    const activate = body?.activate !== false;
    if (name.length < 3 || !validDate(startDate) || !validDate(endDate) || endDate < startDate) {
        return json({ error: "Provide a season name and valid dates with end date on or after start date." }, 400);
    }
    const id = `custom-${crypto.randomUUID()}`;
    if (activate) await env.db.prepare("UPDATE competition_seasons SET is_active = 0 WHERE is_active = 1").run();
    await env.db.prepare(`INSERT INTO competition_seasons
        (id, name, start_date, end_date, is_active, is_system, created_by)
        VALUES (?, ?, ?, ?, ?, 0, ?)`)
        .bind(id, name, startDate, endDate, activate ? 1 : 0, String(guard.user.id)).run();
    await audit(env, guard.user, "create_season", { id, name, startDate, endDate, activate });
    return json({ success: true, season: { id, name, startDate, endDate, isActive: activate } }, 201);
}

export async function handleCompetitionPlatformRequest(request, env, url, currentUser, captureSnapshot) {
    if (!url.pathname.startsWith("/api/competition/")) return null;
    await ensureCompetitionPlatformSchema(env);
    const path = url.pathname;
    if (path === "/api/competition/notifications" && request.method === "GET")
        return notificationsResponse(request, env, url, currentUser, captureSnapshot);
    if (path === "/api/competition/notifications/read" && request.method === "POST")
        return readNotifications(request, env, currentUser);
    if (path === "/api/competition/movements" && request.method === "GET")
        return movementResponse(env, captureSnapshot);
    if (path === "/api/competition/seasons" && request.method === "GET")
        return seasonResponse(env, url, captureSnapshot);
    if (path === "/api/competition/goals" && request.method === "GET")
        return goalsResponse(request, env, currentUser, captureSnapshot);
    if (path === "/api/competition/admin/overview" && request.method === "GET")
        return adminOverview(request, env, currentUser);
    if (path === "/api/competition/admin/announce" && request.method === "POST")
        return adminAnnouncement(request, env, currentUser);
    if (path === "/api/competition/admin/seasons" && request.method === "POST")
        return adminCreateSeason(request, env, currentUser);
    return json({ error: "Competition feature endpoint not found." }, 404);
}
