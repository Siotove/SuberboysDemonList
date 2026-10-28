-- In-site notifications, season management and audit history.
-- The Worker also creates these tables lazily, so the site does not require a manual SQL-console step.
CREATE TABLE IF NOT EXISTS competition_notifications (
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
);
CREATE INDEX IF NOT EXISTS idx_competition_notifications_user_unread
    ON competition_notifications(user_id, read_at, created_at);
CREATE TABLE IF NOT EXISTS competition_seasons (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    start_date TEXT NOT NULL,
    end_date TEXT NOT NULL,
    is_active INTEGER NOT NULL DEFAULT 0,
    is_system INTEGER NOT NULL DEFAULT 0,
    created_by TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CHECK (end_date >= start_date)
);
CREATE INDEX IF NOT EXISTS idx_competition_seasons_dates
    ON competition_seasons(start_date, end_date);
CREATE TABLE IF NOT EXISTS competition_admin_audit (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    admin_user_id TEXT NOT NULL,
    admin_username TEXT NOT NULL,
    action TEXT NOT NULL,
    details_json TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_competition_admin_audit_created
    ON competition_admin_audit(created_at);
