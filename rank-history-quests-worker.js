import { round, score } from "./js/score.js";
import { PACK_DEFINITIONS } from "./js/packs.js";

const ASSET_ORIGIN = "https://suberboys-assets.internal";
const HISTORY_RETENTION_DAYS = 730;

const WEEKLY_QUESTS = [
    {
        id: "climb-3",
        name: "Climb the Ladder",
        description: "Move up at least 3 places on the leaderboard this week.",
        target: 3,
        unit: "places",
        metric: "rankGain"
    },
    {
        id: "point-gain-5",
        name: "Point Collector",
        description: "Gain at least 5 leaderboard points this week.",
        target: 5,
        unit: "points",
        metric: "pointGain"
    },
    {
        id: "complete-1",
        name: "One More Win",
        description: "Add at least one completed level this week.",
        target: 1,
        unit: "levels",
        metric: "completedGain"
    },
    {
        id: "verify-1",
        name: "Verifier's Mark",
        description: "Verify at least one additional level this week.",
        target: 1,
        unit: "levels",
        metric: "verifiedGain"
    },
    {
        id: "progress-1",
        name: "Keep Pushing",
        description: "Add at least one new progress record this week.",
        target: 1,
        unit: "records",
        metric: "progressedGain"
    }
];

// Names and descriptions are only sent to a player after the unlock is recorded.
const SECRET_ACHIEVEMENTS = [
    { id: "rank-climber", name: "Up We Go", description: "Climb at least 3 leaderboard places in one week." },
    { id: "point-surge", name: "Point Surge", description: "Gain at least 5 leaderboard points in one week." },
    { id: "perfect-week", name: "The Full House", description: "Complete all five weekly quests in one week." },
    { id: "time-capsule", name: "Time Capsule", description: "Build 30 daily rank-history snapshots." },
    { id: "seven-day-grind", name: "The Grind Never Stops", description: "Have rank-history snapshots on seven consecutive days." },
    { id: "comeback", name: "The Comeback", description: "Return to your previous best rank after falling at least five places." }
];

const json = (value, status = 200, headers = {}) => Response.json(value, { status, headers });
const noStore = { "Cache-Control": "no-store" };

function isoDay(date) {
    return new Date(date).toISOString().slice(0, 10);
}

function weekStartFor(dateText) {
    const date = new Date(`${dateText}T00:00:00.000Z`);
    const mondayOffset = (date.getUTCDay() + 6) % 7;
    date.setUTCDate(date.getUTCDate() - mondayOffset);
    return isoDay(date);
}

function addDays(dateText, days) {
    const date = new Date(`${dateText}T00:00:00.000Z`);
    date.setUTCDate(date.getUTCDate() + days);
    return isoDay(date);
}

function normaliseName(value) {
    return typeof value === "string" ? value.trim().toLocaleLowerCase("en") : "";
}

async function getAssetJson(env, path) {
    const response = await env.ASSETS.fetch(new Request(new URL(path, ASSET_ORIGIN)));
    if (!response.ok) throw new Error(`Could not read published asset ${path} (${response.status}).`);
    return response.json();
}

function ensurePlayer(players, name) {
    if (typeof name !== "string" || !name.trim()) return null;
    const trimmed = name.trim();
    const key = normaliseName(trimmed);
    if (!key) return null;
    if (!players.has(key)) {
        players.set(key, {
            key,
            name: trimmed,
            verified: [],
            completed: [],
            progressed: [],
            completedPaths: new Set()
        });
    }
    return players.get(key);
}

