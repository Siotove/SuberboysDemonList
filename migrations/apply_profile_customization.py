#!/usr/bin/env python3
"""Integrate the Suberboys Demon List profile-customization upgrade.

Run from the repository root with: python apply_profile_customization.py
The script stages edits in memory first and writes only after every anchor was found.
It never overwrites worker.js/Profile.js with a separate template; it patches the current files.
"""
from pathlib import Path
import re
import sys

ROOT = Path.cwd()
required = [
    'js/pages/Profile.js', 'js/pages/Leaderboard.js', 'js/routes.js',
    'worker.js', 'index.html', 'css/pages/profile.css', 'css/pages/leaderboard.css',
]
missing = [p for p in required if not (ROOT / p).is_file()]
if missing:
    print('ERROR: run this script from the repository root; missing:')
    print('\n'.join('  ' + p for p in missing))
    sys.exit(1)

files = {p: (ROOT / p).read_text(encoding='utf-8') for p in required}
# Safe rerun guard: the script writes only after all transformations succeed, and this
# guard avoids duplicating controls/routes if the user reruns it after a successful apply.
installed_markers = [
    'pc-customizer' in files['js/pages/Profile.js'],
    'path === "/api/profile/customization"' in files['worker.js'],
    'player_customizations.country_code AS custom_country_code' in files['worker.js'],
    "./pages/PlayerShowcase.js" in files['js/routes.js'],
    'Player identity metadata from the profile studio' in files['css/pages/leaderboard.css'],
]
if all(installed_markers):
    print('Profile customization upgrade is already installed; nothing changed.')
    sys.exit(0)
if any(installed_markers):
    print('ERROR: this repository appears to have a partial/older version of the upgrade.')
    print('No files were changed. Compare the current files with the package instructions before retrying.')
    sys.exit(1)
changes = {}

def once_replace(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f'{label}: expected exactly one anchor, found {count}')
    return text.replace(old, new, 1)

# 1) Add shared country/style options and fix profile avatar reactivity.
profile = files['js/pages/Profile.js']
if "../profile-customization-options.js" not in profile:
    imports = "import { PROFILE_CUSTOMIZATION_DEFAULTS, COUNTRY_OPTIONS, ACCENT_OPTIONS, BANNER_OPTIONS, THEME_OPTIONS, BORDER_OPTIONS, GAMEMODE_OPTIONS, CLAN_ROLE_OPTIONS } from '../profile-customization-options.js';\n"
    profile = imports + profile
profile = profile.replace('src="/assets/profile/No%20PFP.png"\n                        alt="Profile picture"', ':src="profilePictureUrl"\n                        alt="Profile picture"', 1)

