SUBERBOYS DEMON LIST — PROFILE STUDIO UPGRADE

Includes nationality/flag, clan/team name/tag/role, custom display name, title, tagline, status, bio, main gamemode, favourite level, HTTPS link, 14 colours, 8 banner styles, 5 themes, 5 border options, visibility toggles, leaderboard metadata and a public /players/:name showcase.

IMPORTANT: Clan information is self-declared display text, not verified clan membership. Nationality is optional and hidden publicly by default.

INSTALL STEPS
1. Back up or commit your current repository.
2. Extract the ZIP into the repository root and keep the js/, css/, and migrations/ folders.
3. Apply the migration to your existing Cloudflare D1 database BEFORE deploying worker.js:

   npx wrangler d1 execute suberboys-accounts --remote --file=migrations/0003_player_customizations.sql

   Or execute the SQL file in Cloudflare's D1 Console.

4. From the repository root, run:

   python apply_profile_customization.py

5. Run syntax checks:

   node --check worker.js
   node --check js/pages/Profile.js
   node --check js/pages/Leaderboard.js
   node --check js/pages/PlayerShowcase.js
   node --check js/profile-customization-options.js

6. Review git diff, then commit and push to main.

The script patches the current files and stops if expected code anchors are missing. It does not overwrite the entire worker or profile page. If it stops on an unexpected/partial install, don't force it—inspect the message and compare the relevant file. The script can safely be run a second time after successful integration.

Tests performed: frontend/worker syntax check against a repository-shaped fixture; SQLite migration execution twice; SQL upsert placeholder count; public leaderboard query execution. Live Cloudflare deployment and live database use have not been tested.
