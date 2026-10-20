
const SESSION_SECONDS = 60 * 60 * 24 * 7;
const PBKDF2_ITERATIONS = 100000;

function json(data, status = 200, headers = {}) {
    return Response.json(data, { status, headers });
}

function cookieValue(request, name) {
    const cookies = request.headers.get("Cookie") || "";
    const prefix = `${name}=`;
    const item = cookies.split(";").map(v => v.trim())
        .find(v => v.startsWith(prefix));
    return item ? item.slice(prefix.length) : null;
}

function cookieHeader(value, maxAge) {
    return `sb_session=${value}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${maxAge}`;
}

function base64url(bytes) {
    let binary = "";
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
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
        const salt = Uint8Array.from(saltString, c => c.charCodeAt(0));
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

    const row = await db.prepare(`
        SELECT users.id, users.username, users.created_at
        FROM sessions
        JOIN users ON users.id = sessions.user_id
        WHERE sessions.token_hash = ? AND sessions.expires_at > ?
    `).bind(tokenHash, now).first();

    return row || null;
}

function validOrigin(request) {
    const origin = request.headers.get("Origin");
    return !origin || origin === new URL(request.url).origin;
}
async function existingLeaderboardName(env, origin, name) {
    const listResponse = await env.ASSETS.fetch(
        new Request(new URL("/data/_list.json", origin))
    );

    if (!listResponse.ok) {
        throw new Error("Could not read leaderboard data");
    }

    const files = await listResponse.json();

    if (!Array.isArray(files)) {
        throw new Error("Invalid leaderboard list");
    }

    for (const file of files) {
        if (typeof file !== "string" ||
            !/^[a-zA-Z0-9_-]+$/.test(file)) {
            continue;
        }

        const response = await env.ASSETS.fetch(
            new Request(
                new URL(`/data/${encodeURIComponent(file)}.json`, origin)
            )
        );

        if (!response.ok) {
            throw new Error(`Could not read level data: ${file}`);
        }

        const level = await response.json();

        if (!Array.isArray(level.records)) continue;

        const exists = level.records.some(record =>
            typeof record.user === "string" &&
            record.user.trim().toLowerCase() === name.toLowerCase()
        );

        if (exists) return true;
    }

    return false;
}
export default {
    async fetch(request, env) {
        const url = new URL(request.url);

if (url.pathname === "/api/test") {
    return Response.json({
        success: true,
        message: "Suberboys backend is running!"
    });
}

if (!url.pathname.startsWith("/api/")) {
    return env.ASSETS.fetch(request);
}

        if (!["GET", "POST"].includes(request.method)) {
            return json({ error: "Method not allowed" }, 405, {
                Allow: "GET, POST"
            });
        }

        if (request.method === "POST" && !validOrigin(request)) {
            return json({ error: "Invalid request origin" }, 403);
        }
if (url.pathname === "/api/leaderboard/profile" &&
    request.method === "GET") {
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

if (url.pathname === "/api/leaderboard/join" &&
    request.method === "POST") {
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
        typeof body.leaderboardName === "string"
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

    const reserved = await existingLeaderboardName(
        env, url.origin, leaderboardName
    );

    if (reserved) {
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

    const id = crypto.randomUUID();

    try {
        await env.db.prepare(`
            INSERT INTO leaderboard_profiles
                (id, user_id, leaderboard_name)
            VALUES (?, ?, ?)
        `).bind(id, user.id, leaderboardName).run();
    } catch (error) {
        // The database UNIQUE constraints also protect against
        // two requests attempting to claim the same name.
        const message = String(error?.message || "");

        if (/unique constraint/i.test(message)) {
            return json({
                error: "That account or leaderboard name is already linked."
            }, 409);
        }

        throw error;
    }

    return json({
        success: true,
        profile: {
            leaderboard_name: leaderboardName
        }
    }, 201, {
        "Cache-Control": "no-store"
    });
}
        try {
            if (url.pathname === "/api/auth/register" &&
                request.method === "POST") {
                const body = await request.json();
                const username = String(body.username || "").trim();
                const email = String(body.email || "").trim().toLowerCase();
                const password = String(body.password || "");

                if (!/^[a-zA-Z0-9_]{3,24}$/.test(username)) {
                    return json({
                        error: "Username must be 3–24 letters, numbers or underscores."
                    }, 400);
                }

                if (email.length > 254 ||
                    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
                    return json({ error: "Enter a valid email address." }, 400);
                }

                if (password.length < 12 || password.length > 128) {
                    return json({
                        error: "Password must be between 12 and 128 characters."
                    }, 400);
                }

                const existing = await env.db.prepare(`
                    SELECT id FROM users
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

                await env.db.prepare(`
                    INSERT INTO users (id, username, email, password_hash)
                    VALUES (?, ?, ?, ?)
                `).bind(id, username, email, passwordHash).run();

                return json({
                    success: true,
                    message: "Account created. You can now log in."
                }, 201);
            }

            if (url.pathname === "/api/auth/login" &&
                request.method === "POST") {
                const body = await request.json();
                const email = String(body.email || "").trim().toLowerCase();
                const password = String(body.password || "");

                const user = await env.db.prepare(`
                    SELECT id, username, email, password_hash
                    FROM users WHERE email = ? COLLATE NOCASE
                `).bind(email).first();

                if (!user || !(await verifyPassword(password, user.password_hash))) {
                    return json({ error: "Invalid email or password." }, 401);
                }

                const tokenBytes = crypto.getRandomValues(new Uint8Array(32));
                const token = base64url(tokenBytes);
                const tokenHash = await sha256(token);
                const expiresAt = Math.floor(Date.now() / 1000) + SESSION_SECONDS;

                await env.db.prepare(`
                    INSERT INTO sessions (token_hash, user_id, expires_at)
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

            if (url.pathname === "/api/auth/me" &&
                request.method === "GET") {
                const user = await currentUser(request, env.db);
                if (!user) {
                    return json({ user: null }, 200, {
                        "Cache-Control": "no-store"
                    });
                }

                return json({ user }, 200, {
                    "Cache-Control": "no-store"
                });
            }

            if (url.pathname === "/api/auth/logout" &&
                request.method === "POST") {
                const token = cookieValue(request, "sb_session");

                if (token) {
                    await env.db.prepare(`
                        DELETE FROM sessions WHERE token_hash = ?
                    `).bind(await sha256(token)).run();
                }

                return json({ success: true }, 200, {
                    "Set-Cookie": cookieHeader("", 0),
                    "Cache-Control": "no-store"
                });
            }

            return json({ error: "Not found" }, 404);
        } catch (error) {
    console.error("Account API error:", error?.stack || error);

    return json({
        error: "Server error. Please try again.",
        requestId: crypto.randomUUID()
    }, 500);
}
    }
};