panel = r'''<!-- Expanded profile customisation -->
                <section class="profile-panel profile-customization-panel pc-customizer" :style="{ '--pc-accent': customization.accent_color }">
                    <p class="profile-eyebrow">MAKE IT YOURS</p>
                    <h2>Profile Studio</h2>
                    <p class="profile-muted">Your nationality is optional. Clan details are self-declared display information, not verified clan membership. Use the visibility switches to control what appears publicly.</p>

                    <div class="pc-preview" :class="['pc-theme-' + customization.profile_theme, 'pc-banner-' + customization.banner_style, 'pc-border-' + customization.border_style]" :style="{ '--pc-accent': customization.accent_color }">
                        <div class="pc-preview-banner"><span>SUBERBOYS DEMON LIST</span><span class="pc-preview-chip">LIVE PREVIEW</span></div>
                        <div class="pc-preview-body">
                            <div class="pc-preview-avatar"><img :src="profilePictureUrl" alt=""><img v-if="equippedFrameImage" :src="equippedFrameImage" alt="" class="pc-preview-frame"></div>
                            <div class="pc-preview-identity">
                                <p class="pc-preview-topline"><span v-if="customization.show_nationality && customization.country_code">{{ countryFlag(customization.country_code) }} {{ countryLabel(customization.country_code) }}</span><span v-if="customization.show_clan && customization.clan_name">{{ customization.clan_tag ? '[' + customization.clan_tag + '] ' : '' }}{{ customization.clan_name }}<small v-if="customization.clan_role"> · {{ customization.clan_role }}</small></span></p>
                                <h3>{{ customization.display_name || leaderboardProfile?.leaderboard_name || user?.username || 'Your display name' }}</h3>
                                <p v-if="customization.show_title && customization.profile_title" class="pc-preview-title">{{ customization.profile_title }}</p>
                                <p v-if="customization.show_tagline && customization.tagline" class="pc-preview-tagline">{{ customization.tagline }}</p>
                                <p v-if="customization.show_status && customization.status" class="pc-preview-status">● {{ customization.status }}</p>
                            </div>
                        </div>
                        <p v-if="customization.show_bio && customization.bio" class="pc-preview-bio">{{ customization.bio }}</p>
                        <div class="pc-preview-facts"><span v-if="customization.show_gamemode && customization.main_gamemode !== 'All-around'">Main: {{ customization.main_gamemode }}</span><span v-if="customization.show_favorite_level && customization.favorite_level">Favourite: {{ customization.favorite_level }}</span><span v-if="customization.show_website && customization.website_url">Website link set ↗</span></div>
                    </div>

                    <form class="pc-form" @submit.prevent="saveCustomization">
                        <div class="pc-form-heading"><h3>Identity</h3><span>Optional public details</span></div>
                        <div class="pc-form-grid">
                            <label class="pc-field"><span>Display name</span><input v-model.trim="customization.display_name" maxlength="24" placeholder="Use your leaderboard name"></label>
                            <label class="pc-field"><span>Nationality / country</span><select v-model="customization.country_code"><option v-for="country in customizationCountries" :key="country.value" :value="country.value">{{ country.value ? countryFlag(country.value) + ' ' : '' }}{{ country.label }}</option></select></label>
                            <label class="pc-field"><span>Clan / team name</span><input v-model.trim="customization.clan_name" maxlength="32" placeholder="e.g. Suberboys"></label>
                            <label class="pc-field"><span>Clan tag (8 characters max)</span><input v-model.trim="customization.clan_tag" maxlength="8" placeholder="SBDL"></label>
                            <label class="pc-field"><span>Clan role</span><select v-model="customization.clan_role"><option v-for="role in customizationClanRoles" :key="role.value" :value="role.value">{{ role.label }}</option></select></label>
                            <label class="pc-field"><span>Profile title</span><input v-model.trim="customization.profile_title" maxlength="32" placeholder="Wave grinder, verifier…"></label>
                            <label class="pc-field"><span>Tagline</span><input v-model.trim="customization.tagline" maxlength="64" placeholder="One line about your playstyle"></label>
                            <label class="pc-field"><span>Status</span><input v-model.trim="customization.status" maxlength="40" placeholder="Grinding top 20"></label>
                            <label class="pc-field"><span>Main gamemode</span><select v-model="customization.main_gamemode"><option v-for="mode in customizationGamemodes" :key="mode.value" :value="mode.value">{{ mode.label }}</option></select></label>
                            <label class="pc-field"><span>Favourite level</span><input v-model.trim="customization.favorite_level" maxlength="80" placeholder="Your favourite level"></label>
                            <label class="pc-field pc-field-full"><span>Bio</span><textarea v-model.trim="customization.bio" maxlength="240" rows="3" placeholder="Tell the community a little about your Geometry Dash journey…"></textarea><small>{{ customization.bio.length }}/240 characters</small></label>
                            <label class="pc-field pc-field-full"><span>Website or public link (HTTPS)</span><input v-model.trim="customization.website_url" type="url" maxlength="240" placeholder="https://example.com"></label>
                        </div>

                        <div class="pc-form-heading"><h3>Appearance</h3><span>Mix and match your style</span></div>
                        <div class="pc-form-grid">
                            <label class="pc-field"><span>Accent colour</span><select v-model="customization.accent_color"><option v-for="colour in customizationAccents" :key="colour.value" :value="colour.value">{{ colour.label }}</option></select></label>
                            <label class="pc-field"><span>Banner style</span><select v-model="customization.banner_style"><option v-for="banner in customizationBanners" :key="banner.value" :value="banner.value">{{ banner.label }}</option></select></label>
                            <label class="pc-field"><span>Card theme</span><select v-model="customization.profile_theme"><option v-for="theme in customizationThemes" :key="theme.value" :value="theme.value">{{ theme.label }}</option></select></label>
                            <label class="pc-field"><span>Card border</span><select v-model="customization.border_style"><option v-for="border in customizationBorders" :key="border.value" :value="border.value">{{ border.label }}</option></select></label>
                        </div>

                        <div class="pc-form-heading"><h3>Privacy and visibility</h3><span>Change what other players can see</span></div>
                        <div class="pc-visibility-grid">
                            <label><input type="checkbox" v-model="customization.show_nationality"><span>Show nationality</span></label>
                            <label><input type="checkbox" v-model="customization.show_clan"><span>Show clan</span></label>
                            <label><input type="checkbox" v-model="customization.show_title"><span>Show title</span></label>
                            <label><input type="checkbox" v-model="customization.show_tagline"><span>Show tagline</span></label>
                            <label><input type="checkbox" v-model="customization.show_status"><span>Show status</span></label>
                            <label><input type="checkbox" v-model="customization.show_bio"><span>Show bio</span></label>
                            <label><input type="checkbox" v-model="customization.show_gamemode"><span>Show main gamemode</span></label>
                            <label><input type="checkbox" v-model="customization.show_favorite_level"><span>Show favourite level</span></label>
                            <label><input type="checkbox" v-model="customization.show_website"><span>Show public link</span></label>
                        </div>
                        <div class="pc-save-row"><p v-if="customizationMessage" role="status" class="profile-message">{{ customizationMessage }}</p><div><button type="button" class="profile-secondary-button" @click="resetCustomization" :disabled="customizationSaving">Reset defaults</button><button type="submit" class="profile-primary-button" :disabled="customizationSaving || customizationLoading">{{ customizationSaving ? 'Saving…' : 'Save profile style' }}</button></div></div>
                    </form>
                </section>
                <!-- Leaderboard identity -->'''
