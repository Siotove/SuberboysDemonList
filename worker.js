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

    const row = await db.prepare(`
        SELECT users.id, users.username, users.created_at, users.is_admin
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
        if (
            typeof file !== "string" ||
            !/^[a-zA-Z0-9_-]+$/.test(file)
        ) {
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

async function allLeaderboardNames(env, origin) {
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

    const names = new Map();

    for (const file of files) {
        if (
            typeof file !== "string" ||
            !/^[a-zA-Z0-9_-]+$/.test(file)
        ) {
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

        for (const record of level.records) {
            if (typeof record.user !== "string") continue;

            const name = record.user.trim();

            if (name) {
                const key = name.toLocaleLowerCase("en");

                if (!names.has(key)) {
                    names.set(key, name);
                }
            }
        }
    }

    return [...names.values()].sort((a, b) =>
        a.localeCompare(b, undefined, { sensitivity: "base" })
    );
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

        if (
            request.method === "POST" &&
            !validOrigin(request)
        ) {
            return json({ error: "Invalid request origin" }, 403);
        }

        try {
            // Get the current user's leaderboard profile.
            if (
                url.pathname === "/api/leaderboard/profile" &&
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

            // Allow a logged-in user to join with a new identity.
            if (
                url.pathname === "/api/leaderboard/join" &&
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
                    if (/unique constraint/i.test(
                        String(error?.message || "")
                    )) {
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

            // Register a normal account.
            if (
                url.pathname === "/api/auth/register" &&
                request.method === "POST"
            ) {
                let body;

                try {
                    body = await request.json();
                } catch {
                    return json({ error: "Invalid JSON body." }, 400);
                }

                const username = String(body.username || "").trim();
                const email = String(body.email || "").trim().toLowerCase();
                const password = String(body.password || "");

                if (!/^[a-zA-Z0-9_]{3,24}$/.test(username)) {
                    return json({
                        error: "Username must be 3–24 letters, numbers or underscores."
                    }, 400);
                }

                if (
                    email.length > 254 ||
                    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
                ) {
                    return json({
                        error: "Enter a valid email address."
                    }, 400);
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
                    if (/unique constraint/i.test(
                        String(error?.message || "")
                    )) {
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
            if (
                url.pathname === "/api/auth/login" &&
                request.method === "POST"
            ) {
                let body;

                try {
                    body = await request.json();
                } catch {
                    return json({ error: "Invalid JSON body." }, 400);
                }

                const email = String(body.email || "").trim().toLowerCase();
                const password = String(body.password || "");

                const user = await env.db.prepare(`
                    SELECT id, username, email, password_hash
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

                const tokenBytes = crypto.getRandomValues(
                    new Uint8Array(32)
                );
                const token = base64url(tokenBytes);
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

            // Return the logged-in user.
            if (
                url.pathname === "/api/auth/me" &&
                request.method === "GET"
            ) {
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

            // Log out.
            if (
                url.pathname === "/api/auth/logout" &&
                request.method === "POST"
            ) {
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

            // List leaderboard identities already linked in D1.
            if (
                url.pathname === "/api/leaderboard/identities" &&
                request.method === "GET"
            ) {
                const result = await env.db.prepare(`
                    SELECT leaderboard_name
                    FROM leaderboard_profiles
                    ORDER BY leaderboard_name COLLATE NOCASE
                `).all();

                return json({
                    identities: result.results.map(
                        row => row.leaderboard_name
                    )
                }, 200, {
                    "Cache-Control": "no-store"
                });
            }

            // Check admin permissions.
            if (
                url.pathname === "/api/admin/me" &&
                request.method === "GET"
            ) {
                const user = await currentUser(request, env.db);

                if (!user) {
                    return json({ error: "Please log in." }, 401, {
                        "Cache-Control": "no-store"
                    });
                }

                if (user.is_admin !== 1) {
                    return json({ error: "Admin access required." }, 403, {
                        "Cache-Control": "no-store"
                    });
                }

                return json({
                    admin: true,
                    username: user.username
                }, 200, {
                    "Cache-Control": "no-store"
                });
            }

            // List all accounts and all existing leaderboard identities.
            if (
                url.pathname === "/api/admin/players" &&
                request.method === "GET"
            ) {
                const admin = await currentUser(request, env.db);

                if (!admin) {
                    return json({ error: "Please log in." }, 401, {
                        "Cache-Control": "no-store"
                    });
                }

                if (admin.is_admin !== 1) {
                    return json({ error: "Admin access required." }, 403, {
                        "Cache-Control": "no-store"
                    });
                }

                const result = await env.db.prepare(`
                    SELECT
                        users.id,
                        users.username,
                        users.email,
                        users.created_at,
                        users.is_admin,
                        leaderboard_profiles.leaderboard_name
                    FROM users
                    LEFT JOIN leaderboard_profiles
                        ON leaderboard_profiles.user_id = users.id
                    ORDER BY users.username COLLATE NOCASE
                `).all();

                const staticNames = await allLeaderboardNames(
                    env, url.origin
                );

                const dbNames = await env.db.prepare(`
                    SELECT leaderboard_name
                    FROM leaderboard_profiles
                `).all();

                const nameMap = new Map();

                for (const name of staticNames) {
                    nameMap.set(name.toLocaleLowerCase("en"), name);
                }

                for (const row of dbNames.results) {
                    const name = row.leaderboard_name;

                    if (name) {
                        const key = name.toLocaleLowerCase("en");

                        if (!nameMap.has(key)) {
                            nameMap.set(key, name);
                        }
                    }
                }

                const identities = [...nameMap.values()].sort((a, b) =>
                    a.localeCompare(b, undefined, {
                        sensitivity: "base"
                    })
                );

                return json({
                    players: result.results,
                    identities
                }, 200, {
                    "Cache-Control": "no-store"
                });
            }

            // Link, change or unlink a player's leaderboard identity.
            if (
                url.pathname === "/api/admin/players/link" &&
                request.method === "POST"
            ) {
                const admin = await currentUser(request, env.db);

                if (!admin) {
                    return json({ error: "Please log in." }, 401);
                }

                if (admin.is_admin !== 1) {
                    return json({
                        error: "Admin access required."
                    }, 403);
                }

                let body;

                try {
                    body = await request.json();
                } catch {
                    return json({ error: "Invalid JSON body." }, 400);
                }

                const userId =
                    typeof body.userId === "string" ? body.userId : "";

                const requestedName =
                    typeof body.leaderboardName === "string"
                        ? body.leaderboardName.trim()
                        : "";

                if (!userId || userId.length > 128) {
                    return json({
                        error: "Choose a valid account."
                    }, 400);
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
                    return json({
                        error: "Account not found."
                    }, 404);
                }

                // An empty name unlinks the account.
                if (!requestedName) {
                    await env.db.prepare(`
                        DELETE FROM leaderboard_profiles
                        WHERE user_id = ?
                    `).bind(userId).run();

                    return json({
                        success: true,
                        leaderboardName: null
                    }, 200, {
                        "Cache-Control": "no-store"
                    });
                }

                const staticNames = await allLeaderboardNames(
                    env, url.origin
                );

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
                    if (/unique constraint/i.test(
                        String(error?.message || "")
                    )) {
                        return json({
                            error: "That account or identity is already linked."
                        }, 409);
                    }

                    throw error;
                }

                return json({
                    success: true,
                    leaderboardName: canonicalName
                }, 200, {
                    "Cache-Control": "no-store"
                });
            }

            return json({ error: "Not found" }, 404);
        } catch (error) {
            console.error(
                "Account API error:",
                error?.stack || error
            );

            return json({
                error: "Server error. Please try again.",
                requestId: crypto.randomUUID()
            }, 500);
        }
    }
};
