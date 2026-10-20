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

    const scoreMap = {};
    const errs = [];
    const getUserKey = (name) =>
        Object.keys(scoreMap).find(
            (u) => u.toLowerCase() === name.toLowerCase(),
        ) || name;

    list.forEach(([level, err], rank) => {
        if (err) {
            errs.push(err);
            return;
        }

        const verifier = getUserKey(level.verifier);
        scoreMap[verifier] ??= {
            verified: [],
            completed: [],
            progressed: [],
            completedPaths: new Set(),
        };

        scoreMap[verifier].verified.push({
            rank: rank + 1,
            level: level.name,
            path: level.path,
            score: score(rank + 1, 100, level.percentToQualify),
            link: level.verification,
        });
        scoreMap[verifier].completedPaths.add(level.path);

        level.records.forEach((record) => {
            const user = getUserKey(record.user);
            scoreMap[user] ??= {
                verified: [],
                completed: [],
                progressed: [],
                completedPaths: new Set(),
            };

            if (record.percent === 100) {
                scoreMap[user].completed.push({
                    rank: rank + 1,
                    level: level.name,
                    path: level.path,
                    score: score(rank + 1, 100, level.percentToQualify),
                    link: record.link,
                });
                scoreMap[user].completedPaths.add(level.path);
                return;
            }

            scoreMap[user].progressed.push({
                rank: rank + 1,
                level: level.name,
                percent: record.percent,
                score: score(rank + 1, record.percent, level.percentToQualify),
                link: record.link,
            });
        });
    });
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