profile = once_replace(profile, '<!-- Leaderboard identity -->', panel, 'Profile customizer template insertion')

profile = once_replace(profile, '            availableFrames: [', '''            customization: { ...PROFILE_CUSTOMIZATION_DEFAULTS },
            customizationLoading: false,
            customizationSaving: false,
            customizationMessage: '',
            customizationCountries: COUNTRY_OPTIONS,
            customizationAccents: ACCENT_OPTIONS,
            customizationBanners: BANNER_OPTIONS,
            customizationThemes: THEME_OPTIONS,
            customizationBorders: BORDER_OPTIONS,
            customizationGamemodes: GAMEMODE_OPTIONS,
            customizationClanRoles: CLAN_ROLE_OPTIONS,
            availableFrames: [''', 'Profile state insertion')

# Ensure the form reflects stored values when the account is loaded.
profile = once_replace(profile, '                await this.loadLeaderboardProfile();', '                await this.loadCustomization();\n                await this.loadLeaderboardProfile();', 'Profile mounted load insertion')

custom_methods = r'''        countryFlag(code) {
            const value = String(code || '').toUpperCase();
            if (!/^[A-Z]{2}$/.test(value)) return '';
            return String.fromCodePoint(...[...value].map(char => 127397 + char.charCodeAt(0)));
        },
        countryLabel(code) {
            const country = this.customizationCountries.find(item => item.value === String(code || '').toUpperCase());
            return country ? country.label : '';
        },
        async loadCustomization() {
            this.customizationLoading = true;
            this.customizationMessage = '';
            try {
                const response = await fetch('/api/profile/customization', { credentials: 'same-origin', cache: 'no-store' });
                const result = await response.json();
                if (!response.ok) throw new Error(result.error || 'Could not load profile settings.');
                this.customization = { ...PROFILE_CUSTOMIZATION_DEFAULTS, ...(result.customization || {}) };
            } catch (error) {
                this.customizationMessage = error.message || 'Could not load profile settings.';
            } finally {
                this.customizationLoading = false;
            }
        },
        async saveCustomization() {
            if (this.customizationSaving) return;
            this.customizationSaving = true;
            this.customizationMessage = '';
            try {
                const response = await fetch('/api/profile/customization', {
                    method: 'POST',
                    credentials: 'same-origin',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(this.customization)
                });
                const result = await response.json();
                if (!response.ok) throw new Error(result.error || 'Could not save profile settings.');
                this.customization = { ...PROFILE_CUSTOMIZATION_DEFAULTS, ...(result.customization || {}) };
                this.customizationMessage = 'Profile customisation saved! Your public profile and leaderboard details will use these settings.';
            } catch (error) {
                this.customizationMessage = error.message || 'Could not save profile settings.';
            } finally {
                this.customizationSaving = false;
            }
        },
        async resetCustomization() {
            this.customization = { ...PROFILE_CUSTOMIZATION_DEFAULTS };
            await this.saveCustomization();
        },
'''
profile, profile_method_count = re.subn(r'(^\s*methods:\s*\{)', lambda match: match.group(1) + '\n' + custom_methods, profile, count=1, flags=re.M)
if profile_method_count != 1: raise RuntimeError('Profile customization methods anchor not found')
changes['js/pages/Profile.js'] = profile

# 2) Register public showcase route.
routes = files['js/routes.js']
if "./pages/PlayerShowcase.js" not in routes:
    routes = once_replace(routes, "import Profile from './pages/Profile.js';", "import Profile from './pages/Profile.js';\nimport PlayerShowcase from './pages/PlayerShowcase.js';", 'Showcase import')
if "path: '/players/:name'" not in routes:
    routes = once_replace(routes, "    { path: '/profile', component: Profile },", "    { path: '/players/:name', component: PlayerShowcase },\n    { path: '/profile', component: Profile },", 'Showcase route')
changes['js/routes.js'] = routes

