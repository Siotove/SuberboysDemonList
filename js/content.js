import { round, score } from './score.js';

/**
 * Path to directory containing `_list.json` and all levels
 */
const dir = '/data';

export async function fetchList() {
    const listResult = await fetch(`${dir}/_list.json`);
    try {
        const list = await listResult.json();
        return await Promise.all(
            list.map(async (path, rank) => {
                const levelResult = await fetch(`${dir}/${path}.json`);
                try {
                    const level = await levelResult.json();
                    return [
                        {
                            ...level,
                            path,
                            records: level.records.sort(
                                (a, b) => b.percent - a.percent,
                            ),
                        },
                        null,
                    ];
                } catch {
                    console.error(`Failed to load level #${rank + 1} ${path}.`);
                    return [null, path];
                }
            }),
        );
    } catch {
        console.error(`Failed to load list.`);
        return null;
    }
}

export async function fetchEditors() {
    try {
        const editorsResults = await fetch(`${dir}/_editors.json`);
        const editors = await editorsResults.json();
        return editors;
    } catch {
        return null;
    }
}



export async function fetchLeaderboard() {
    const list = await fetchList();
    const { PACK_DEFINITIONS } = await import('./packs.js');

    if (!Array.isArray(list)) {
        return [[], ['_list.json']];
    }

    const scoreMap = new Map();
    const errs = [];

    function getUserKey(name) {
        if (typeof name !== 'string' || !name.trim()) {
            return null;
        }

        const trimmed = name.trim();
        const normalized = trimmed.toLocaleLowerCase('en');

        for (const existing of scoreMap.keys()) {
            if (existing.toLocaleLowerCase('en') === normalized) {
                return existing;
            }
        }

        return trimmed;
    }

    function ensurePlayer(name) {
        const key = getUserKey(name);
        if (!key) return null;

        if (!scoreMap.has(key)) {
            scoreMap.set(key, {
                verified: [],
                completed: [],
                progressed: [],
                completedPaths: new Set(),
            });
        }

        return scoreMap.get(key);
    }

    for (let index = 0; index < list.length; index++) {
        const [level, error] = list[index];

        if (error || !level) {
            errs.push(error || `level-${index + 1}`);
            continue;
        }

        const rank = index + 1;
        const levelScore = percent =>
            score(rank, percent, level.percentToQualify);

        const verifier = ensurePlayer(level.verifier);

        if (verifier) {
            verifier.verified.push({
                rank,
                level: level.name,
                path: level.path,
                score: levelScore(100),
                link: level.verification,
            });

            verifier.completedPaths.add(level.path);
        }

        if (!Array.isArray(level.records)) continue;

        for (const record of level.records) {
            if (
                !record ||
                typeof record.user !== 'string' ||
                !Number.isFinite(Number(record.percent))
            ) {
                continue;
            }

            const player = ensurePlayer(record.user);
            if (!player) continue;

            const percent = Number(record.percent);

            if (percent === 100) {
                player.completed.push({
                    rank,
                    level: level.name,
                    path: level.path,
                    score: levelScore(100),
                    link: record.link,
                });

                player.completedPaths.add(level.path);
            } else {
                player.progressed.push({
                    rank,
                    level: level.name,
                    percent,
                    score: levelScore(percent),
                    link: record.link,
                });
            }
        }
    }

    // Include linked accounts even when they have no level records.
    try {
        const response = await fetch('/api/leaderboard/identities', {
            credentials: 'same-origin',
            cache: 'no-store',
        });

        if (response.ok) {
            const data = await response.json();

            if (Array.isArray(data.identities)) {
                for (const name of data.identities) {
                    ensurePlayer(name);
                }
            }
        } else {
            console.warn(
                'Could not load linked leaderboard identities:',
                response.status,
            );
        }
    } catch (error) {
        console.warn('Could not load linked leaderboard identities.', error);
    }

    const leaderboard = [...scoreMap.entries()].map(([user, stats]) => {
        const {
            verified,
            completed,
            progressed,
            completedPaths,
        } = stats;

        const packsBeaten = PACK_DEFINITIONS
            .filter(pack =>
                Array.isArray(pack.levelPaths) &&
                pack.levelPaths.length > 0 &&
                pack.levelPaths.every(path => completedPaths.has(path))
            )
            .map(pack => ({
                id: pack.id,
                name: pack.name,
                category: pack.category,
                bonus: pack.bonus,
            }));

        const levelTotal = [
            ...verified,
            ...completed,
            ...progressed,
        ].reduce((total, entry) => total + entry.score, 0);

        const packBonus = packsBeaten.reduce(
            (total, pack) => total + pack.bonus,
            0,
        );

        return {
            user,
            total: round(levelTotal + packBonus),
            verified,
            completed,
            progressed,
            packsBeaten,
            packBonus: round(packBonus),
        };
    });

    leaderboard.sort((a, b) =>
        b.total - a.total ||
        a.user.localeCompare(b.user, undefined, {
            sensitivity: 'base',
        })
    );

    return [leaderboard, errs];
}

const identityResponse = await fetch('/api/leaderboard/identities', {
    credentials: 'same-origin',
    cache: 'no-store'
});

if (identityResponse.ok) {
    const identityData = await identityResponse.json();

    for (const name of identityData.identities || []) {
        const key = getUserKey(name);

        scoreMap[key] ??= {
            verified: [],
            completed: [],
            progressed: [],
            completedPaths: new Set(),
        };
    }
}
    const res = Object.entries(scoreMap).map(([user, scores]) => {
        const { verified, completed, progressed, completedPaths } = scores;

        
const packsBeaten = PACK_DEFINITIONS
    .filter(pack =>
        pack.levelPaths.length > 0 &&
        pack.levelPaths.every(path => completedPaths.has(path))
    )
    .map(pack => ({
        id: pack.id,
        name: pack.name,
        category: pack.category,
        bonus: pack.bonus,
    }));

        const levelTotal = [verified, completed, progressed]
            .flat()
            .reduce((prev, cur) => prev + cur.score, 0);

        const packBonus = packsBeaten.reduce(
            (total, pack) => total + pack.bonus,
            0,
        );

        return {
            user,
            total: round(levelTotal + packBonus),
            verified,
            completed,
            progressed,
            packsBeaten,
            packBonus: round(packBonus),
        };
    });

    return [res.sort((a, b) => b.total - a.total), errs];
}
