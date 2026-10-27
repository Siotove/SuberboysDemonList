-- Suberboys Demon List: optional public profile customization.
-- Apply to the existing suberboys-accounts D1 database before deploying worker.js.
CREATE TABLE IF NOT EXISTS player_customizations (
    user_id TEXT PRIMARY KEY,
    display_name TEXT NOT NULL DEFAULT '',
    country_code TEXT NOT NULL DEFAULT '',
    clan_name TEXT NOT NULL DEFAULT '',
    clan_tag TEXT NOT NULL DEFAULT '',
    clan_role TEXT NOT NULL DEFAULT 'Member',
    profile_title TEXT NOT NULL DEFAULT '',
    tagline TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT '',
    bio TEXT NOT NULL DEFAULT '',
    main_gamemode TEXT NOT NULL DEFAULT 'All-around',
    favorite_level TEXT NOT NULL DEFAULT '',
    accent_color TEXT NOT NULL DEFAULT '#a855f7',
    banner_style TEXT NOT NULL DEFAULT 'aurora',
    profile_theme TEXT NOT NULL DEFAULT 'midnight',
    border_style TEXT NOT NULL DEFAULT 'glow',
    website_url TEXT NOT NULL DEFAULT '',
    show_nationality INTEGER NOT NULL DEFAULT 0,
    show_clan INTEGER NOT NULL DEFAULT 1,
    show_title INTEGER NOT NULL DEFAULT 1,
    show_tagline INTEGER NOT NULL DEFAULT 1,
    show_status INTEGER NOT NULL DEFAULT 1,
    show_bio INTEGER NOT NULL DEFAULT 1,
    show_gamemode INTEGER NOT NULL DEFAULT 1,
    show_favorite_level INTEGER NOT NULL DEFAULT 0,
    show_website INTEGER NOT NULL DEFAULT 0,
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_player_customizations_country
    ON player_customizations(country_code);
CREATE INDEX IF NOT EXISTS idx_player_customizations_clan
    ON player_customizations(clan_tag, clan_name);