# 3) Leaderboard shows nationality/clan metadata and a link to the public player page.
leader = files['js/pages/Leaderboard.js']
if "profile-customization-options.js" not in leader:
    leader = once_replace(leader, "import { getAchievements } from '../achievements.js';", "import { getAchievements } from '../achievements.js';\nimport { countryFlag, countryName } from '../profile-customization-options.js';", 'Leaderboard options import')
leader = once_replace(leader, '<span class="type-label-lg">{{ ientry.user }}</span>', '''<span class="leaderboard-player-details">
            <span class="type-label-lg">{{ avatarFor(ientry).displayName || ientry.user }}</span>
            <span v-if="avatarFor(ientry).profileTitle" class="leaderboard-player-title" :style="{ color: avatarFor(ientry).accentColor }">{{ avatarFor(ientry).profileTitle }}</span>
            <span class="leaderboard-player-meta">
                <span v-if="avatarFor(ientry).countryCode">{{ countryFlag(avatarFor(ientry).countryCode) }} {{ countryName(avatarFor(ientry).countryCode) }}</span>
                <span v-if="avatarFor(ientry).clanName">{{ avatarFor(ientry).clanTag ? '[' + avatarFor(ientry).clanTag + '] ' : '' }}{{ avatarFor(ientry).clanName }}{{ avatarFor(ientry).clanRole ? ' · ' + avatarFor(ientry).clanRole : '' }}</span>
            </span>
        </span>''', 'Leaderboard player metadata')
leader, link_count = re.subn(r'</button>\s*</td>\s*</tr>', '''</button>\n    <router-link class="leaderboard-profile-shortcut" :to="playerProfileRoute(ientry.user)" @click.stop>Profile ↗</router-link>\n</td>\n    </tr>''', leader, count=1)
if link_count != 1: raise RuntimeError('Leaderboard public profile link anchor not found')
if 'playerProfileRoute(playerName)' not in leader:
    leader, method_count = re.subn(r'methods:\s*\{\s*localize,', '''methods: {\n     countryFlag,\n     countryName,\n     playerProfileRoute(playerName) {\n         return '/players/' + encodeURIComponent(String(playerName || ''));\n     },\n     localize,''', leader, count=1)
    if method_count != 1: raise RuntimeError('Leaderboard helper method anchor not found')
leader, avatar_count = re.subn(
    r"return\s*\{\s*pfp:\s*profile\?\.avatar_url\s*\|\|\s*'/assets/profile/No%20PFP\.png',\s*frame:\s*frames\[profile\?\.equipped_frame\]\s*\|\|\s*null,?\s*\};",
    "return {\n            pfp: profile?.avatar_url || '/assets/profile/No%20PFP.png',\n            frame: profile?.frame_url || frames[profile?.equipped_frame] || null,\n            displayName: profile?.display_name || '',\n            countryCode: profile?.country_code || '',\n            clanName: profile?.clan_name || '',\n            clanTag: profile?.clan_tag || '',\n            profileTitle: profile?.profile_title || '',\n            accentColor: profile?.accent_color || '#a855f7',\n        };", leader, count=1)
if avatar_count != 1: raise RuntimeError('Leaderboard avatar metadata anchor not found')
changes['js/pages/Leaderboard.js'] = leader

