-- Daily rank and points history for Suberboys Demon List.
-- Apply this in the Cloudflare D1 Console before running the installer workflow.
CREATE TABLE IF NOT EXISTS rank_history_snapshots (
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
);

CREATE INDEX IF NOT EXISTS idx_rank_history_player_date
    ON rank_history_snapshots (player_key, snapshot_date);

CREATE TABLE IF NOT EXISTS rank_history_snapshot_runs (
    snapshot_date TEXT PRIMARY KEY,
    player_count INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS weekly_quest_baselines (
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
);

CREATE INDEX IF NOT EXISTS idx_weekly_quest_baselines_player
    ON weekly_quest_baselines (player_key, week_start);

CREATE TABLE IF NOT EXISTS weekly_quest_completions (
    week_start TEXT NOT NULL,
    player_key TEXT NOT NULL,
    quest_id TEXT NOT NULL,
    completed_at TEXT NOT NULL,
    PRIMARY KEY (week_start, player_key, quest_id)
);

CREATE INDEX IF NOT EXISTS idx_weekly_quest_completions_player
    ON weekly_quest_completions (player_key, week_start);

CREATE TABLE IF NOT EXISTS secret_achievement_unlocks (
    player_key TEXT NOT NULL,
    achievement_id TEXT NOT NULL,
    unlocked_at TEXT NOT NULL,
    PRIMARY KEY (player_key, achievement_id)
);

CREATE INDEX IF NOT EXISTS idx_secret_achievement_player
    ON secret_achievement_unlocks (player_key);