async function buildCurrentLeaderboard(env) {
    const files = await getAssetJson(env, "/data/_list.json");
    if (!Array.isArray(files)) throw new Error("The published level list is invalid.");

    const players = new Map();
    for (let index = 0; index < files.length; index++) {
        const file = files[index];
        if (typeof file !== "string" || !/^[a-zA-Z0-9_-]{1,80}$/.test(file)) continue;
        const level = await getAssetJson(env, `/data/${encodeURIComponent(file)}.json`);
        if (!level || typeof level !== "object") continue;
        const rank = index + 1;
        const required = Number.isFinite(Number(level.percentToQualify))
            ? Number(level.percentToQualify)
            : 100;

        // Mirror fetchLeaderboard(): a level verifier is credited as a verification
        // and contributes a completed path for pack completion.
        const verifier = ensurePlayer(players, level.verifier);
        if (verifier) {
            verifier.verified.push({ score: score(rank, 100, required) });
            verifier.completedPaths.add(file);
        }

        if (!Array.isArray(level.records)) continue;
        for (const record of level.records) {
            if (!record || typeof record.user !== "string" || !Number.isFinite(Number(record.percent))) continue;
            const player = ensurePlayer(players, record.user);
            if (!player) continue;
            const percent = Number(record.percent);
            const recordScore = score(rank, percent, required);
            if (percent === 100) {
                player.completed.push({ score: recordScore });
                player.completedPaths.add(file);
            } else {
                player.progressed.push({ score: recordScore });
            }
        }
    }

    // Include linked identities even if they have no records yet, just as the public
    // leaderboard does. This also preserves accounts that have joined the board.
    const linked = await env.db.prepare("SELECT leaderboard_name FROM leaderboard_profiles").all();
    for (const row of linked.results || []) ensurePlayer(players, row.leaderboard_name);

    const leaderboard = [...players.values()].map(player => {
        const packsBeaten = PACK_DEFINITIONS.filter(pack =>
            Array.isArray(pack.levelPaths) &&
            pack.levelPaths.length > 0 &&
            pack.levelPaths.every(path => player.completedPaths.has(path))
        );
        const levelTotal = [ ...player.verified, ...player.completed, ...player.progressed ]
            .reduce((total, item) => total + item.score, 0);
        const packBonus = packsBeaten.reduce((total, pack) => total + (Number(pack.bonus) || 0), 0);
        return {
            ...player,
            total: round(levelTotal + packBonus),
            completedCount: player.completed.length,
            verifiedCount: player.verified.length,
            progressedCount: player.progressed.length,
            packsCount: packsBeaten.length
        };
    }).sort((a, b) =>
        b.total - a.total || a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
    );

    return leaderboard.map((player, index) => ({
        snapshot_date: "",
        player_key: player.key,
        player_name: player.name,
        rank: index + 1,
        total_points: player.total,
        completed_count: player.completedCount,
        verified_count: player.verifiedCount,
        progressed_count: player.progressedCount,
        packs_count: player.packsCount
    }));
}

async function batchInChunks(db, statements, chunkSize = 50) {
    for (let index = 0; index < statements.length; index += chunkSize) {
        await db.batch(statements.slice(index, index + chunkSize));
    }
}