# 4) Worker endpoints, persistence, validation, and public display fields.
worker = files['worker.js']
custom_api = r'''// Player customisation settings. Profile text is stored as plain text and returned through JSON.
if (path === "/api/profile/customization" && ["GET", "POST"].includes(request.method)) {
    const user = await currentUser(request, env.db);
    if (!user) return json({ error: "Please log in." }, 401, { "Cache-Control": "no-store" });

    const defaults = {
        display_name: "", country_code: "", clan_name: "", clan_tag: "", clan_role: "Member",
        profile_title: "", tagline: "", status: "", bio: "", main_gamemode: "All-around", favorite_level: "",
        accent_color: "#a855f7", banner_style: "aurora", profile_theme: "midnight", border_style: "glow", website_url: "",
        show_nationality: false, show_clan: true, show_title: true, show_tagline: true, show_status: true,
        show_bio: true, show_gamemode: true, show_favorite_level: false, show_website: false
    };
    const clientShape = row => {
        const value = { ...defaults, ...(row || {}) };
        for (const key of ["show_nationality", "show_clan", "show_title", "show_tagline", "show_status", "show_bio", "show_gamemode", "show_favorite_level", "show_website"]) {
            value[key] = Boolean(value[key]);
        }
        delete value.user_id;
        delete value.updated_at;
        return value;
    };

    if (request.method === "GET") {
        const row = await env.db.prepare("SELECT * FROM player_customizations WHERE user_id = ?").bind(user.id).first();
        return json({ customization: clientShape(row) }, 200, { "Cache-Control": "no-store" });
    }

    let body;
    try { body = await request.json(); } catch { return json({ error: "Invalid JSON body." }, 400); }
    if (!body || typeof body !== "object" || Array.isArray(body)) return json({ error: "Invalid customization payload." }, 400);

    const clean = (value, max) => typeof value === "string"
        ? value.normalize("NFKC").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").trim().slice(0, max)
        : "";
    const enumValue = (value, allowed, fallback) => allowed.includes(value) ? value : fallback;
    const countryCode = clean(body.country_code, 2).toUpperCase();
    if (countryCode && !/^[A-Z]{2}$/.test(countryCode)) return json({ error: "Choose a country from the list." }, 400);
    const clanTagInput = clean(body.clan_tag, 9).replace(/^#/, "").toUpperCase();
    if (clanTagInput && !/^[A-Z0-9_]{1,8}$/.test(clanTagInput)) return json({ error: "Clan tags can contain up to 8 letters, numbers or underscores." }, 400);

    const accents = ["#a855f7", "#6366f1", "#3b82f6", "#06b6d4", "#14b8a6", "#22c55e", "#84cc16", "#eab308", "#f97316", "#ef4444", "#ec4899", "#f43f5e", "#e2e8f0", "#94a3b8"];
    const banners = ["aurora", "nebula", "ocean", "sunset", "forest", "grid", "prism", "monochrome"];
    const themes = ["midnight", "obsidian", "arcade", "dawn", "deep-sea"];
    const borders = ["glow", "soft", "solid", "double", "dashed"];
    const gamemodes = ["All-around", "Wave", "Ship", "Cube", "Robot", "Ball", "UFO", "Spider", "Swing"];
    const clanRoles = ["Leader", "Co-leader", "Officer", "Member", "Recruit"];
    let websiteUrl = clean(body.website_url, 240);
    if (websiteUrl) {
        try {
            const parsed = new URL(websiteUrl);
            if (parsed.protocol !== "https:" || parsed.username || parsed.password) throw new Error("bad URL");
            websiteUrl = parsed.href;
        } catch {
            return json({ error: "Website link must be a valid HTTPS URL." }, 400);
        }
    }
    const saved = {
        display_name: clean(body.display_name, 24),
        country_code: countryCode,
        clan_name: clean(body.clan_name, 32),
        clan_tag: clanTagInput,
        clan_role: enumValue(body.clan_role, clanRoles, "Member"),
        profile_title: clean(body.profile_title, 32),
        tagline: clean(body.tagline, 64),
        status: clean(body.status, 40),
        bio: (typeof body.bio === "string" ? body.bio.normalize("NFKC").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").trim().slice(0, 240) : ""),
        main_gamemode: enumValue(body.main_gamemode, gamemodes, "All-around"),
        favorite_level: clean(body.favorite_level, 80),
        accent_color: enumValue(body.accent_color, accents, defaults.accent_color),
        banner_style: enumValue(body.banner_style, banners, defaults.banner_style),
        profile_theme: enumValue(body.profile_theme, themes, defaults.profile_theme),
        border_style: enumValue(body.border_style, borders, defaults.border_style),
        website_url: websiteUrl,
        show_nationality: body.show_nationality === true ? 1 : 0,
        show_clan: body.show_clan === true ? 1 : 0,
        show_title: body.show_title === true ? 1 : 0,
        show_tagline: body.show_tagline === true ? 1 : 0,
        show_status: body.show_status === true ? 1 : 0,
        show_bio: body.show_bio === true ? 1 : 0,
        show_gamemode: body.show_gamemode === true ? 1 : 0,
        show_favorite_level: body.show_favorite_level === true ? 1 : 0,
        show_website: body.show_website === true ? 1 : 0
    };
    await env.db.prepare(`
        INSERT INTO player_customizations (
            user_id, display_name, country_code, clan_name, clan_tag, clan_role, profile_title, tagline, status, bio,
            main_gamemode, favorite_level, accent_color, banner_style, profile_theme, border_style, website_url,
            show_nationality, show_clan, show_title, show_tagline, show_status, show_bio, show_gamemode,
            show_favorite_level, show_website, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
        ON CONFLICT(user_id) DO UPDATE SET
            display_name=excluded.display_name, country_code=excluded.country_code, clan_name=excluded.clan_name,
            clan_tag=excluded.clan_tag, clan_role=excluded.clan_role, profile_title=excluded.profile_title,
            tagline=excluded.tagline, status=excluded.status, bio=excluded.bio, main_gamemode=excluded.main_gamemode,
            favorite_level=excluded.favorite_level, accent_color=excluded.accent_color, banner_style=excluded.banner_style,
            profile_theme=excluded.profile_theme, border_style=excluded.border_style, website_url=excluded.website_url,
            show_nationality=excluded.show_nationality, show_clan=excluded.show_clan, show_title=excluded.show_title,
            show_tagline=excluded.show_tagline, show_status=excluded.show_status, show_bio=excluded.show_bio,
            show_gamemode=excluded.show_gamemode, show_favorite_level=excluded.show_favorite_level,
            show_website=excluded.show_website, updated_at=datetime('now')
    `).bind(
        user.id, saved.display_name, saved.country_code, saved.clan_name, saved.clan_tag, saved.clan_role,
        saved.profile_title, saved.tagline, saved.status, saved.bio, saved.main_gamemode, saved.favorite_level,
        saved.accent_color, saved.banner_style, saved.profile_theme, saved.border_style, saved.website_url,
        saved.show_nationality, saved.show_clan, saved.show_title, saved.show_tagline, saved.show_status,
        saved.show_bio, saved.show_gamemode, saved.show_favorite_level, saved.show_website
    ).run();
    return json({ success: true, customization: clientShape(saved) }, 200, { "Cache-Control": "no-store" });
}

'''
if 'path === "/api/profile/customization"' not in worker:
    worker = once_replace(worker, '// Avatar frames: list unlocked frames and the currently equipped frame.', custom_api + '// Avatar frames: list unlocked frames and the currently equipped frame.', 'Worker customization API insertion')

