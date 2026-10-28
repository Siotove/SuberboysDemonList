-- Community update: formal clans, public activity, player battle metadata and all-time Hall of Fame.
-- The Worker also bootstraps these tables lazily on first use; keep this migration for schema history.
CREATE TABLE IF NOT EXISTS community_clans (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE COLLATE NOCASE,
    tag TEXT NOT NULL UNIQUE COLLATE NOCASE,
    description TEXT NOT NULL DEFAULT '',
    accent_color TEXT NOT NULL DEFAULT '#a855f7',
    owner_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS community_clan_members (
    clan_id TEXT NOT NULL REFERENCES community_clans(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner','officer','member')),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','member')),
    requested_at TEXT NOT NULL DEFAULT (datetime('now')),
    joined_at TEXT,
    PRIMARY KEY (clan_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_community_clan_members_clan_status
    ON community_clan_members (clan_id, status, role);

CREATE TABLE IF NOT EXISTS community_activity (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_key TEXT NOT NULL UNIQUE,
    event_type TEXT NOT NULL,
    actor_user_id TEXT,
    actor_name TEXT NOT NULL,
    message TEXT NOT NULL,
    metadata_json TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_community_activity_created
    ON community_activity (created_at DESC, id DESC);

-- Permanent compact Top 10 snapshots are intentionally not deleted by the 730-day rank-history retention task.
CREATE TABLE IF NOT EXISTS community_hall_snapshots (
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
);
CREATE INDEX IF NOT EXISTS idx_community_hall_rank_date
    ON community_hall_snapshots (rank, snapshot_date DESC);

CREATE TABLE IF NOT EXISTS community_hall_snapshot_runs (
    snapshot_date TEXT PRIMARY KEY,
    player_count INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS community_player_records (
    player_key TEXT PRIMARY KEY,
    player_name TEXT NOT NULL,
    best_rank INTEGER NOT NULL,
    best_rank_date TEXT NOT NULL,
    best_points REAL NOT NULL DEFAULT 0,
    best_points_date TEXT NOT NULL,
    first_seen TEXT NOT NULL,
    last_seen TEXT NOT NULL
);
