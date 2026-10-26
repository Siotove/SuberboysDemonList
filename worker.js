
import { handleSubmissionRoute } from "./submission-routes.js";

const SESSION_SECONDS = 60 * 60 * 24 * 7;
const PBKDF2_ITERATIONS = 100000;
const MAX_AVATAR_SIZE = 2 * 1024 * 1024;
const FREE_FRAMES = new Set([
    "angy",
    "appi",
    "hidrog",
    "polish"
]);
import { getAchievements } from "./js/achievements.js";

const FREE_FRAMES = new Set([
    "angy",
    "appi",
    "hidrog",
    "polish"
]);

const FRAME_DEFINITIONS = [
    { id: "angy", requirement: "free" },
    { id: "appi", requirement: "free" },
    { id: "hidrog", requirement: "free" },
    { id: "polish", requirement: "free" },

    { id: "bronze", requirement: "tier", tier: "Bronze" },
    { id: "silver", requirement: "tier", tier: "Silver" },
    { id: "gold", requirement: "tier", tier: "Gold" },
    { id: "diamond", requirement: "tier", tier: "Diamond" },
    { id: "platinum", requirement: "tier", tier: "Platinum" },
    { id: "legendary", requirement: "tier", tier: "Legendary" },

    { id: "fire", requirement: "achievement", achievementId: "complete-5" }
];

function calculateUnlockedFrames(player) {
    const achievements = getAchievements({
        completed: player.completed || [],
        verified: player.verified || [],
        progressed: player.progressed || [],
        packsBeaten: player.packsBeaten || []
    });

    const unlockedTiers = new Set(
        achievements
            .filter(achievement => achievement.unlocked)
            .map(achievement => achievement.tier)
    );

    const unlockedAchievementIds = new Set(
        achievements
            .filter(achievement => achievement.unlocked)
            .map(achievement => achievement.id)
    );

    return FRAME_DEFINITIONS.map(frame => ({
        ...frame,
        unlocked:
            frame.requirement === "free" ||
            (frame.requirement === "tier" &&
                unlockedTiers.has(frame.tier)) ||
            (frame.requirement === "achievement" &&
                unlockedAchievementIds.has(frame.achievementId))
    }));
}
function json(data, status = 200, headers = {}) {
    return Response.json(data, { status, headers });
}

function cookieValue(request, name) {
    const cookies = request.headers.get("Cookie") || "";
    const prefix = `${name}=`;

    const item = cookies
        .split(";")
        .map(value => value.trim())
        .find(value => value.startsWith(prefix));

    return item ? item.slice(prefix.length) : null;
}

function cookieHeader(value, maxAge) {
    return `sb_session=${value}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${maxAge}`;
}

function base64url(bytes) {
    let binary = "";

    for (const byte of bytes) {
        binary += String.fromCharCode(byte);
    }

    return btoa(binary)
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");
}

async function sha256(text) {
    const digest = await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(text)
    );

    return base64url(new Uint8Array(digest));
}

async function hashPassword(password, salt) {
    const key = await crypto.subtle.importKey(
        "raw",
        new TextEncoder().encode(password),
        "PBKDF2",
        false,
        ["deriveBits"]
    );

    const bits = await crypto.subtle.deriveBits(
        {
            name: "PBKDF2",
            hash: "SHA-256",
            salt,
            iterations: PBKDF2_ITERATIONS
        },
        key,
        256
    );

    return base64url(new Uint8Array(bits));
}

async function createPasswordHash(password) {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const hash = await hashPassword(password, salt);

    return `${base64url(salt)}:${hash}`;
}

async function verifyPassword(password, stored) {
    try {
        const [saltText, expected] = stored.split(":");

        if (!saltText || !expected) return false;

        const saltString = atob(
            saltText.replace(/-/g, "+").replace(/_/g, "/") +
            "=".repeat((4 - saltText.length % 4) % 4)
        );

        const salt = Uint8Array.from(
            saltString,
            character => character.charCodeAt(0)
        );

        const actual = await hashPassword(password, salt);

        if (actual.length !== expected.length) return false;

        let difference = 0;

        for (let i = 0; i < actual.length; i++) {
            difference |=
                actual.charCodeAt(i) ^ expected.charCodeAt(i);
        }

        return difference === 0;
    } catch {
        return false;
    }
}

async function currentUser(request, db) {
    const token = cookieValue(request, "sb_session");

    if (!token) return null;

    const tokenHash = await sha256(token);
    const now = Math.floor(Date.now() / 1000);

    const user = await db.prepare(`
        SELECT
            users.id,
            users.username,
            users.created_at,
            users.is_admin,
            users.is_banned,
            users.ban_reason,
            users.banned_at
        FROM sessions
        JOIN users ON users.id = sessions.user_id
        WHERE sessions.token_hash = ?
          AND sessions.expires_at > ?
    `).bind(tokenHash, now).first();

    if (!user || Number(user.is_banned) === 1) return null;

    return user;
}