# Extend public avatar-frame query without changing existing avatar/frame fields.
if 'player_customizations.custom_country_code' not in worker:
    worker, n = re.subn(
        r'(profile_pictures\.updated_at AS picture_updated_at)(\s+FROM leaderboard_profiles)',
        r'''\1,
player_customizations.display_name AS custom_display_name,
player_customizations.country_code AS custom_country_code,
player_customizations.clan_name AS custom_clan_name,
player_customizations.clan_tag AS custom_clan_tag,
player_customizations.clan_role AS custom_clan_role,
player_customizations.profile_title AS custom_profile_title,
player_customizations.tagline AS custom_tagline,
player_customizations.status AS custom_status,
player_customizations.bio AS custom_bio,
player_customizations.main_gamemode AS custom_main_gamemode,
player_customizations.favorite_level AS custom_favorite_level,
player_customizations.accent_color AS custom_accent_color,
player_customizations.banner_style AS custom_banner_style,
player_customizations.profile_theme AS custom_profile_theme,
player_customizations.border_style AS custom_border_style,
player_customizations.website_url AS custom_website_url,
player_customizations.show_nationality,
player_customizations.show_clan,
player_customizations.show_title,
player_customizations.show_tagline,
player_customizations.show_status,
player_customizations.show_bio,
player_customizations.show_gamemode,
player_customizations.show_favorite_level,
player_customizations.show_website\2''', worker, count=1)
    if n != 1: raise RuntimeError('Worker public customization SELECT anchor not found')
    worker, n = re.subn(
        r'(LEFT JOIN profile_pictures\s+ON profile_pictures\.user_id = leaderboard_profiles\.user_id)(\s+`)',
        r'''\1
LEFT JOIN player_customizations
ON player_customizations.user_id = leaderboard_profiles.user_id\2''', worker, count=1)
    if n != 1: raise RuntimeError('Worker public customization JOIN anchor not found')
    public_fields = r'''frame_url: frame ? frame.image : null,
            display_name: profile.custom_display_name || '',
            country_code: profile.show_nationality ? (profile.custom_country_code || '') : '',
            clan_name: profile.show_clan ? (profile.custom_clan_name || '') : '',
            clan_tag: profile.show_clan ? (profile.custom_clan_tag || '') : '',
            clan_role: profile.show_clan ? (profile.custom_clan_role || '') : '',
            profile_title: profile.show_title ? (profile.custom_profile_title || '') : '',
            tagline: profile.show_tagline ? (profile.custom_tagline || '') : '',
            status: profile.show_status ? (profile.custom_status || '') : '',
            bio: profile.show_bio ? (profile.custom_bio || '') : '',
            main_gamemode: profile.show_gamemode ? (profile.custom_main_gamemode || 'All-around') : '',
            favorite_level: profile.show_favorite_level ? (profile.custom_favorite_level || '') : '',
            accent_color: profile.custom_accent_color || '#a855f7',
            banner_style: profile.custom_banner_style || 'aurora',
            profile_theme: profile.custom_profile_theme || 'midnight',
            border_style: profile.custom_border_style || 'glow',
            website_url: profile.show_website ? (profile.custom_website_url || '') : ''
'''
    worker, n = re.subn(r'frame_url: frame \? frame\.image : null(\s*)', public_fields + r'\1', worker, count=1)
    if n != 1: raise RuntimeError('Worker public customization response anchor not found')
changes['worker.js'] = worker

