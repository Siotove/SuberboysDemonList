# Suberboys Demon List — Profile Studio Upgrade

This package adds a large set of profile customisation options to the existing Vue app, plus a public `/players/:name` showcase page and public leaderboard identity chips.

## What's included

- **249-country nationality selector**, including flag emoji; nationality is optional and hidden publicly by default.
- **Clan/team display**: clan name, tag, and self-declared role (Leader, Co-leader, Officer, Member, Recruit). These are display labels only: this upgrade does not create a verified clan registry, membership system, or clan invitations.
- **Profile text**: optional display-name override, profile title, tagline, status, 240-character bio, main gamemode, favourite level, and HTTPS website link.
- **Appearance**: 14 accent colours, 8 banner styles, 5 card themes, and 5 border styles. These settings combine into 697,200 possible appearance presets before considering text choices.
- **Privacy controls** for nationality, clan, title, tagline, status, bio, gamemode, favourite level, and website.
- A live preview on `/profile`, plus a public player showcase at `/players/<leaderboard-name>`.
- Leaderboard rows show public country/clan/title metadata and link to each player's showcase page.
- Server-side validation and D1 persistence. The feature does not require R2 or another paid storage service.

## Install

**Back up/commit the current repository first.** The integration script patches existing files instead of replacing `worker.js` or `Profile.js` wholesale. It checks for expected anchors and exits without writing files if the current repo has drifted from the version it was built for.

### 1. Extract this ZIP into the repository root

Preserve the directories `js/`, `css/`, and `migrations/`. The package adds:

- `js/profile-customization-options.js`
- `js/pages/PlayerShowcase.js`
- `css/pages/player-showcase.css`
- `migrations/0003_player_customizations.sql`
- `apply_profile_customization.py`

### 2. Apply the D1 migration BEFORE deploying the Worker

From the repository root, run:

```bash
npx wrangler d1 execute suberboys-accounts --remote --file=migrations/0003_player_customizations.sql
```

This creates the `player_customizations` table in the existing `suberboys-accounts` database. It is written with `IF NOT EXISTS`, so rerunning the migration is safe. Alternatively, run the SQL file contents in the Cloudflare D1 Console for that database.

### 3. Apply the integration script

```bash
python apply_profile_customization.py
```

The script updates `js/pages/Profile.js`, `js/pages/Leaderboard.js`, `js/routes.js`, `worker.js`, `index.html`, `css/pages/profile.css`, and `css/pages/leaderboard.css`.

If it reports an unexpected anchor or a partial/older install, it stops without writing the staged changes. Do not force it; compare the named current files first. It is safe to run a second time after a successful installation; the script will report that the upgrade is already installed.

### 4. Check and deploy

```bash
node --check worker.js
node --check js/pages/Profile.js
node --check js/pages/Leaderboard.js
node --check js/pages/PlayerShowcase.js
node --check js/profile-customization-options.js
```

Review `git diff`, then commit and push to `main` for the existing Cloudflare deploy pipeline.

## Privacy and validation

- Nationality is blank by default and its public toggle is off by default.
- Website links must be valid HTTPS URLs; only approved colours, banners, themes, borders, gamemodes and clan roles are stored.
- Display text is capped server-side and rendered with Vue text interpolation rather than HTML.
- The clan name/tag/role are self-declared and do not prove membership of an official clan.
- A blank profile remains valid. Public pages use safe defaults if an identity has no customisation row.

## Tests performed here

- JavaScript syntax checks on the generated frontend/Worker integration fixture.
- SQLite execution of the migration twice (idempotency).
- SQLite execution of the customisation upsert with 26 bound values.
- SQLite execution of the augmented public leaderboard profile query.

This is not a live deployment test. The migration and app still need to be applied/tested against your own Cloudflare D1 instance.
