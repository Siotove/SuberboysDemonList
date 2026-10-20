CREATE TABLE IF NOT EXISTS submissions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    type TEXT NOT NULL
        CHECK (type IN ('completion', 'verification')),
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN (
            'pending',
            'processing',
            'approved',
            'rejected',
            'failed'
        )),
    payload TEXT NOT NULL,
    reviewed_by TEXT,
    reviewed_at TEXT,
    github_commit TEXT,
    error_message TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_submissions_status
    ON submissions(status, created_at);

CREATE INDEX IF NOT EXISTS idx_submissions_user
    ON submissions(user_id, created_at);
