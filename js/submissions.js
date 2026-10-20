
const OWNER = "Siotove";
const REPO = "SuberboysDemonList";
const BRANCH = "main";

export async function githubRequest(env, path, options = {}) {
    if (!env.GITHUB_TOKEN) {
        throw new Error("GitHub token secret is not configured.");
    }

    const response = await fetch(
        `https://api.github.com/repos/${OWNER}/${REPO}/contents/${path}`,
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
        const detail = await response.text();
        console.error("GitHub API error:", response.status, detail);
        throw new Error(`GitHub API request failed (${response.status}).`);
    }

    return response.status === 204 ? null : response.json();
}

export async function readRepoFile(env, path) {
    const result = await githubRequest(env, path, {
        method: "GET"
    });

    if (!result || !result.content) {
        throw new Error(`Could not read repository file: ${path}`);
    }

    const binary = atob(result.content.replace(/\n/g, ""));
    const bytes = Uint8Array.from(binary, c => c.charCodeAt(0));

    return {
        sha: result.sha,
        text: new TextDecoder().decode(bytes)
    };
}

export async function writeRepoFile(env, path, text, message, sha) {
    const bytes = new TextEncoder().encode(text);
    let binary = "";

    for (const byte of bytes) {
        binary += String.fromCharCode(byte);
    }

    const body = {
        message,
        content: btoa(binary),
        branch: BRANCH
    };

    if (sha) body.sha = sha;

    return githubRequest(env, path, {
        method: "PUT",
        body: JSON.stringify(body)
    });
}
