
CREATE TABLE IF NOT EXISTS submissions (
    id TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL,
    type TEXT NOT NULL
        CHECK (type IN ('completion', 'verification')),
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (
            status IN (
                'pending',
                'processing',
                'approved',
                'rejected',
                'failed'
            )
        ),
    payload TEXT NOT NULL
        CHECK (json_valid(payload)),
    reviewed_by INTEGER,
    reviewed_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    github_commit TEXT,
    error_message TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (reviewed_by) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_submissions_status_created
ON submissions(status, created_at);

CREATE INDEX IF NOT EXISTS idx_submissions_user_created
ON submissions(user_id, created_at);
