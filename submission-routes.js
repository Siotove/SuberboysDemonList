
import {
    readRepoFile,
    writeRepoFilesAtomic
} from "./submissions.js";

const LEVEL_FILE_PATTERN = /^[a-zA-Z0-9_-]{1,80}$/;

async function resolveLevelFile(env, selectedValue) {
    const list = JSON.parse(
        (await readRepoFile(env, "data/_list.json")).text
    );

    if (!Array.isArray(list)) {
        throw new Error("Published level list is invalid.");
    }

    for (const fileName of list) {
        if (
            typeof fileName !== "string" ||
            !LEVEL_FILE_PATTERN.test(fileName)
        ) {
            continue;
        }

        // Support either a filename or a displayed level name.
        if (fileName === selectedValue) {
            return fileName;
        }

        const file = await readRepoFile(
            env,
            `data/${fileName}.json`
        );

        const level = JSON.parse(file.text);

        if (
            typeof level.name === "string" &&
            level.name.trim().toLowerCase() ===
                selectedValue.trim().toLowerCase()
        ) {
            return fileName;
        }
    }

    return null;
}

function errorResponse(json, message, status = 400) {
    return json({ error: message }, status, {
        "Cache-Control": "no-store"
    });
}

async function readBody(request) {
    const length = Number(request.headers.get("Content-Length") || 0);
    if (length > 20000) return null;

    try {
        const text = await request.text();
        if (text.length > 20000) return null;
        return JSON.parse(text);
    } catch {
        return null;
    }
}

function validHttpsUrl(value) {
    try {
        const url = new URL(value);
        return url.protocol === "https:" && url.hostname.includes(".");
    } catch {
        return false;
    }
}

function validText(value, max = 100) {
    return typeof value === "string" &&
        value.trim().length > 0 &&
        value.trim().length <= max &&
        !/[\u0000-\u001F\u007F]/.test(value);
}

async function adminUser(request, env, json, currentUser) {
    const user = await currentUser(request, env.db);
    if (!user) return { error: errorResponse(json, "Please log in.", 401) };
    if (user.is_admin !== 1) {
        return { error: errorResponse(json, "Admin access required.", 403) };
    }
    return { user };
}

