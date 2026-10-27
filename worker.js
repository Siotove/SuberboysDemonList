
import { handleSubmissionRoute } from "./submission-routes.js";
import { handleRankHistoryQuestRequest, captureDailyRankSnapshot } from "./rank-history-quests-worker.js";

const SESSION_SECONDS = 60 * 60 * 24 * 7;
const PBKDF2_ITERATIONS = 100000;
// D1 limits each row to 2,000,000 bytes; leave room for row metadata.
const MAX_AVATAR_SIZE = 1_500_000;

function json(data, status = 200, headers = {}) {
    return Response.json(data, { status, headers });
}

function cookieValue(request, name) {
    const cookies = request.headers.get("Cookie") || "";
    const prefix = `${name}=`;
    const item = cookies.split(";")
        .map(v => v.trim())
        .find(v => v.startsWith(prefix));

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

    const bits = await crypto.subtle.deriveBits({
        name: "PBKDF2",
        hash: "SHA-256",
        salt,
        iterations: PBKDF2_ITERATIONS
    }, key, 256);

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
            c => c.charCodeAt(0)
        );

        const actual = await hashPassword(password, salt);

        if (actual.length !== expected.length) return false;

        let difference = 0;

        for (let i = 0; i < actual.length; i++) {
            difference |= actual.charCodeAt(i) ^ expected.charCodeAt(i);
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

async function existingLeaderboardName(env, origin, name) {
    const files = await readPublishedLevels(env, origin);

    for (const file of files) {
        if (
            typeof file !== "string" ||
            !/^[a-zA-Z0-9_-]{1,80}$/.test(file)
        ) {
            continue;
        }

        const level = await readPublishedLevel(env, origin, file);

        if (!Array.isArray(level.records)) continue;

        if (level.records.some(record =>
            typeof record.user === "string" &&
            record.user.trim().toLowerCase() === name.toLowerCase()
        )) {
            return true;
        }
    }

    return false;
}

async function allLeaderboardNames(env, origin) {
    const files = await readPublishedLevels(env, origin);
    const names = new Map();

    for (const file of files) {
        if (
            typeof file !== "string" ||
            !/^[a-zA-Z0-9_-]{1,80}$/.test(file)
        ) {
            continue;
        }

        const level = await readPublishedLevel(env, origin, file);

        if (!Array.isArray(level.records)) continue;

        for (const record of level.records) {
            if (typeof record.user !== "string") continue;

            const name = record.user.trim();

            if (!name) continue;

            const key = name.toLocaleLowerCase("en");

            if (!names.has(key)) {
                names.set(key, name);
            }
        }
    }

    return [...names.values()].sort((a, b) =>
        a.localeCompare(b, undefined, { sensitivity: "base" })
    );
}

async function allKnownIdentities(env, origin) {
    const staticNames = await allLeaderboardNames(env, origin);

    const result = await env.db.prepare(`
        SELECT leaderboard_name
        FROM leaderboard_profiles
    `).all();

    const names = new Map();

    for (const name of staticNames) {
        names.set(name.toLocaleLowerCase("en"), name);
    }

    for (const row of result.results || []) {
        if (typeof row.leaderboard_name !== "string") continue;

        const name = row.leaderboard_name.trim();

        if (!name) continue;

        const key = name.toLocaleLowerCase("en");

        if (!names.has(key)) names.set(key, name);
    }

    return [...names.values()].sort((a, b) =>
        a.localeCompare(b, undefined, { sensitivity: "base" })
    );
}


function normaliseLevelKey(value) {
    return typeof value === "string"
        ? value.toLocaleLowerCase("en").replace(/[^a-z0-9]/g, "")
        : "";
}

function valuesMatchPlayer(values, playerKey) {
    return values.some(value =>
        typeof value === "string" &&
        value.trim().toLocaleLowerCase("en") === playerKey
    );
}

function isVerifiedRecord(record) {
    if (!record || typeof record !== "object") return false;
    const flags = [record.verified, record.isVerified, record.is_verified, record.isVerifier, record.is_verifier];
    if (flags.some(value => value === true || value === 1 || (typeof value === "string" && value.toLocaleLowerCase("en") === "true"))) return true;
    return [record.status, record.type, record.kind].some(value =>
        typeof value === "string" && /^(verified|verification)$/i.test(value.trim())
    );
}

const FRAME_DEFINITIONS = [
    { id: "angy", name: "Angy", image: "/assets/profile/Angy.png", requirement: "Available by default." },
    { id: "appi", name: "Appi", image: "/assets/profile/Appi.png", requirement: "Available by default." },
    { id: "borgir", name: "Borgir", image: "/assets/profile/Borgir.png", requirement: "Beat Ice Carbon Zustgame." },
    { id: "bronze", name: "Bronze", image: "/assets/profile/Bronze.png", requirement: "Earn a Bronze achievement." },
    { id: "cool", name: "Cool", image: "/assets/profile/Cool.png", requirement: "Beat NG Wave Reborn 3." },
    { id: "diamond", name: "Diamond", image: "/assets/profile/Diamond.png", requirement: "Earn a Diamond achievement." },
    { id: "fire", name: "Fire Frame", image: "/assets/profile/Fire%20Frame.png", requirement: 'Unlock "I Got This".' },
    { id: "furter", name: "Furter", image: "/assets/profile/Furter.png", requirement: "Complete the Halloween pack." },
    { id: "gold", name: "Gold", image: "/assets/profile/Gold.png", requirement: "Earn a Gold achievement." },
    { id: "hidrog", name: "Hidrog", image: "/assets/profile/Hidrog.png", requirement: "Available by default." },
    { id: "honeycomb", name: "Honeycomb", image: "/assets/profile/Honeycomb.png", requirement: "Beat Casher." },
    { id: "legendary", name: "Legendary", image: "/assets/profile/Legendary.png", requirement: "Earn a Legendary achievement." },
    { id: "platinum", name: "Platinum", image: "/assets/profile/Platinum.png", requirement: "Earn a Platinum achievement." },
    { id: "polish", name: "Polish", image: "/assets/profile/Polish.png", requirement: "Available by default." },
    { id: "punpkin", name: "Punpkin", image: "/assets/profile/Punpkin.png", requirement: "Beat Halloween Panic." },
    { id: "ssjjasaiah", name: "SSJJasaiah", image: "/assets/profile/SSJJasaiah.png", requirement: "Beat Society but No 3." },
    { id: "silver", name: "Silver", image: "/assets/profile/Silver.png", requirement: "Earn a Silver achievement." },
    { id: "victory", name: "Victory", image: "/assets/profile/Victory.png", requirement: "Be #1 on the leaderboard." },
    { id: "wjat", name: "Wjat", image: "/assets/profile/Wjat.png", requirement: "Beat Acheron Easy." },
    { id: "gartyen", name: "Gartyen", image: "/assets/profile/gartyen.png", requirement: "Beat Milestone II." }
];
const FREE_FRAMES = new Set(["angy", "appi", "hidrog", "polish"]);
// Match both the published JSON filename and the visible level title. Names are
// normalised before comparison so spaces, punctuation, and capitalisation do not matter.
const FRAME_LEVEL_PATHS = {
    borgir: ["IceCarbonZustgame", "Ice Carbon Zustgame"],
    cool: ["NGWave", "NG Wave", "NGWaveReborn3", "NG Wave Reborn 3"],
    honeycomb: ["Casher"],
    punpkin: ["HalloweenPanic", "Halloween Panic"],
    ssjjasaiah: ["SocietyButNo3", "Society but No 3"],
    wjat: ["Acheroneasy", "AcheronEasy", "Acheron Easy"],
    gartyen: ["MilestoneII", "Milestone II"]
};
const FRAME_PACKS = [
    { id: "milestone-pack", category: "Bronze", paths: ["MilestoneI", "MilestoneII", "MilestoneIII"] },
    { id: "aina-pack", category: "Bronze", paths: ["AinaPoni", "AinaPoniII"] },
    { id: "polychromatical-pack", category: "Silver", paths: ["Polychromatical", "PolychromaticalII"] },
    { id: "sadaclysm-pack", category: "Silver", paths: ["Sadaclysm", "USadaclysm"] },
    { id: "top-pack", category: "Gold", paths: ["SocietyButNo3", "Polychromatical", "MilestoneIII", "NGWave"] },
    { id: "milee-pack", category: "Bronze", paths: ["Khrome", "cu", "AinaPoniII"] },
    { id: "dfsd", category: "Gold", paths: ["Challenger", "IceCarbonZustgame", "Bang"] },
    { id: "milred", category: "Gold", paths: ["Challenger", "Shadow", "Ultramarine", "Hypermarine"] },
    { id: "spooky", category: "Silver", paths: ["Spookweiner", "SSS", "Trytohide", "HalloweenPanic"] }
];

// Keep these scoring functions in sync with the public leaderboard's score.js.
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
        ((percent - (minPercent - 1)) / (100 - (minPercent - 1)));

    return Math.max(leaderboardRound(points), 0);
}