async function seedWeeklyBaselines(env, snapshotDate, weekStart) {
    const rows = await env.db.prepare(`
        SELECT snapshot_date, player_key, player_name, rank, total_points,
               completed_count, verified_count, progressed_count, packs_count
        FROM rank_history_snapshots
        WHERE snapshot_date = ?
    `).bind(snapshotDate).all();

    const statements = (rows.results || []).map(row => env.db.prepare(`
        INSERT OR IGNORE INTO weekly_quest_baselines
            (week_start, player_key, player_name, baseline_date, rank,
             total_points, completed_count, verified_count, progressed_count, packs_count)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
        weekStart, row.player_key, row.player_name, snapshotDate, row.rank,
        row.total_points, row.completed_count, row.verified_count,
        row.progressed_count, row.packs_count
    ));
    await batchInChunks(env.db, statements);
}

async function evaluateWeeklyProgress(env, snapshotDate, weekStart) {
    const currentResult = await env.db.prepare(`
        SELECT snapshot_date, player_key, player_name, rank, total_points,
               completed_count, verified_count, progressed_count, packs_count
        FROM rank_history_snapshots WHERE snapshot_date = ?
    `).bind(snapshotDate).all();
    const currentRows = currentResult.results || [];
    if (!currentRows.length) return;

    await seedWeeklyBaselines(env, snapshotDate, weekStart);
    const baselineResult = await env.db.prepare(`
        SELECT * FROM weekly_quest_baselines WHERE week_start = ?
    `).bind(weekStart).all();
    const baselineByPlayer = new Map((baselineResult.results || []).map(row => [row.player_key, row]));

    const existingCompletions = await env.db.prepare(`
        SELECT player_key, quest_id FROM weekly_quest_completions WHERE week_start = ?
    `).bind(weekStart).all();
    const completionMap = new Map();
    for (const row of existingCompletions.results || []) {
        if (!completionMap.has(row.player_key)) completionMap.set(row.player_key, new Set());
        completionMap.get(row.player_key).add(row.quest_id);
    }

    const completionStatements = [];
    for (const current of currentRows) {
        const baseline = baselineByPlayer.get(current.player_key) || current;
        const rankGain = Number(baseline.rank) > 0 && Number(current.rank) > 0
            ? Number(baseline.rank) - Number(current.rank) : 0;
        const values = {
            "climb-3": rankGain,
            "point-gain-5": Math.max(0, Number(current.total_points) - Number(baseline.total_points)),
            "complete-1": Math.max(0, Number(current.completed_count) - Number(baseline.completed_count)),
            "verify-1": Math.max(0, Number(current.verified_count) - Number(baseline.verified_count)),
            "progress-1": Math.max(0, Number(current.progressed_count) - Number(baseline.progressed_count))
        };
        if (!completionMap.has(current.player_key)) completionMap.set(current.player_key, new Set());
        const done = completionMap.get(current.player_key);
        for (const quest of WEEKLY_QUESTS) {
            if (Number(values[quest.id]) >= quest.target && !done.has(quest.id)) {
                completionStatements.push(env.db.prepare(`
                    INSERT OR IGNORE INTO weekly_quest_completions
                        (week_start, player_key, quest_id, completed_at)
                    VALUES (?, ?, ?, ?)
                `).bind(weekStart, current.player_key, quest.id, snapshotDate));
                done.add(quest.id);
            }
        }
    }
    await batchInChunks(env.db, completionStatements);

    const snapshotCounts = await env.db.prepare(`
        SELECT player_key, COUNT(*) AS snapshot_count
        FROM rank_history_snapshots
        GROUP BY player_key
    `).all();
    const countsByPlayer = new Map((snapshotCounts.results || []).map(row => [row.player_key, Number(row.snapshot_count) || 0]));

    const streakStart = addDays(snapshotDate, -6);
    const streakCounts = await env.db.prepare(`
        SELECT player_key, COUNT(DISTINCT snapshot_date) AS day_count
        FROM rank_history_snapshots
        WHERE snapshot_date BETWEEN ? AND ?
        GROUP BY player_key
    `).bind(streakStart, snapshotDate).all();
    const streakByPlayer = new Map((streakCounts.results || []).map(row => [row.player_key, Number(row.day_count) || 0]));

    const previousHistory = await env.db.prepare(`
        SELECT player_key, MIN(rank) AS best_rank, MAX(rank) AS worst_rank
        FROM rank_history_snapshots
        WHERE snapshot_date < ?
        GROUP BY player_key
    `).bind(snapshotDate).all();
    const previousByPlayer = new Map((previousHistory.results || []).map(row => [row.player_key, row]));

    const secretStatements = [];
    for (const current of currentRows) {
        const done = completionMap.get(current.player_key) || new Set();
        const old = previousByPlayer.get(current.player_key);
        const shouldUnlock = new Set();

        if (done.has("climb-3")) shouldUnlock.add("rank-climber");
        if (done.has("point-gain-5")) shouldUnlock.add("point-surge");
        if (WEEKLY_QUESTS.every(quest => done.has(quest.id))) shouldUnlock.add("perfect-week");
        if ((countsByPlayer.get(current.player_key) || 0) >= 30) shouldUnlock.add("time-capsule");
        if ((streakByPlayer.get(current.player_key) || 0) >= 7) shouldUnlock.add("seven-day-grind");
        if (
            old && Number(old.best_rank) > 0 &&
            Number(old.worst_rank) >= Number(old.best_rank) + 5 &&
            Number(current.rank) <= Number(old.best_rank)
        ) shouldUnlock.add("comeback");

        for (const achievementId of shouldUnlock) {
            secretStatements.push(env.db.prepare(`
                INSERT OR IGNORE INTO secret_achievement_unlocks
                    (player_key, achievement_id, unlocked_at)
                VALUES (?, ?, ?)
            `).bind(current.player_key, achievementId, snapshotDate));
        }
    }
    await batchInChunks(env.db, secretStatements);
}

/** Capture one immutable snapshot per UTC day. Called by the daily cron and lazily
 * by feature APIs, so installation gets an initial snapshot without waiting a day. */
export async function captureDailyRankSnapshot(env, now = new Date()) {
    const snapshotDate = isoDay(now);
    const weekStart = weekStartFor(snapshotDate);
    const existing = await env.db.prepare(`
        SELECT player_count FROM rank_history_snapshot_runs WHERE snapshot_date = ?
    `).bind(snapshotDate).first();

    if (!existing) {
        const rows = await buildCurrentLeaderboard(env);
        const statements = rows.map(row => env.db.prepare(`
            INSERT INTO rank_history_snapshots
                (snapshot_date, player_key, player_name, rank, total_points,
                 completed_count, verified_count, progressed_count, packs_count)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(snapshot_date, player_key) DO UPDATE SET
                player_name = excluded.player_name,
                rank = excluded.rank,
                total_points = excluded.total_points,
                completed_count = excluded.completed_count,
                verified_count = excluded.verified_count,
                progressed_count = excluded.progressed_count,
                packs_count = excluded.packs_count
        `).bind(
            snapshotDate, row.player_key, row.player_name, row.rank,
            row.total_points, row.completed_count, row.verified_count,
            row.progressed_count, row.packs_count
        ));
        await batchInChunks(env.db, statements);
        await env.db.prepare(`
            INSERT INTO rank_history_snapshot_runs (snapshot_date, player_count, created_at)
            VALUES (?, ?, ?)
            ON CONFLICT(snapshot_date) DO UPDATE SET
                player_count = excluded.player_count,
                created_at = excluded.created_at
        `).bind(snapshotDate, rows.length, new Date().toISOString()).run();

        const cutoff = addDays(snapshotDate, -HISTORY_RETENTION_DAYS);
        await env.db.batch([
            env.db.prepare("DELETE FROM rank_history_snapshots WHERE snapshot_date < ?").bind(cutoff),
            env.db.prepare("DELETE FROM rank_history_snapshot_runs WHERE snapshot_date < ?").bind(cutoff),
            env.db.prepare("DELETE FROM weekly_quest_baselines WHERE week_start < ?").bind(cutoff),
            env.db.prepare("DELETE FROM weekly_quest_completions WHERE week_start < ?").bind(cutoff)
        ]);
    }

    await seedWeeklyBaselines(env, snapshotDate, weekStart);
    await evaluateWeeklyProgress(env, snapshotDate, weekStart);
    return { snapshotDate, weekStart };
}

async function rankHistoryResponse(request, env, url) {
    const playerName = (url.searchParams.get("player") || "").trim();
    if (!playerName || playerName.length > 100) {
        return json({ error: "Choose a player to view their rank history." }, 400, noStore);
    }
    const { snapshotDate } = await captureDailyRankSnapshot(env, new Date());
    const playerKey = normaliseName(playerName);
    const result = await env.db.prepare(`
        SELECT snapshot_date, player_name, rank, total_points,
               completed_count, verified_count, progressed_count, packs_count
        FROM rank_history_snapshots
        WHERE player_key = ?
        ORDER BY snapshot_date ASC
        LIMIT 730
    `).bind(playerKey).all();
    const history = result.results || [];
    return json({
        player: history.length ? history[history.length - 1].player_name : playerName,
        latestSnapshot: snapshotDate,
        history
    }, 200, noStore);
}

async function weeklyQuestsResponse(request, env, url, currentUser) {
    const user = await currentUser(request, env.db);
    if (!user) return json({ error: "Log in to track your weekly quests." }, 401, noStore);

    const profile = await env.db.prepare(`
        SELECT leaderboard_name FROM leaderboard_profiles WHERE user_id = ?
    `).bind(user.id).first();
    if (!profile?.leaderboard_name) {
        return json({ error: "Link your leaderboard identity in your Profile page to use weekly quests." }, 409, noStore);
    }

    const { snapshotDate, weekStart } = await captureDailyRankSnapshot(env, new Date());
    const playerKey = normaliseName(profile.leaderboard_name);
    const current = await env.db.prepare(`
        SELECT snapshot_date, player_name, rank, total_points,
               completed_count, verified_count, progressed_count, packs_count
        FROM rank_history_snapshots
        WHERE snapshot_date = ? AND player_key = ?
    `).bind(snapshotDate, playerKey).first();

    if (!current) {
        return json({ error: "No rank-history snapshot exists for this player yet. Try again after the next daily snapshot." }, 404, noStore);
    }

    const baseline = await env.db.prepare(`
        SELECT * FROM weekly_quest_baselines WHERE week_start = ? AND player_key = ?
    `).bind(weekStart, playerKey).first() || current;
    const completedResult = await env.db.prepare(`
        SELECT quest_id, completed_at FROM weekly_quest_completions
        WHERE week_start = ? AND player_key = ?
    `).bind(weekStart, playerKey).all();
    const completedIds = new Map((completedResult.results || []).map(row => [row.quest_id, row.completed_at]));

    const deltas = {
        rankGain: Math.max(0, Number(baseline.rank) > 0 ? Number(baseline.rank) - Number(current.rank) : 0),
        pointGain: Math.max(0, Number(current.total_points) - Number(baseline.total_points)),
        completedGain: Math.max(0, Number(current.completed_count) - Number(baseline.completed_count)),
        verifiedGain: Math.max(0, Number(current.verified_count) - Number(baseline.verified_count)),
        progressedGain: Math.max(0, Number(current.progressed_count) - Number(baseline.progressed_count))
    };
    const quests = WEEKLY_QUESTS.map(quest => ({
        ...quest,
        progress: Math.min(quest.target, Math.max(0, Number(deltas[quest.metric]) || 0)),
        rawProgress: Math.max(0, Number(deltas[quest.metric]) || 0),
        completed: completedIds.has(quest.id),
        completedAt: completedIds.get(quest.id) || null
    }));

    const unlockResult = await env.db.prepare(`
        SELECT achievement_id, unlocked_at FROM secret_achievement_unlocks
        WHERE player_key = ? ORDER BY unlocked_at ASC
    `).bind(playerKey).all();
    const unlockedMap = new Map((unlockResult.results || []).map(row => [row.achievement_id, row.unlocked_at]));
    const secretAchievements = SECRET_ACHIEVEMENTS
        .filter(item => unlockedMap.has(item.id))
        .map(item => ({ ...item, unlockedAt: unlockedMap.get(item.id) }));

    return json({
        playerName: current.player_name,
        snapshotDate,
        weekStart,
        resetsAt: addDays(weekStart, 7),
        current: {
            rank: Number(current.rank),
            totalPoints: Number(current.total_points),
            completedCount: Number(current.completed_count),
            verifiedCount: Number(current.verified_count),
            progressedCount: Number(current.progressed_count),
            packsCount: Number(current.packs_count)
        },
        baseline: {
            rank: Number(baseline.rank),
            totalPoints: Number(baseline.total_points),
            completedCount: Number(baseline.completed_count),
            verifiedCount: Number(baseline.verified_count),
            progressedCount: Number(baseline.progressed_count),
            packsCount: Number(baseline.packs_count)
        },
        quests,
        secretAchievements,
        secretCount: SECRET_ACHIEVEMENTS.length,
        secretUnlockedCount: secretAchievements.length
    }, 200, noStore);
}

export async function handleRankHistoryQuestRequest(request, env, url, currentUser) {
    if (request.method !== "GET") return null;
    if (url.pathname === "/api/rank-history") return rankHistoryResponse(request, env, url);
    if (url.pathname === "/api/weekly-quests") return weeklyQuestsResponse(request, env, url, currentUser);
    return null;
}
