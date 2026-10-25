
CREATE TABLE IF NOT EXISTS profile_preferences (
    user_id TEXT PRIMARY KEY,
    equipped_frame TEXT,
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
