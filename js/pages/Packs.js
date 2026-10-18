import { fetchList } from '../content.js';
import Spinner from '../components/Spinner.js';

const PACK_DEFINITIONS = [
    {
        id: 'starter-pack',
        name: 'Starter Pack',
        bonus: 100,
        levelPaths: [
            // Add exact paths from data/_list.json here
        ],
    },
];

export default {
    components: { Spinner },

    template: `
        <main class="page-packs">
            <h1>Packs</h1>
            <p class="packs-description">
                Complete every level in a pack at 100% to earn bonus points.
            </p>

            <div v-if="loading" class="packs-loading">
                <Spinner />
            </div>

            <div v-else class="packs-grid">
                <article
                    v-for="pack in packs"
                    :key="pack.id"
                    class="pack-card"
                >
                    <h2>{{ pack.name }}</h2>
                    <p class="pack-bonus">Bonus: {{ pack.bonus }} points</p>

                    <p v-if="pack.levels.length === 0">
                        Levels will appear here once added to this pack.
                    </p>

                    <ul v-else class="pack-levels">
                        <li v-for="level in pack.levels" :key="level.path">
                            <span>#{{ level.rank }} — {{ level.name }}</span>
                        </li>
                    </ul>
                </article>
            </div>
        </main>
    `,

    data: () => ({
        loading: true,
        packs: [],
    }),

    async mounted() {
        try {
            const result = await fetchList();

            const levels = (result || [])
                .filter(([level]) => level)
                .map(([level], index) => ({
                    ...level,
                    rank: index + 1,
                }));

            this.packs = PACK_DEFINITIONS.map(pack => ({
                ...pack,
                levels: pack.levelPaths
                    .map(path => levels.find(level => level.path === path))
                    .filter(Boolean),
            }));
        } catch (error) {
            console.error('Failed to load packs:', error);
        } finally {
            this.loading = false;
        }
    },
};



Step 2 — Fix the styling
Open css/pages/packs.css, delete its current contents, and paste this:

.page-packs {
    width: 100%;
    max-width: 1200px;
    margin: 0 auto;
    padding: 32px;
    box-sizing: border-box;
    color: var(--color-on-background);
    font-family: 'Lexend Deca', sans-serif;
}

.page-packs h1 {
    margin: 0 0 12px;
    font-size: 36px;
}

.packs-description {
    margin: 0 0 28px;
    color: #aaa;
    font-size: 14px;
}

.packs-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
    gap: 20px;
    width: 100%;
}

.pack-card {
    min-width: 0;
    padding: 20px;
    border-radius: 10px;
    background: var(--color-background);
    border: 1px solid rgba(150, 150, 150, 0.25);
    box-sizing: border-box;
}

.pack-card h2 {
    margin: 0 0 10px;
    font-size: 22px;
}

.pack-bonus {
    margin: 0 0 18px;
    color: #ffd700;
    font-weight: 700;
}

.pack-levels {
    list-style: none;
    padding: 0;
    margin: 0;
}

.pack-levels li {
    padding: 10px 0;
    border-top: 1px solid rgba(150, 150, 150, 0.2);
    font-size: 14px;
    overflow-wrap: anywhere;
}

.packs-loading {
    padding: 24px 0;
}
