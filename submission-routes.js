} from "./submissions.js";

const LEVEL_FILE_PATTERN = /^[a-zA-Z0-9_-]{1,80}$/;

const LEVEL_DIFFICULTIES = [
    "Extreme Demon",
    "Insane Demon",
    "Hard Demon",
    "Medium Demon",
    "Easy Demon",
    "Insane",
    "Harder",
    "Hard",
    "Normal",
    "Easy",
    "Auto"
];
function errorResponse(json, message, status = 400) {
    return json(
        { error: message },
@@ -320,6 +332,109 @@ export async function handleSubmissionRoute(
        }, 200, { "Cache-Control": "no-store" });
    }

    // Admin: list published levels and their difficulties.
    if (
        path === "/api/admin/levels" &&
        request.method === "GET"
    ) {
        const auth = await adminUser(request, env, json, currentUser);
        if (auth.error) return auth.error;

        const listFile = await readRepoFile(env, "data/_list.json");
        const list = JSON.parse(listFile.text);

        if (
            !Array.isArray(list) ||
            !list.every(file =>
                typeof file === "string" &&
                LEVEL_FILE_PATTERN.test(file)
            )
        ) {
            return errorResponse(json, "Published level list is invalid.", 500);
        }

        const levels = [];

        for (let index = 0; index < list.length; index++) {
            const file = list[index];
            const result = await readRepoFile(env, `data/${file}.json`);
            const level = JSON.parse(result.text);

            levels.push({
                file,
                name: typeof level.name === "string" ? level.name : file,
                difficulty: LEVEL_DIFFICULTIES.includes(level.difficulty)
                    ? level.difficulty
                    : "",
                rank: index + 1
            });
        }

        return json({ levels, difficulties: LEVEL_DIFFICULTIES }, 200, {
            "Cache-Control": "no-store"
        });
    }

    // Admin: update one level's difficulty.
    if (
        path === "/api/admin/levels/difficulty" &&
        request.method === "POST"
    ) {
        const auth = await adminUser(request, env, json, currentUser);
        if (auth.error) return auth.error;

        const body = await readBody(request);

        if (!body || typeof body !== "object" || Array.isArray(body)) {
            return errorResponse(json, "Invalid JSON body.");
        }

        const file = body.file;
        const difficulty = body.difficulty;

        if (
            typeof file !== "string" ||
            !LEVEL_FILE_PATTERN.test(file)
        ) {
            return errorResponse(json, "Invalid level filename.");
        }

        if (!LEVEL_DIFFICULTIES.includes(difficulty)) {
            return errorResponse(json, "Choose a valid difficulty.");
        }

        const listFile = await readRepoFile(env, "data/_list.json");
        const list = JSON.parse(listFile.text);

        if (!Array.isArray(list) || !list.includes(file)) {
            return errorResponse(json, "Level not found.", 404);
        }

        const path = `data/${file}.json`;
        const source = await readRepoFile(env, path);
        const level = JSON.parse(source.text);

        if (!level || typeof level !== "object" || Array.isArray(level)) {
            return errorResponse(json, "Level data is invalid.", 500);
        }

        level.difficulty = difficulty;

        await writeRepoFilesAtomic(env, [{
            path,
            text: JSON.stringify(level, null, 2) + "\n"
        }], `Set ${file} difficulty to ${difficulty}`);

        return json({
            success: true,
            file,
            name: level.name || file,
            difficulty
        }, 200, {
            "Cache-Control": "no-store"
        });
    }

    // Admin queue.
    if (path === "/api/admin/submissions" && request.method === "GET") {
        const auth = await adminUser(request, env, json, currentUser);