function validOrigin(request) {
    const origin = request.headers.get("Origin");

    return !origin || origin === new URL(request.url).origin;
}

function isAdmin(user) {
    return !!user && Number(user.is_admin) === 1;
}

async function requireAdmin(request, env) {
    const user = await currentUser(request, env.db);

    if (!user) {
        return {
            user: null,
            response: json(
                { error: "Please log in." },
                401,
                { "Cache-Control": "no-store" }
            )
        };
    }

    if (!isAdmin(user)) {
        return {
            user: null,
            response: json(
                { error: "Admin access required." },
                403,
                { "Cache-Control": "no-store" }
            )
        };
    }

    return { user, response: null };
}

async function readPublishedLevels(env, origin) {
    const response = await env.ASSETS.fetch(
        new Request(new URL("/data/_list.json", origin))
    );

    if (!response.ok) {
        throw new Error("Could not read leaderboard list.");
    }

    const files = await response.json();

    if (!Array.isArray(files)) {
        throw new Error("Invalid leaderboard list.");
    }

    return files;
}

async function readPublishedLevel(env, origin, file) {
    if (
        typeof file !== "string" ||
        !/^[a-zA-Z0-9_-]{1,80}$/.test(file)
    ) {
        throw new Error("Invalid level filename.");
    }

    const response = await env.ASSETS.fetch(
        new Request(
            new URL(`/data/${encodeURIComponent(file)}.json`, origin)
        )
    );

    if (!response.ok) {
        throw new Error(`Could not read level data: ${file}`);
    }

    return response.json();
}

// These match the rounding and scoring functions in score.js.
function leaderboardRound(num) {
    const scale = 3;

    if (!String(num).includes("e")) {
        return +(
            Math.round(num + "e+" + scale) +
            "e-" + scale
        );
    }

    const parts = String(num).split("e");
    const exponent = Number(parts[1]) + scale;
    const sign = exponent > 0 ? "+" : "";

    return +(
        Math.round(Number(parts[0]) + "e" + sign + exponent) +
        "e-" + scale
    );
}

function leaderboardScore(rank, percent, minPercent) {
    if (rank > 150) return 0;
    if (rank > 75 && percent < 100) return 0;

    const points =
        (500 - 400 * Math.pow((rank - 1) / 24, 0.4)) *
        (
            (percent - (minPercent - 1)) /
            (100 - (minPercent - 1))
        );

    return Math.max(leaderboardRound(points), 0);
}

function validUsername(username) {
    return /^[a-zA-Z0-9_]{3,24}$/.test(username);
}


function detectImageType(bytes) {
    // PNG
    if (
        bytes.length >= 8 &&
        bytes[0] === 0x89 &&
        bytes[1] === 0x50 &&
        bytes[2] === 0x4e &&
        bytes[3] === 0x47 &&
        bytes[4] === 0x0d &&
        bytes[5] === 0x0a &&
        bytes[6] === 0x1a &&
        bytes[7] === 0x0a
    ) return "image/png";

    // JPEG
    if (
        bytes.length >= 3 &&
        bytes[0] === 0xff &&
        bytes[1] === 0xd8 &&
        bytes[2] === 0xff
    ) return "image/jpeg";

    // WebP
    if (
        bytes.length >= 12 &&
        String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
        String.fromCharCode(...bytes.slice(8, 12)) === "WEBP"
    ) return "image/webp";

    return null;
}