async function getProfilePlayerData(env, origin, leaderboardName) {
    const files = await readPublishedLevels(env, origin);
    const playerKey = leaderboardName.toLocaleLowerCase("en");
    const completedPaths = new Set();
    const progressedPaths = new Set();
    const verifiedPaths = new Set();
    const completedLevelKeys = new Set();
    const verifiedLevelKeys = new Set();
    const allPlayerPoints = new Map();

    for (let index = 0; index < files.length; index++) {
        const file = files[index];
        if (typeof file !== "string" || !/^[a-zA-Z0-9_-]{1,80}$/.test(file)) continue;

        const level = await readPublishedLevel(env, origin, file);
        if (!Array.isArray(level.records)) continue;

        const levelAliases = [
            file, level.name, level.title, level.levelName, level.level_name,
            level.slug, level.path, level.id, level.level?.name, level.level?.title
        ].filter(value => typeof value === "string" && value.trim());
        const levelKeys = levelAliases.map(normaliseLevelKey).filter(Boolean);

        const rawRequired = Number(level.percentToQualify ?? level.percent_to_qualify ?? 100);
        const required = Number.isFinite(rawRequired) ? rawRequired : 100;
        const playerRecords = level.records.filter(record =>
            typeof record.user === "string" &&
            record.user.trim().toLocaleLowerCase("en") === playerKey
        );

        // Verification can be represented on a player's record or by the level's
        // verifier field, depending on which published data version is served.
        const verifiedByPlayer = valuesMatchPlayer([
            level.verifier, level.verifiedBy, level.verified_by,
            level.verification?.user, level.verification?.verifier,
            level.verification?.username,
            ...(Array.isArray(level.verifications) ? level.verifications.flatMap(item =>
                item && typeof item === "object" ? [item.user, item.verifier, item.username, item.name] : []
            ) : [])
        ], playerKey);
        const hasPlayerVerification = playerRecords.some(isVerifiedRecord) || verifiedByPlayer;
        if (hasPlayerVerification) {
            verifiedPaths.add(file);
            for (const key of levelKeys) verifiedLevelKeys.add(key);
        }

        if (playerRecords.some(record =>
            Number.isFinite(Number(record.percent)) && Number(record.percent) > 0
        )) {
            progressedPaths.add(file);
        }

        const qualifyingRecord = playerRecords.find(record =>
            Number.isFinite(Number(record.percent)) && Number(record.percent) >= required
        );
        if (qualifyingRecord) {
            completedPaths.add(file);
            for (const key of levelKeys) completedLevelKeys.add(key);
        }

        // Calculate each player's total points using the same per-level scoring
        // formula as the leaderboard. Count only the best qualifying record for
        // each player on a level, so duplicate records do not inflate their score.
        const pointsForThisLevel = new Map();
        const rank = index + 1;
        for (const record of level.records) {
            if (typeof record.user !== "string" || !record.user.trim()) continue;
            const percent = Number(record.percent);
            if (!Number.isFinite(percent) || percent < required) continue;

            const nameKey = record.user.trim().toLocaleLowerCase("en");
            const points = leaderboardScore(rank, percent, required);
            const previous = pointsForThisLevel.get(nameKey) ?? 0;
            if (points > previous) pointsForThisLevel.set(nameKey, points);
        }

        for (const [nameKey, points] of pointsForThisLevel) {
            allPlayerPoints.set(nameKey, (allPlayerPoints.get(nameKey) ?? 0) + points);
        }
    }

    const packsBeaten = FRAME_PACKS.filter(pack => pack.paths.every(path => completedPaths.has(path)));
    const completedCount = completedPaths.size;
    const achievementTiers = new Set();
    if (completedCount >= 1 || progressedPaths.size >= 1) achievementTiers.add("Bronze");
    if (completedCount >= 5 || verifiedPaths.size >= 1 || packsBeaten.length >= 1 || progressedPaths.size >= 10) achievementTiers.add("Silver");
    if (completedCount >= 25 || verifiedPaths.size >= 10 || packsBeaten.some(pack => pack.category === "Gold") || progressedPaths.size >= 50) achievementTiers.add("Gold");
    if (completedCount >= 75 || verifiedPaths.size >= 25 || packsBeaten.length >= 10) achievementTiers.add("Diamond");
    if (completedCount >= 150 || verifiedPaths.size >= 100) achievementTiers.add("Platinum");
    if (packsBeaten.filter(pack => pack.category === "Platinum").length >= 5) achievementTiers.add("Legendary");

    const topScore = Math.max(0, ...allPlayerPoints.values());
    const totalPoints = allPlayerPoints.get(playerKey) ?? 0;
    const isFirst = totalPoints > 0 && totalPoints === topScore;

    return {
        completedPaths,
        verifiedPaths,
        completedLevelKeys,
        verifiedLevelKeys,
        progressedCount: progressedPaths.size,
        verifiedCount: verifiedPaths.size,
        packsBeaten,
        achievementTiers,
        totalPoints,
        isFirst
    };
}