export async function handleSubmissionRoute(
    request,
    env,
    url,
    { json, currentUser }
) {
    const db = env.db;
    const path = url.pathname;

    // Submit a completion or new-level verification.
    if (path === "/api/submissions" && request.method === "POST") {
        const user = await currentUser(request, db);
        if (!user) return errorResponse(json, "Please log in.", 401);

        const profile = await db.prepare(`
            SELECT leaderboard_name
            FROM leaderboard_profiles
            WHERE user_id = ?
        `).bind(user.id).first();

        if (!profile?.leaderboard_name) {
            return errorResponse(
                json,
                "Link a leaderboard identity before submitting.",
                409
            );
        }

        const body = await readBody(request);
        if (!body) return errorResponse(json, "Invalid or oversized JSON body.");

        const type = body.type;
        let payload;

        if (type === "completion") {
            const levelFile = body.levelFile;
            const link = body.link;
            const percent = Number(body.percent);
            const hz = Number(body.hz);

            if (
                typeof levelFile !== "string" ||
                !LEVEL_FILE_PATTERN.test(levelFile) ||
                !validHttpsUrl(link) ||
                !Number.isInteger(percent) ||
                percent < 1 || percent > 100 ||
                !Number.isInteger(hz) ||
                hz < 1 || hz > 1000
            ) {
                return errorResponse(json, "Invalid completion details.");
            }

            
const resolvedFile = await resolveLevelFile(env, levelFile);

if (!resolvedFile) {
    return errorResponse(json, "Level not found.", 404);
}

payload = {
    levelFile: resolvedFile,
    link,
    percent,
    hz
};

        } else if (type === "verification") {
            const name = typeof body.name === "string" ? body.name.trim() : "";
            const fileName = typeof body.fileName === "string"
                ? body.fileName.trim()
                : "";
            const id = typeof body.id === "string" ? body.id.trim() : "";
            const author = typeof body.author === "string"
                ? body.author.trim()
                : "";
            const creators = body.creators;
            const verification = body.verification;
            const percentToQualify = Number(body.percentToQualify);
            const password = typeof body.password === "string"
                ? body.password
                : "";
            const position = Number(body.position);

            if (
                !validText(name, 100) ||
                !LEVEL_FILE_PATTERN.test(fileName) ||
                !validText(id, 100) ||
                !validText(author, 100) ||
                !Array.isArray(creators) ||
                creators.length < 1 ||
                creators.length > 20 ||
                !creators.every(c => validText(c, 100)) ||
                !validHttpsUrl(verification) ||
                !Number.isInteger(percentToQualify) ||
                percentToQualify < 1 || percentToQualify > 100 ||
                password.length > 100 ||
                !Number.isInteger(position) ||
                position < 1 || position > 1000
            ) {
                return errorResponse(json, "Invalid verification details.");
            }

            payload = {
                name,
                fileName,
                id,
                author,
                creators: [...new Set(creators.map(c => c.trim()))],
                verification,
                percentToQualify,
                password,
                position
            };
        } else {
            return errorResponse(
                json,
                "Type must be completion or verification."
            );
        }

        const id = crypto.randomUUID();

        await db.prepare(`
            INSERT INTO submissions (id, user_id, type, payload)
            VALUES (?, ?, ?, ?)
        `).bind(id, user.id, type, JSON.stringify(payload)).run();

        return json({ success: true, submissionId: id }, 201, {
            "Cache-Control": "no-store"
        });
    }

    // A user's own submission history.
    if (path === "/api/submissions/mine" && request.method === "GET") {
        const user = await currentUser(request, db);
        if (!user) return errorResponse(json, "Please log in.", 401);

        const result = await db.prepare(`
            SELECT id, type, status, payload, created_at, updated_at,
                   error_message
            FROM submissions
            WHERE user_id = ?
            ORDER BY created_at DESC
            LIMIT 100
        `).bind(user.id).all();

        return json({
            submissions: result.results.map(row => ({
                ...row,
                payload: JSON.parse(row.payload)
            }))
        }, 200, { "Cache-Control": "no-store" });
    }

    // Admin queue.
    if (path === "/api/admin/submissions" && request.method === "GET") {
        const auth = await adminUser(request, env, json, currentUser);
        if (auth.error) return auth.error;

        const result = await db.prepare(`
            SELECT s.id, s.user_id, u.username, s.type, s.status,
                   s.payload, s.created_at, s.updated_at,
                   s.reviewed_by, s.reviewed_at, s.error_message
            FROM submissions s
            JOIN users u ON u.id = s.user_id
            ORDER BY
                CASE s.status
                    WHEN 'pending' THEN 0
                    WHEN 'failed' THEN 1
                    WHEN 'processing' THEN 2
                    ELSE 3
                END,
                s.created_at ASC
            LIMIT 200
        `).all();

        return json({
            submissions: result.results.map(row => ({
                ...row,
                payload: JSON.parse(row.payload)
            }))
        }, 200, { "Cache-Control": "no-store" });
    }

    // Admin approval or rejection.
    if (path === "/api/admin/submissions/review" &&
        request.method === "POST") {
        const auth = await adminUser(request, env, json, currentUser);
        if (auth.error) return auth.error;

        const body = await readBody(request);
        if (!body) return errorResponse(json, "Invalid JSON body.");

        const id = typeof body.id === "string" ? body.id : "";
        const action = body.action;

        if (!id || id.length > 64 ||
            !["approve", "reject"].includes(action)) {
            return errorResponse(json, "Invalid review request.");
        }

        const submission = await db.prepare(`
            SELECT *
            FROM submissions
            WHERE id = ?
        `).bind(id).first();

        if (!submission) {
            return errorResponse(json, "Submission not found.", 404);
        }

        if (action === "reject") {
            const result = await db.prepare(`
                UPDATE submissions
                SET status = 'rejected',
                    reviewed_by = ?,
                    reviewed_at = datetime('now'),
                    updated_at = datetime('now'),
                    error_message = NULL
                WHERE id = ? AND status = 'pending'
            `).bind(auth.user.id, id).run();

            if (!result.meta?.changes) {
                return errorResponse(
                    json,
                    "This submission is no longer pending.",
                    409
                );
            }

            return json({ success: true, status: "rejected" });
        }

        // Claim the submission so two admins cannot approve it at once.
        const claim = await db.prepare(`
            UPDATE submissions
            SET status = 'processing',
                reviewed_by = ?,
                reviewed_at = datetime('now'),
                updated_at = datetime('now'),
                error_message = NULL
            WHERE id = ? AND status = 'pending'
        `).bind(auth.user.id, id).run();

        if (!claim.meta?.changes) {
            return errorResponse(
                json,
                "This submission is not pending.",
                409
            );
        }

        try {
            const payload = JSON.parse(submission.payload);

            const profile = await db.prepare(`
                SELECT leaderboard_name
                FROM leaderboard_profiles
                WHERE user_id = ?
            `).bind(submission.user_id).first();

            if (!profile?.leaderboard_name) {
                throw new Error("Submitter has no linked leaderboard identity.");
            }

            if (submission.type === "completion") {
                const { levelFile, link, percent, hz } = payload;

                if (!LEVEL_FILE_PATTERN.test(levelFile)) {
                    throw new Error("Invalid level filename.");
                }

                const list = JSON.parse(
                    (await readRepoFile(env, "data/_list.json")).text
                );

                if (!Array.isArray(list) || !list.includes(levelFile)) {
                    throw new Error("Level is not in the published list.");
                }

                const path = `data/${levelFile}.json`;
                const file = await readRepoFile(env, path);
                const level = JSON.parse(file.text);

                if (!Array.isArray(level.records)) {
                    throw new Error("Level records are invalid.");
                }

                const record = {
                    user: profile.leaderboard_name,
                    link,
                    percent,
                    hz
                };

                const alreadyApplied = level.records.some(r =>
                    r.user === record.user &&
                    r.link === record.link &&
                    r.percent === record.percent &&
                    r.hz === record.hz
                );

                if (!alreadyApplied) {
                    level.records.push(record);
                    await writeRepoFilesAtomic(env, [{
                        path,
                        text: JSON.stringify(level, null, 2) + "\n"
                    }], `Approve completion ${id}`);
                }
            } else if (submission.type === "verification") {
                const {
                    name, fileName, id: levelId, author, creators,
                    verification, percentToQualify, password, position
                } = payload;

                if (!LEVEL_FILE_PATTERN.test(fileName)) {
                    throw new Error("Invalid level filename.");
                }

                const listFile = await readRepoFile(env, "data/_list.json");
                const list = JSON.parse(listFile.text);

                if (!Array.isArray(list) ||
                    !list.every(v => typeof v === "string")) {
                    throw new Error("Published level list is invalid.");
                }

                if (list.includes(fileName)) {
                    // Idempotent retry if a previous attempt already applied it.
                    const existing = JSON.parse(
                        (await readRepoFile(env, `data/${fileName}.json`)).text
                    );

                    if (existing.name !== name) {
                        throw new Error("That filename is already in use.");
                    }
                } else {
                    if (position > list.length + 1) {
                        throw new Error("Position is outside the current list.");
                    }

                    const level = {
                        id: levelId,
                        name,
                        author,
                        creators,
                        verifier: profile.leaderboard_name,
                        verification,
                        percentToQualify,
                        password,
                        records: []
                    };

                    list.splice(position - 1, 0, fileName);

                    await writeRepoFilesAtomic(env, [
                        {
                            path: `data/${fileName}.json`,
                            text: JSON.stringify(level, null, 2) + "\n"
                        },
                        {
                            path: "data/_list.json",
                            text: JSON.stringify(list, null, 2) + "\n"
                        }
                    ], `Approve level verification ${id}`);
                }
            } else {
                throw new Error("Unknown submission type.");
            }

            await db.prepare(`
                UPDATE submissions
                SET status = 'approved',
                    updated_at = datetime('now'),
                    error_message = NULL
                WHERE id = ? AND status = 'processing'
            `).bind(id).run();

            return json({ success: true, status: "approved" });
        } catch (error) {
            console.error("Submission approval failed:", error?.message);

            await db.prepare(`
                UPDATE submissions
                SET status = 'failed',
                    updated_at = datetime('now'),
                    error_message = ?
                WHERE id = ? AND status = 'processing'
            `).bind(
                String(error?.message || "Approval failed.").slice(0, 500),
                id
            ).run();

            return errorResponse(
                json,
                "Approval failed. The submission is marked failed; check the error before retrying.",
                500
            );
        }
    }

    return null;
}