# 5) Load CSS, add leaderboard details style, and include public profile styling.
index = files['index.html']
if 'player-showcase.css' not in index:
    index = once_replace(index, '<link rel="stylesheet" href="/css/pages/profile.css" />', '<link rel="stylesheet" href="/css/pages/profile.css" />\n        <link rel="stylesheet" href="/css/pages/player-showcase.css" />', 'Showcase CSS include')
changes['index.html'] = index

profile_css = files['css/pages/profile.css']
custom_css = r'''

/* Expanded profile studio */
.profile-page .pc-customizer { --pc-accent: var(--color-primary); }
.pc-preview { overflow: hidden; margin: 1.25rem 0 1.75rem; border: 1px solid color-mix(in srgb, var(--pc-accent) 45%, transparent); border-radius: 1rem; background: #151621; color: #f8fafc; }
.pc-preview-banner { display: flex; justify-content: space-between; gap: 1rem; min-height: 72px; align-items: flex-start; padding: 1rem 1.1rem; background: linear-gradient(115deg, color-mix(in srgb, var(--pc-accent) 58%, #111827), #111827 75%); font-size: .72rem; font-weight: 800; letter-spacing: .13em; }
.pc-preview-chip { padding: .3rem .5rem; border: 1px solid #ffffff30; border-radius: 999px; font-size: .62rem; letter-spacing: .08em; }
.pc-banner-nebula .pc-preview-banner { background: radial-gradient(circle at 75% 35%, #8b5cf688, transparent 40%), linear-gradient(120deg, #18122e, #101827); }
.pc-banner-ocean .pc-preview-banner { background: linear-gradient(120deg, #064e72, #0f172a 70%); }
.pc-banner-sunset .pc-preview-banner { background: linear-gradient(120deg, #9a3412, #7c2d5d 48%, #111827); }
.pc-banner-forest .pc-preview-banner { background: linear-gradient(120deg, #14532d, #064e3b 45%, #111827); }
.pc-banner-grid .pc-preview-banner { background-color: #131326; background-image: linear-gradient(#ffffff0e 1px, transparent 1px), linear-gradient(90deg, #ffffff0e 1px, transparent 1px), linear-gradient(120deg, color-mix(in srgb, var(--pc-accent) 40%, transparent), #111827); background-size: 20px 20px, 20px 20px, auto; }
.pc-banner-prism .pc-preview-banner { background: linear-gradient(115deg, #312e81, #7e22ce 34%, #be185d 67%, #0f172a); }
.pc-banner-monochrome .pc-preview-banner { background: linear-gradient(120deg, #52525b, #18181b 75%); }
.pc-preview-body { display: flex; align-items: center; gap: 1rem; padding: 1.1rem; }
.pc-preview-avatar { position: relative; width: 80px; height: 80px; flex: 0 0 80px; overflow: hidden; border-radius: 50%; outline: 3px solid var(--pc-accent); outline-offset: 2px; background: #242424; }
.pc-preview-avatar > img { display: block; width: 100%; height: 100%; border-radius: 50%; object-fit: cover; }
.pc-preview-avatar > .pc-preview-frame { position: absolute; inset: 0; object-fit: contain; }
.pc-preview-identity { min-width: 0; }
.pc-preview-identity h3 { margin: .2rem 0; font-size: 1.25rem; overflow-wrap: anywhere; color: inherit; }
.pc-preview-topline { display: flex; flex-wrap: wrap; gap: .4rem; margin: 0; font-size: .75rem; color: #d7d9e7; }
.pc-preview-topline span { padding: .2rem .4rem; border: 1px solid #ffffff20; border-radius: 999px; }
.pc-preview-title { display: inline-block; margin: .2rem 0; color: var(--pc-accent); font-weight: 800; font-size: .85rem; }
.pc-preview-tagline { margin: .15rem 0; color: #c7c9d6; font-size: .85rem; }
.pc-preview-status { margin: .2rem 0 0; color: #86efac; font-size: .8rem; }
.pc-preview-bio { margin: 0 1.1rem .8rem; color: #c7c9d6; line-height: 1.55; white-space: pre-wrap; overflow-wrap: anywhere; }
.pc-preview-facts { display: flex; flex-wrap: wrap; gap: .45rem; padding: 0 1.1rem 1rem; }
.pc-preview-facts span { padding: .3rem .45rem; background: #ffffff0e; border-radius: .4rem; color: #d3d5e0; font-size: .75rem; }
.pc-theme-obsidian { background: #0e0f12; }
.pc-theme-arcade { background: #11112a; }
.pc-theme-dawn { background: #f8f5f0; color: #292332; }
.pc-theme-dawn .pc-preview-topline, .pc-theme-dawn .pc-preview-tagline, .pc-theme-dawn .pc-preview-bio, .pc-theme-dawn .pc-preview-facts span { color: #62596d; }
.pc-theme-deep-sea { background: #0c222b; }
.pc-border-soft { border-width: 1px; }
.pc-border-solid { border: 2px solid var(--pc-accent); }
.pc-border-double { border: 4px double var(--pc-accent); }
.pc-border-dashed { border: 2px dashed var(--pc-accent); }
.pc-form { display: flex; flex-direction: column; gap: 1.1rem; }
.pc-form-heading { display: flex; flex-wrap: wrap; align-items: baseline; justify-content: space-between; gap: .5rem; padding-bottom: .5rem; border-bottom: 1px solid var(--color-background-hover); }
.pc-form-heading h3 { margin: 0; }
.pc-form-heading > span { font-size: .8rem; color: var(--color-on-background); opacity: .7; }
.pc-form-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: .9rem; }
.pc-field { display: flex; min-width: 0; flex-direction: column; gap: .4rem; font-size: .88rem; font-weight: 700; }
.pc-field > input, .pc-field > select, .pc-field > textarea { width: 100%; min-width: 0; min-height: 42px; padding: .65rem .75rem; border: 1px solid var(--color-background-hover); border-radius: .55rem; background: var(--color-background); color: var(--color-on-background); font: inherit; font-weight: 400; }
.pc-field > textarea { resize: vertical; line-height: 1.5; }
.pc-field small { font-size: .75rem; font-weight: 400; opacity: .7; text-align: right; }
.pc-field-full { grid-column: 1 / -1; }
.pc-visibility-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: .65rem; }
.pc-visibility-grid label { display: flex; align-items: center; gap: .5rem; min-height: 42px; padding: .65rem .75rem; border: 1px solid var(--color-background-hover); border-radius: .55rem; font-size: .83rem; cursor: pointer; }
.pc-visibility-grid input { accent-color: var(--pc-accent); }
.pc-save-row { display: flex; justify-content: space-between; align-items: flex-end; flex-wrap: wrap; gap: .75rem; }
.pc-save-row > div { display: flex; flex-wrap: wrap; gap: .6rem; }
@media (max-width: 650px) { .pc-form-grid { grid-template-columns: 1fr; } .pc-field-full { grid-column: auto; } .pc-visibility-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } .pc-preview-body { align-items: flex-start; } .pc-preview-avatar { width: 64px; height: 64px; flex-basis: 64px; } }
'''
if 'Expanded profile studio' not in profile_css:
    profile_css += custom_css
