
const OWNER = "Siotove";
const REPO = "SuberboysDemonList";
const BRANCH = "main";

async function githubApi(env, path, options = {}) {
    if (!env.GITHUB_TOKEN) {
        throw new Error("GitHub token secret is not configured.");
    }

    const response = await fetch(
        `https://api.github.com/repos/${OWNER}/${REPO}/${path}`,
        {
            ...options,
            headers: {
                Accept: "application/vnd.github+json",
                Authorization: `Bearer ${env.GITHUB_TOKEN}`,
                "X-GitHub-Api-Version": "2022-11-28",
                "Content-Type": "application/json",
                ...options.headers
            }
        }
    );

    if (!response.ok) {
        console.error("GitHub API request failed:", response.status);
        throw new Error(`GitHub API failed (${response.status}).`);
    }

    return response.status === 204 ? null : response.json();
}

export async function readRepoFile(env, path) {
    const safePath = path.split("/").map(encodeURIComponent).join("/");
    const result = await githubApi(env, `contents/${safePath}?ref=${BRANCH}`);

    if (!result || typeof result.content !== "string") {
        throw new Error(`Could not read repository file: ${path}`);
    }

    const binary = atob(result.content.replace(/\n/g, ""));
    const bytes = Uint8Array.from(binary, c => c.charCodeAt(0));

    return {
        sha: result.sha,
        text: new TextDecoder().decode(bytes)
    };
}

export async function writeRepoFilesAtomic(env, files, message) {
    if (!Array.isArray(files) || files.length === 0) {
        throw new Error("No files supplied.");
    }

    // Read the current branch head and its tree.
    const ref = await githubApi(
        env,
        `git/ref/heads/${BRANCH}`
    );
    const parentSha = ref.object.sha;

    const parentCommit = await githubApi(
        env,
        `git/commits/${parentSha}`
    );

    const treeEntries = [];

    for (const file of files) {
        if (
            typeof file.path !== "string" ||
            !/^[a-zA-Z0-9_./-]+$/.test(file.path) ||
            file.path.split("/").includes("..") ||
            typeof file.text !== "string"
        ) {
            throw new Error("Invalid repository file.");
        }

        const blob = await githubApi(env, "git/blobs", {
            method: "POST",
            body: JSON.stringify({
                content: file.text,
                encoding: "utf-8"
            })
        });

        treeEntries.push({
            path: file.path,
            mode: "100644",
            type: "blob",
            sha: blob.sha
        });
    }

    const tree = await githubApi(env, "git/trees", {
        method: "POST",
        body: JSON.stringify({
            base_tree: parentCommit.tree.sha,
            tree: treeEntries
        })
    });

    const commit = await githubApi(env, "git/commits", {
        method: "POST",
        body: JSON.stringify({
            message,
            tree: tree.sha,
            parents: [parentSha]
        })
    });

    // A normal, non-forced update avoids overwriting a newer commit.
    await githubApi(env, `git/refs/heads/${BRANCH}`, {
        method: "PATCH",
        body: JSON.stringify({
            sha: commit.sha,
            force: false
        })
    });

    return { commit: commit.sha };
}