export default {
    async fetch(request, env) {
        const url = new URL(request.url);
        const path = url.pathname;

        if (path === "/api/test" && request.method === "GET") {
            return json({
                success: true,
                message: "Suberboys backend is running!"
            });
        }

        if (!path.startsWith("/api/")) {
            return env.ASSETS.fetch(request);
        }

        if (!["GET", "POST"].includes(request.method)) {
            return json(
                { error: "Method not allowed" },
                405,
                { Allow: "GET, POST" }
            );
        }

        if (
            request.method === "POST" &&
            !validOrigin(request)
        ) {
            return json({ error: "Invalid request origin." }, 403);
        }

        try {
            // Register an account.
            if (path === "/api/auth/register" && request.method === "POST") {
                let body;

                try {
                    body = await request.json();
                } catch {
                    return json({ error: "Invalid JSON body." }, 400);
                }

                if (!body || typeof body !== "object" || Array.isArray(body)) {
                    return json({ error: "Invalid request body." }, 400);
                }

                const username = String(body.username || "").trim();
                const email = String(body.email || "").trim().toLowerCase();
                const password = String(body.password || "");

                if (!validUsername(username)) {
                    return json({
                        error: "Username must be 3–24 letters, numbers or underscores."
                    }, 400);
                }

                if (
                    email.length > 254 ||
                    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
                ) {
                    return json({ error: "Enter a valid email address." }, 400);
                }

                if (password.length < 12 || password.length > 128) {
                    return json({
                        error: "Password must be between 12 and 128 characters."
                    }, 400);
                }

                const existing = await env.db.prepare(`
                    SELECT id
                    FROM users
                    WHERE username = ? COLLATE NOCASE
                       OR email = ? COLLATE NOCASE
                `).bind(username, email).first();

                if (existing) {
                    return json({
                        error: "That username or email is already registered."
                    }, 409);
                }

                const id = crypto.randomUUID();
                const passwordHash = await createPasswordHash(password);

                try {
                    await env.db.prepare(`
                        INSERT INTO users
                            (id, username, email, password_hash)
                        VALUES (?, ?, ?, ?)
                    `).bind(id, username, email, passwordHash).run();
                } catch (error) {
                    if (/unique constraint/i.test(String(error?.message || ""))) {
                        return json({
                            error: "That username or email is already registered."
                        }, 409);
                    }

                    throw error;
                }

                return json({
                    success: true,
                    message: "Account created. You can now log in."
                }, 201);
            }

            // Log in.
            if (path === "/api/auth/login" && request.method === "POST") {
                let body;

                try {
                    body = await request.json();
                } catch {
                    return json({ error: "Invalid JSON body." }, 400);
                }

                if (!body || typeof body !== "object" || Array.isArray(body)) {
                    return json({ error: "Invalid request body." }, 400);
                }

                const email = String(body.email || "").trim().toLowerCase();
                const password = String(body.password || "");

                const user = await env.db.prepare(`
                    SELECT id, username, email, password_hash, is_banned
                    FROM users
                    WHERE email = ? COLLATE NOCASE
                `).bind(email).first();

                if (
                    !user ||
                    !(await verifyPassword(password, user.password_hash))
                ) {
                    return json({
                        error: "Invalid email or password."
                    }, 401);
                }

                if (Number(user.is_banned) === 1) {
                    return json({
                        error: "This account has been banned.",
                        banned: true
                    }, 403, {
                        "Cache-Control": "no-store"
                    });
                }

                const token = base64url(
                    crypto.getRandomValues(new Uint8Array(32))
                );

                const tokenHash = await sha256(token);
                const expiresAt =
                    Math.floor(Date.now() / 1000) + SESSION_SECONDS;

                await env.db.prepare(`
                    INSERT INTO sessions
                        (token_hash, user_id, expires_at)
                    VALUES (?, ?, ?)
                `).bind(tokenHash, user.id, expiresAt).run();

                return json({
                    success: true,
                    user: { username: user.username }
                }, 200, {
                    "Set-Cookie": cookieHeader(token, SESSION_SECONDS),
                    "Cache-Control": "no-store"
                });
            }

            // Current user.
            if (path === "/api/auth/me" && request.method === "GET") {
                const user = await currentUser(request, env.db);

                return json({ user }, 200, {
                    "Cache-Control": "no-store"
                });
            }

            // Log out.
            if (path === "/api/auth/logout" && request.method === "POST") {
                const token = cookieValue(request, "sb_session");

                if (token) {
                    await env.db.prepare(`
                        DELETE FROM sessions
                        WHERE token_hash = ?
                    `).bind(await sha256(token)).run();
                }

                return json({ success: true }, 200, {
                    "Set-Cookie": cookieHeader("", 0),
                    "Cache-Control": "no-store"
                });
            }

            // Avatar frames: list unlocked frames and the currently equipped frame.
            if (path === "/api/profile/frames" && request.method === "GET") {
                const user = await currentUser(request, env.db);
                if (!user) return json({ error: "Please log in." }, 401, { "Cache-Control": "no-store" });
                const profile = await env.db.prepare(`SELECT leaderboard_name FROM leaderboard_profiles WHERE user_id = ?`).bind(user.id).first();
                const saved = await env.db.prepare(`SELECT equipped_frame FROM profile_settings WHERE user_id = ?`).bind(user.id).first();
                const playerData = profile?.leaderboard_name ? await getProfilePlayerData(env, url.origin, profile.leaderboard_name) : null;
                const frames = playerData ? calculateUnlockedFrames(playerData) : FRAME_DEFINITIONS.map(frame => ({ ...frame, unlocked: FREE_FRAMES.has(frame.id) }));
                const savedId = saved?.equipped_frame || null;
                const equipped = frames.find(frame => frame.id === savedId && frame.unlocked);
                return json({ frames, equippedFrame: equipped ? equipped.id : null }, 200, { "Cache-Control": "no-store" });
            }

            // Equip an unlocked avatar frame.
            if (path === "/api/profile/frames" && request.method === "POST") {
                const user = await currentUser(request, env.db);
                if (!user) return json({ error: "Please log in." }, 401, { "Cache-Control": "no-store" });
                let body;
                try { body = await request.json(); } catch { return json({ error: "Invalid JSON body." }, 400); }
                const frameId = body && typeof body.frameId === "string" ? body.frameId : "";
                if (!FRAME_DEFINITIONS.some(frame => frame.id === frameId)) return json({ error: "Invalid frame." }, 400);
                const profile = await env.db.prepare(`SELECT leaderboard_name FROM leaderboard_profiles WHERE user_id = ?`).bind(user.id).first();
                const playerData = profile?.leaderboard_name ? await getProfilePlayerData(env, url.origin, profile.leaderboard_name) : null;
                const frames = playerData ? calculateUnlockedFrames(playerData) : FRAME_DEFINITIONS.map(frame => ({ ...frame, unlocked: FREE_FRAMES.has(frame.id) }));
                const frame = frames.find(item => item.id === frameId);
                if (!frame?.unlocked) return json({ error: "You haven't unlocked that frame yet." }, 403, { "Cache-Control": "no-store" });
                await env.db.prepare(`INSERT INTO profile_settings (user_id, equipped_frame) VALUES (?, ?) ON CONFLICT(user_id) DO UPDATE SET equipped_frame = excluded.equipped_frame`).bind(user.id, frameId).run();
                return json({ success: true, equippedFrame: frameId }, 200, { "Cache-Control": "no-store" });
            }

            // Current leaderboard profile.
            if (
                path === "/api/leaderboard/profile" &&
                request.method === "GET"
            ) {
                const user = await currentUser(request, env.db);

                if (!user) {
                    return json({ error: "Please log in." }, 401, {
                        "Cache-Control": "no-store"
                    });
                }

                const profile = await env.db.prepare(`
                    SELECT leaderboard_name
                    FROM leaderboard_profiles
                    WHERE user_id = ?
                `).bind(user.id).first();

                return json({ profile: profile || null }, 200, {
                    "Cache-Control": "no-store"
                });
            }

            // Join the leaderboard.
            if (
                path === "/api/leaderboard/join" &&
                request.method === "POST"
            ) {
                const user = await currentUser(request, env.db);

                if (!user) {
                    return json({ error: "Please log in." }, 401);
                }

                let body;

                try {
                    body = await request.json();
                } catch {
                    return json({ error: "Invalid JSON body." }, 400);
                }

                const leaderboardName =
                    typeof body?.leaderboardName === "string"
                        ? body.leaderboardName.trim()
                        : "";

                if (
                    leaderboardName.length < 1 ||
                    leaderboardName.length > 24 ||
                    /[\u0000-\u001F\u007F]/.test(leaderboardName)
                ) {
                    return json({
                        error: "Leaderboard names must be 1–24 characters."
                    }, 400);
                }

                const existingProfile = await env.db.prepare(`
                    SELECT leaderboard_name
                    FROM leaderboard_profiles
                    WHERE user_id = ?
                `).bind(user.id).first();

                if (existingProfile) {
                    return json({
                        error: "Your account already has a leaderboard identity."
                    }, 409);
                }

                if (await existingLeaderboardName(env, url.origin, leaderboardName)) {
                    return json({
                        error: "That name belongs to an existing leaderboard player. Contact an admin to link it."
                    }, 409);
                }

                const duplicate = await env.db.prepare(`
                    SELECT id
                    FROM leaderboard_profiles
                    WHERE leaderboard_name = ? COLLATE NOCASE
                `).bind(leaderboardName).first();

                if (duplicate) {
                    return json({
                        error: "That leaderboard name is already taken."
                    }, 409);
                }

                try {
                    await env.db.prepare(`
                        INSERT INTO leaderboard_profiles
                            (id, user_id, leaderboard_name)
                        VALUES (?, ?, ?)
                    `).bind(
                        crypto.randomUUID(),
                        user.id,
                        leaderboardName
                    ).run();
                } catch (error) {
                    if (/unique constraint/i.test(String(error?.message || ""))) {
                        return json({
                            error: "That account or leaderboard name is already linked."
                        }, 409);
                    }

                    throw error;
                }

                return json({
                    success: true,
                    profile: { leaderboard_name: leaderboardName }
                }, 201, {
                    "Cache-Control": "no-store"
                });
            }

            // Public avatar and equipped-frame data for leaderboard players.
            if (
                path === "/api/leaderboard/avatar-frames" &&
                request.method === "GET"
            ) {
                
const result = await env.db.prepare(`
    SELECT
        leaderboard_profiles.leaderboard_name,
        profile_settings.equipped_frame,
        profile_pictures.user_id AS picture_user_id
    FROM leaderboard_profiles
    LEFT JOIN profile_settings
        ON profile_settings.user_id = leaderboard_profiles.user_id
    LEFT JOIN profile_pictures
        ON profile_pictures.user_id = leaderboard_profiles.user_id
`).all();


                const profiles = (result.results || []).map(profile => {
                    const frameId = profile.equipped_frame || null;
                    const frame = FRAME_DEFINITIONS.find(
                        item => item.id === frameId
                    );

                    return {
                        leaderboard_name: profile.leaderboard_name,
                        
avatar_url: profile.picture_user_id
    ? `/api/profile/avatar?name=${encodeURIComponent(profile.leaderboard_name)}`
    : "/assets/profile/No%20PFP.png",

                        equipped_frame: frame ? frame.id : null,
                        frame_url: frame ? frame.image : null
                    };
                });

                return json(
                    { profiles },
                    200,
                    { "Cache-Control": "no-cache" }
                );
            }

            // Public list of known leaderboard identities.
            if (
                path === "/api/leaderboard/identities" &&
                request.method === "GET"
            ) {
                const identities = await allKnownIdentities(env, url.origin);

                return json({ identities }, 200, {
                    "Cache-Control": "no-store"
                });
            }

            // Player leaderboard stats.
            if (
                path === "/api/leaderboard/stats" &&
                request.method === "GET"
            ) {
                const user = await currentUser(request, env.db);

                if (!user) {
                    return json({ error: "Please log in." }, 401, {
                        "Cache-Control": "no-store"
                    });
                }

                const profile = await env.db.prepare(`
                    SELECT leaderboard_name
                    FROM leaderboard_profiles
                    WHERE user_id = ?
                `).bind(user.id).first();

                if (!profile?.leaderboard_name) {
                    return json({
                        error: "Link your leaderboard identity first."
                    }, 400, { "Cache-Control": "no-store" });
                }

                const files = await readPublishedLevels(env, url.origin);
                const playerKey =
                    profile.leaderboard_name.toLocaleLowerCase("en");

                const completed = new Map();
                let totalLevels = 0;

                const rankRanges = {
                    "Top 10": 0,
                    "11–25": 0,
                    "26–50": 0,
                    "51+": 0
                };

                for (let index = 0; index < files.length; index++) {
                    const file = files[index];

                    if (
                        typeof file !== "string" ||
                        !/^[a-zA-Z0-9_-]{1,80}$/.test(file)
                    ) {
                        continue;
                    }

                    const level = await readPublishedLevel(env, url.origin, file);
                    const rank = index + 1;
                    totalLevels++;

                    if (!Array.isArray(level.records)) continue;

                    const requiredPercent = Number(level.percentToQualify ?? 100);

                    const record = level.records.find(item =>
                        typeof item.user === "string" &&
                        item.user.trim().toLocaleLowerCase("en") === playerKey &&
                        Number.isFinite(Number(item.percent)) &&
                        Number(item.percent) >= requiredPercent
                    );

                    if (!record || completed.has(file)) continue;

                    completed.set(file, {
                        file,
                        name: level.name || file,
                        rank,
                        percent: Number(record.percent)
                    });

                    if (rank <= 10) rankRanges["Top 10"]++;
                    else if (rank <= 25) rankRanges["11–25"]++;
                    else if (rank <= 50) rankRanges["26–50"]++;
                    else rankRanges["51+"]++;
                }

                const completions = [...completed.values()].sort(
                    (a, b) => a.rank - b.rank
                );

                return json({
                    leaderboardName: profile.leaderboard_name,
                    totalCompletions: completions.length,
                    totalLevels,
                    completionPercentage: totalLevels
                        ? Number(
                            (completions.length / totalLevels * 100).toFixed(1)
                        )
                        : 0,
                    hardest: completions[0] || null,
                    rankRanges
                }, 200, {
                    "Cache-Control": "no-store"
                });
            }

            // Compare accepted completions between two players.
            if (
                path === "/api/leaderboard/compare" &&
                request.method === "GET"
            ) {
                const user = await currentUser(request, env.db);

                if (!user) {
                    return json({ error: "Please log in." }, 401, {
                        "Cache-Control": "no-store"
                    });
                }

                const ownProfile = await env.db.prepare(`
                    SELECT leaderboard_name
                    FROM leaderboard_profiles
                    WHERE user_id = ?
                `).bind(user.id).first();

                if (!ownProfile?.leaderboard_name) {
                    return json({
                        error: "Link your leaderboard identity first."
                    }, 400, { "Cache-Control": "no-store" });
                }

                const opponent = (url.searchParams.get("opponent") || "").trim();

                if (!opponent || opponent.length > 100) {
                    return json({
                        error: "Choose a leaderboard player to compare."
                    }, 400, { "Cache-Control": "no-store" });
                }

                if (
                    opponent.toLocaleLowerCase("en") ===
                    ownProfile.leaderboard_name.toLocaleLowerCase("en")
                ) {
                    return json({
                        error: "Choose a different player."
                    }, 400, { "Cache-Control": "no-store" });
                }

                const files = await readPublishedLevels(env, url.origin);
                const ownKey = ownProfile.leaderboard_name.toLocaleLowerCase("en");
                const opponentKey = opponent.toLocaleLowerCase("en");

                const identities = new Map();
                const ownLevels = new Map();
                const opponentLevels = new Map();

                for (let index = 0; index < files.length; index++) {
                    const file = files[index];

                    if (
                        typeof file !== "string" ||
                        !/^[a-zA-Z0-9_-]{1,80}$/.test(file)
                    ) {
                        continue;
                    }

                    const level = await readPublishedLevel(env, url.origin, file);

                    if (!Array.isArray(level.records)) continue;

                    const requiredPercent = Number(level.percentToQualify ?? 100);
                    const rank = index + 1;

                    for (const record of level.records) {
                        if (typeof record.user !== "string") continue;

                        const name = record.user.trim();
                        if (!name) continue;

                        const key = name.toLocaleLowerCase("en");

                        if (!identities.has(key)) identities.set(key, name);

                        if (
                            !Number.isFinite(Number(record.percent)) ||
                            Number(record.percent) < requiredPercent
                        ) {
                            continue;
                        }

                        const entry = {
                            file,
                            name: level.name || file,
                            rank,
                            percent: Number(record.percent),
                            link: typeof record.link === "string"
                                ? record.link
                                : ""
                        };

                        if (key === ownKey && !ownLevels.has(file)) {
                            ownLevels.set(file, entry);
                        }

                        if (key === opponentKey && !opponentLevels.has(file)) {
                            opponentLevels.set(file, entry);
                        }
                    }
                }

                const canonicalOpponent = identities.get(opponentKey);

                if (!canonicalOpponent) {
                    return json({
                        error: "That player has no records on the current list."
                    }, 404, { "Cache-Control": "no-store" });
                }

                const own = [...ownLevels.values()].sort((a, b) => a.rank - b.rank);
                const theirs = [...opponentLevels.values()].sort((a, b) => a.rank - b.rank);

                return json({
                    ownName: ownProfile.leaderboard_name,
                    opponentName: canonicalOpponent,
                    identities: [...identities.values()].sort((a, b) =>
                        a.localeCompare(b, undefined, { sensitivity: "base" })
                    ),
                    ownCount: own.length,
                    opponentCount: theirs.length,
                    ownHardest: own[0] || null,
                    opponentHardest: theirs[0] || null,
                    shared: own.filter(level => opponentLevels.has(level.file)),
                    ownUnique: own.filter(level => !opponentLevels.has(level.file)),
                    opponentUnique: theirs.filter(level => !ownLevels.has(level.file))
                }, 200, { "Cache-Control": "no-store" });
            }

            // Verify admin access.
            if (path === "/api/admin/me" && request.method === "GET") {
                const auth = await requireAdmin(request, env);

                if (auth.response) return auth.response;

                return json({
                    admin: true,
                    username: auth.user.username
                }, 200, { "Cache-Control": "no-store" });
            }

            // Admin: list accounts and leaderboard identities.
            if (
                path === "/api/admin/players" &&
                request.method === "GET"
            ) {
                const auth = await requireAdmin(request, env);

                if (auth.response) return auth.response;

                const result = await env.db.prepare(`
                    SELECT
                        users.id,
                        users.username,
                        users.email,
                        users.created_at,
                        users.is_admin,
                        users.is_banned,
                        users.ban_reason,
                        users.banned_at,
                        leaderboard_profiles.leaderboard_name
                    FROM users
                    LEFT JOIN leaderboard_profiles
                        ON leaderboard_profiles.user_id = users.id
                    ORDER BY users.username COLLATE NOCASE
                `).all();

                const identities = await allKnownIdentities(env, url.origin);

                return json({
                    players: result.results,
                    identities
                }, 200, { "Cache-Control": "no-store" });
            }

            // Admin: link, change or unlink a player's leaderboard identity.
            if (
                path === "/api/admin/players/link" &&
                request.method === "POST"
            ) {
                const auth = await requireAdmin(request, env);

                if (auth.response) return auth.response;

                let body;

                try {
                    body = await request.json();
                } catch {
                    return json({ error: "Invalid JSON body." }, 400);
                }

                const userId = typeof body?.userId === "string"
                    ? body.userId
                    : "";

                const requestedName = typeof body?.leaderboardName === "string"
                    ? body.leaderboardName.trim()
                    : "";

                if (!userId || userId.length > 128) {
                    return json({ error: "Choose a valid account." }, 400);
                }

                if (
                    requestedName.length > 24 ||
                    /[\u0000-\u001F\u007F]/.test(requestedName)
                ) {
                    return json({
                        error: "Leaderboard names must be 1–24 characters."
                    }, 400);
                }

                const targetUser = await env.db.prepare(`
                    SELECT id
                    FROM users
                    WHERE id = ?
                `).bind(userId).first();

                if (!targetUser) {
                    return json({ error: "Account not found." }, 404);
                }

                if (!requestedName) {
                    await env.db.prepare(`
                        DELETE FROM leaderboard_profiles
                        WHERE user_id = ?
                    `).bind(userId).run();

                    return json({
                        success: true,
                        leaderboardName: null
                    }, 200, { "Cache-Control": "no-store" });
                }

                const staticNames = await allLeaderboardNames(env, url.origin);

                const known = staticNames.find(name =>
                    name.toLocaleLowerCase("en") ===
                    requestedName.toLocaleLowerCase("en")
                );

                const linkedNames = await env.db.prepare(`
                    SELECT leaderboard_name
                    FROM leaderboard_profiles
                `).all();

                const linked = linkedNames.results.find(row =>
                    row.leaderboard_name.toLocaleLowerCase("en") ===
                    requestedName.toLocaleLowerCase("en")
                );

                if (!known && !linked) {
                    return json({
                        error: "That name is not an existing leaderboard identity."
                    }, 400);
                }

                const canonicalName = known || linked.leaderboard_name;

                const claimed = await env.db.prepare(`
                    SELECT user_id
                    FROM leaderboard_profiles
                    WHERE leaderboard_name = ? COLLATE NOCASE
                      AND user_id <> ?
                `).bind(canonicalName, userId).first();

                if (claimed) {
                    return json({
                        error: "That identity is already linked to another account."
                    }, 409);
                }

                const current = await env.db.prepare(`
                    SELECT id
                    FROM leaderboard_profiles
                    WHERE user_id = ?
                `).bind(userId).first();

                try {
                    if (current) {
                        await env.db.prepare(`
                            UPDATE leaderboard_profiles
                            SET leaderboard_name = ?
                            WHERE user_id = ?
                        `).bind(canonicalName, userId).run();
                    } else {
                        await env.db.prepare(`
                            INSERT INTO leaderboard_profiles
                                (id, user_id, leaderboard_name)
                            VALUES (?, ?, ?)
                        `).bind(
                            crypto.randomUUID(),
                            userId,
                            canonicalName
                        ).run();
                    }
                } catch (error) {
                    if (/unique constraint/i.test(String(error?.message || ""))) {
                        return json({
                            error: "That account or identity is already linked."
                        }, 409);
                    }

                    throw error;
                }

                return json({
                    success: true,
                    leaderboardName: canonicalName
                }, 200, { "Cache-Control": "no-store" });
            }

            // Admin: ban or unban an account.
            if (
                path === "/api/admin/players/ban" &&
                request.method === "POST"
            ) {
                const auth = await requireAdmin(request, env);

                if (auth.response) return auth.response;

                let body;

                try {
                    body = await request.json();
                } catch {
                    return json({ error: "Invalid JSON body." }, 400);
                }

                const userId = typeof body?.userId === "string"
                    ? body.userId
                    : "";

                const action = typeof body?.action === "string"
                    ? body.action
                    : "";

                const reason = typeof body?.reason === "string"
                    ? body.reason.trim()
                    : "";

                if (!userId || userId.length > 128) {
                    return json({ error: "Choose a valid account." }, 400);
                }

                if (!["ban", "unban"].includes(action)) {
                    return json({
                        error: "Action must be ban or unban."
                    }, 400);
                }

                if (reason.length > 500) {
                    return json({
                        error: "Ban reason must be 500 characters or fewer."
                    }, 400);
                }

                const target = await env.db.prepare(`
                    SELECT id, username, is_admin, is_banned
                    FROM users
                    WHERE id = ?
                `).bind(userId).first();

                if (!target) {
                    return json({ error: "Account not found." }, 404);
                }

                if (Number(target.is_admin) === 1) {
                    return json({
                        error: "Admin accounts cannot be banned through this endpoint."
                    }, 403);
                }

                if (action === "ban") {
                    if (Number(target.is_banned) === 1) {
                        return json({
                            success: true,
                            message: "Account is already banned."
                        });
                    }

                    await env.db.prepare(`
                        UPDATE users
                        SET is_banned = 1,
                            ban_reason = ?,
                            banned_at = ?
                        WHERE id = ?
                    `).bind(
                        reason || "No reason provided",
                        Math.floor(Date.now() / 1000),
                        userId
                    ).run();

                    await env.db.prepare(`
                        DELETE FROM sessions
                        WHERE user_id = ?
                    `).bind(userId).run();

                    return json({
                        success: true,
                        message: `${target.username} has been banned.`
                    }, 200, { "Cache-Control": "no-store" });
                }

                await env.db.prepare(`
                    UPDATE users
                    SET is_banned = 0,
                        ban_reason = NULL,
                        banned_at = NULL
                    WHERE id = ?
                `).bind(userId).run();

                return json({
                    success: true,
                    message: `${target.username} has been unbanned.`
                }, 200, { "Cache-Control": "no-store" });
            }

            // Upload or replace the logged-in user's profile picture.
            if (
                path === "/api/profile/avatar" &&
                request.method === "POST"
            ) {
                const user = await currentUser(request, env.db);

                if (!user) {
                    return json({ error: "Please log in." }, 401, {
                        "Cache-Control": "no-store"
                    });
                }

                if (!env.PROFILE_IMAGES) {
                    return json({
                        error: "Profile image storage is not configured."
                    }, 503);
                }

                const declaredLength = Number(
                    request.headers.get("Content-Length") || 0
                );

                if (declaredLength > MAX_AVATAR_SIZE + 100_000) {
                    return json({
                        error: "Image must be 2 MB or smaller."
                    }, 413);
                }

                let form;
                try {
                    form = await request.formData();
                } catch {
                    return json({ error: "Invalid upload." }, 400);
                }

                const image = form.get("image");

                if (
                    !image ||
                    typeof image.arrayBuffer !== "function" ||
                    typeof image.size !== "number"
                ) {
                    return json({
                        error: "Choose an image to upload."
                    }, 400);
                }

                if (image.size < 1 || image.size > MAX_AVATAR_SIZE) {
                    return json({
                        error: "Image must be between 1 byte and 2 MB."
                    }, 413);
                }

                const allowedTypes = [
                    "image/png",
                    "image/jpeg",
                    "image/webp"
                ];

                if (!allowedTypes.includes(image.type)) {
                    return json({
                        error: "Only PNG, JPEG, and WebP images are allowed."
                    }, 400);
                }

                const bytes = new Uint8Array(
                    await image.arrayBuffer()
                );

                const detectedType = detectImageType(bytes);

                if (!detectedType || detectedType !== image.type) {
                    return json({
                        error: "The image file is invalid or its type does not match."
                    }, 400);
                }

                const old = await env.db.prepare(`
                    SELECT object_key
                    FROM profile_pictures
                    WHERE user_id = ?
                `).bind(user.id).first();

                const extension = {
                    "image/png": "png",
                    "image/jpeg": "jpg",
                    "image/webp": "webp"
                }[detectedType];

                const objectKey =
                    `${user.id}/${crypto.randomUUID()}.${extension}`;

                await env.PROFILE_IMAGES.put(objectKey, bytes, {
                    httpMetadata: {
                        contentType: detectedType,
                        cacheControl: "public, max-age=3600"
                    }
                });

                try {
                    await env.db.prepare(`
                        INSERT INTO profile_pictures
                            (user_id, object_key, updated_at)
                        VALUES (?, ?, ?)
                        ON CONFLICT(user_id) DO UPDATE SET
                            object_key = excluded.object_key,
                            updated_at = excluded.updated_at
                    `).bind(
                        user.id,
                        objectKey,
                        Math.floor(Date.now() / 1000)
                    ).run();
                } catch (error) {
                    await env.PROFILE_IMAGES.delete(objectKey);
                    throw error;
                }

                if (old?.object_key && old.object_key !== objectKey) {
                    await env.PROFILE_IMAGES.delete(old.object_key);
                }

                return json({
                    success: true,
                    avatarUrl: `/api/profile/avatar?name=${encodeURIComponent(
                        (await env.db.prepare(`
                            SELECT leaderboard_name
                            FROM leaderboard_profiles
                            WHERE user_id = ?
                        `).bind(user.id).first())?.leaderboard_name || ""
                    )}&v=${Date.now()}`
                }, 200, { "Cache-Control": "no-store" });
            }

            // Publicly serve a player's uploaded avatar.
            if (
                path === "/api/profile/avatar" &&
                request.method === "GET"
            ) {
                if (!env.PROFILE_IMAGES) {
                    return new Response("Image storage unavailable.", {
                        status: 503
                    });
                }

                const name = (
                    url.searchParams.get("name") || ""
                ).trim();

                if (!name || name.length > 100) {
                    return new Response("Not found.", { status: 404 });
                }

                const profile = await env.db.prepare(`
                    SELECT profile_pictures.object_key
                    FROM leaderboard_profiles
                    JOIN profile_pictures
                        ON profile_pictures.user_id =
                           leaderboard_profiles.user_id
                    WHERE leaderboard_profiles.leaderboard_name = ?
                      COLLATE NOCASE
                `).bind(name).first();

                if (!profile?.object_key) {
                    return env.ASSETS.fetch(
                        new Request(
                            new URL("/assets/profile/No%20PFP.png", url.origin)
                        )
                    );
                }

                const object = await env.PROFILE_IMAGES.get(
                    profile.object_key
                );

                if (!object) {
                    return new Response("Not found.", { status: 404 });
                }

                const headers = new Headers();
                object.writeHttpMetadata(headers);
                headers.set("ETag", object.httpEtag);
                headers.set("X-Content-Type-Options", "nosniff");
                headers.set("Cache-Control", "public, max-age=3600");

                return new Response(object.body, { headers });
            }

            // Delegate submission history, review queue, approval and level
            // difficulty management to submission-routes.js.
            const submissionResponse = await handleSubmissionRoute(
                request,
                env,
                url,
                { json, currentUser }
            );

            if (submissionResponse) return submissionResponse;

            return json({ error: "Not found." }, 404);
        } catch (error) {
            console.error(
                "Account API error:",
                error?.stack || error
            );

            return json({
                error: "Server error. Please try again.",
                requestId: crypto.randomUUID()
            }, 500, {
                "Cache-Control": "no-store"
            });
        }
    }
};
