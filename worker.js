
const SESSION_SECONDS = 60 * 60 * 24 * 7;
const PBKDF2_ITERATIONS = 310000;

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

export default {
    async fetch(request, env) {
        const url = new URL(request.url);
        if (url.pathname.startsWith("/api/")) {
    return Response.json({
        receivedPath: url.pathname,
        method: request.method
    });
}
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
            console.error("Account API error:", error);
            return json({ error: "Server error. Please try again." }, 500);
        }
    }
};