changes['css/pages/profile.css'] = profile_css

leader_css = files['css/pages/leaderboard.css']
leaderboard_css = r'''

/* Player identity metadata from the profile studio */
.leaderboard-player-details { display: flex; flex: 1 1 auto; min-width: 0; flex-direction: column; align-items: flex-start; gap: .12rem; text-align: left; }
.leaderboard-player-details > .type-label-lg { max-width: 100%; overflow-wrap: anywhere; }
.leaderboard-player-title { font-size: .72rem; line-height: 1.25; font-weight: 800; }
.leaderboard-player-meta { display: flex; flex-wrap: wrap; gap: .25rem .55rem; min-width: 0; color: var(--color-on-background); opacity: .7; font-size: .68rem; line-height: 1.25; }
.leaderboard-profile-shortcut { display: inline-flex; align-items: center; margin-left: .45rem; padding: .3rem .45rem; border: 1px solid var(--color-background-hover); border-radius: .4rem; color: var(--color-primary); font-size: .72rem; font-weight: 700; text-decoration: none; white-space: nowrap; }
.leaderboard-profile-shortcut:hover { text-decoration: underline; }
'''
if 'Player identity metadata from the profile studio' not in leader_css:
    leader_css += leaderboard_css
changes['css/pages/leaderboard.css'] = leader_css

# 6) Verify the companion files are present, and then atomically-ish write staged changes.
new_required = ['js/profile-customization-options.js', 'js/pages/PlayerShowcase.js', 'css/pages/player-showcase.css', 'migrations/0003_player_customizations.sql']
missing_new = [p for p in new_required if not (ROOT / p).is_file()]
if missing_new:
    print('ERROR: extracted package contents are incomplete:')
    print('\n'.join('  ' + p for p in missing_new))
    sys.exit(1)

# All transformations have succeeded; now write every file.
for path, content in changes.items():
    (ROOT / path).write_text(content, encoding='utf-8')
print('Profile customization upgrade applied.')
print('Updated:')
for path in changes:
    print('  ' + path)
print('Added (already in package):')
for path in new_required:
    print('  ' + path)
print('\nNext: apply migrations/0003_player_customizations.sql to the REMOTE D1 database before deploying worker.js.')