function calculateUnlockedFrames(playerData) {
    const unlocked = new Set(FREE_FRAMES);
    for (const tier of playerData.achievementTiers) unlocked.add(tier.toLowerCase());
    if (playerData.completedPaths.size >= 5) unlocked.add("fire");
    for (const [frameId, aliases] of Object.entries(FRAME_LEVEL_PATHS)) {
        const keys = aliases.map(normaliseLevelKey);
        if (keys.some(key =>
            playerData.completedLevelKeys?.has(key) ||
            playerData.verifiedLevelKeys?.has(key) ||
            [...playerData.completedPaths].some(path => normaliseLevelKey(path) === key) ||
            [...playerData.verifiedPaths].some(path => normaliseLevelKey(path) === key)
        )) {
            unlocked.add(frameId);
        }
    }
    if (["Spookweiner", "SSS", "Trytohide", "HalloweenPanic"].every(path => playerData.completedPaths.has(path))) unlocked.add("furter");
    if (playerData.isFirst) unlocked.add("victory");
    return FRAME_DEFINITIONS.map(frame => ({ ...frame, unlocked: unlocked.has(frame.id) }));
}

function detectImageType(bytes) {
    if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 &&
        bytes[2] === 0x4e && bytes[3] === 0x47 && bytes[4] === 0x0d &&
        bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a) return "image/png";
    if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
    if (bytes.length >= 12 && String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
        String.fromCharCode(...bytes.slice(8, 12)) === "WEBP") return "image/webp";
    return null;
}

function validUsername(username) {
    return /^[a-zA-Z0-9_]{3,24}$/.test(username);
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
            const rankHistoryQuestResponse = await handleRankHistoryQuestRequest(
                request, env, url, currentUser
            );
            if (rankHistoryQuestResponse) return rankHistoryQuestResponse;

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

            // Player customisation settings. Profile text is stored as plain text and returned through JSON.
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
            // This route is consumed by the leaderboard UI to overlay each player's frame.
            if (path === "/api/leaderboard/avatar-frames" && request.method === "GET") {
                const result = await env.db.prepare(`
                    SELECT
                        leaderboard_profiles.leaderboard_name,
                        profile_settings.equipped_frame,
                        profile_pictures.user_id AS picture_user_id,
                        profile_pictures.updated_at AS picture_updated_at,
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
player_customizations.show_website
                    FROM leaderboard_profiles
                    LEFT JOIN profile_settings
                        ON profile_settings.user_id = leaderboard_profiles.user_id
                    LEFT JOIN profile_pictures
                        ON profile_pictures.user_id = leaderboard_profiles.user_id
LEFT JOIN player_customizations
ON player_customizations.user_id = leaderboard_profiles.user_id
                `).all();

                const profiles = (result.results || []).map(profile => {
                    const frameId = profile.equipped_frame || null;
                    const frame = FRAME_DEFINITIONS.find(item => item.id === frameId);
                    return {
                        leaderboard_name: profile.leaderboard_name,
                        avatar_url: profile.picture_user_id
                            ? `/api/profile/avatar?name=${encodeURIComponent(profile.leaderboard_name)}&v=${profile.picture_updated_at || 0}`
                            : "/assets/profile/No%20PFP.png",
                        equipped_frame: frame ? frame.id : null,
                        frame_url: frame ? frame.image : null,
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

                    };
                });

                return json({ profiles }, 200, { "Cache-Control": "no-store" });
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

            // Upload or replace the logged-in user's profile picture using D1 only.
            // D1 is already configured for this Worker, so this needs no R2 bucket.
            if (path === "/api/profile/avatar" && request.method === "POST") {
                const user = await currentUser(request, env.db);
                if (!user) return json({ error: "Please log in." }, 401, { "Cache-Control": "no-store" });

                const declaredLength = Number(request.headers.get("Content-Length") || 0);
                if (declaredLength > MAX_AVATAR_SIZE + 100_000) {
                    return json({ error: "For database storage, images must be 1.5 MB or smaller." }, 413);
                }

                let form;
                try { form = await request.formData(); }
                catch { return json({ error: "Invalid upload." }, 400); }
                const image = form.get("image");
                if (!image || typeof image.arrayBuffer !== "function" || typeof image.size !== "number") {
                    return json({ error: "Choose an image to upload." }, 400);
                }
                if (image.size < 1 || image.size > MAX_AVATAR_SIZE) {
                    return json({ error: "Image must be between 1 byte and 1.5 MB for database storage." }, 413);
                }
                const allowedTypes = ["image/png", "image/jpeg", "image/webp"];
                if (!allowedTypes.includes(image.type)) return json({ error: "Only PNG, JPEG, and WebP images are allowed." }, 400);
                const bytes = new Uint8Array(await image.arrayBuffer());
                const detectedType = detectImageType(bytes);
                if (!detectedType || detectedType !== image.type) return json({ error: "The image file is invalid or its type does not match." }, 400);

                const updatedAt = Math.floor(Date.now() / 1000);
                // profile_pictures is retained as the avatar-presence marker used by the
                // leaderboard. The actual bytes and media type are stored in D1.
                await env.db.batch([
                    env.db.prepare(`
                        INSERT INTO profile_picture_blobs (user_id, content_type, image_data, updated_at)
                        VALUES (?, ?, ?, ?)
                        ON CONFLICT(user_id) DO UPDATE SET
                            content_type = excluded.content_type,
                            image_data = excluded.image_data,
                            updated_at = excluded.updated_at
                    `).bind(user.id, detectedType, bytes, updatedAt),
                    env.db.prepare(`
                        INSERT INTO profile_pictures (user_id, object_key, updated_at)
                        VALUES (?, ?, ?)
                        ON CONFLICT(user_id) DO UPDATE SET
                            object_key = excluded.object_key,
                            updated_at = excluded.updated_at
                    `).bind(user.id, `d1:${user.id}`, updatedAt)
                ]);

                const linked = await env.db.prepare(`SELECT leaderboard_name FROM leaderboard_profiles WHERE user_id = ?`).bind(user.id).first();
                return json({ success: true, avatarUrl: `/api/profile/avatar?name=${encodeURIComponent(linked?.leaderboard_name || "")}&v=${updatedAt}` }, 200, { "Cache-Control": "no-store" });
            }

            // Publicly serve a player's uploaded avatar directly from D1.
            if (path === "/api/profile/avatar" && request.method === "GET") {
                const name = (url.searchParams.get("name") || "").trim();
                if (!name || name.length > 100) return new Response("Not found.", { status: 404 });
                const profile = await env.db.prepare(`
                    SELECT profile_picture_blobs.content_type,
                           profile_picture_blobs.image_data,
                           profile_picture_blobs.updated_at
                    FROM leaderboard_profiles
                    JOIN profile_picture_blobs
                      ON profile_picture_blobs.user_id = leaderboard_profiles.user_id
                    WHERE leaderboard_profiles.leaderboard_name = ? COLLATE NOCASE
                `).bind(name).first();
                if (!profile?.image_data) {
                    return env.ASSETS.fetch(new Request(new URL("/assets/profile/No%20PFP.png", url.origin)));
                }
                const headers = new Headers({
                    "Content-Type": profile.content_type || "image/png",
                    "X-Content-Type-Options": "nosniff",
                    "Cache-Control": "public, max-age=3600",
                    "ETag": `"avatar-${profile.updated_at}"`
                });
                // D1 returns BLOBs as arrays of bytes; rebuild a byte buffer for Response.
                const avatarBytes = Uint8Array.from(profile.image_data);
                return new Response(avatarBytes, { headers });
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
    },
    async scheduled(controller, env, ctx) {
        ctx.waitUntil(
            captureDailyRankSnapshot(env, new Date(controller.scheduledTime)).catch(error => {
                console.error("Daily rank-history snapshot failed:", error?.stack || error);
            })
        );
    }
};
