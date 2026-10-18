
import { fetchList } from '../content.js';
import Spinner from '../components/Spinner.js';

const PACK_DEFINITIONS = [
    {
        id: 'starter-pack',
        name: 'Starter Pack',
        bonus: 100,
        levelPaths: [
            'easy/level-1',
            'easy/level-2',
            'easy/level-3',
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

            <p v-else-if="error" class="packs-error">
                Could not load the level list. Please refresh the page.
            </p>

            <div v-else class="packs-grid">
                <article
                    v-for="pack in packs"
                    :key="pack.id"
                    class="pack-card"
                >
                    <h2>{{ pack.name }}</h2>
                    <p class="pack-bonus">
                        Bonus: {{ pack.bonus }} points
                    </p>

                    <p v-if="pack.levels.length === 0">
                        No levels have been added to this pack yet.
                    </p>

                    <ul v-else class="pack-levels">
                        <li
                            v-for="level in pack.levels"
                            :key="level.path"
                        >
                            <span>#{{ level.rank }}</span>
                            <span>{{ level.name }}</span>
                        </li>
                    </ul>
                </article>

                <p v-if="packs.length === 0">
                    No packs have been configured yet.
                </p>
            </div>
        </main>
    `,

    data() {
        return {
            loading: true,
            error: false,
            packs: [],
        };
    },

    async mounted() {
        try {
            const result = await fetchList();

            if (!result) {
                throw new Error('The level list could not be loaded.');
            }

            const levels = result
                .filter(([level]) => level)
                .map(([level], index) => ({
                    ...level,
                    rank: index + 1,
                }));

            this.packs = PACK_DEFINITIONS.map(pack => ({
                ...pack,
                levels: pack.levelPaths
                    .map(path =>
                        levels.find(level => level.path === path)
                    )
                    .filter(Boolean),
            }));
        } catch (error) {
            console.error('Failed to load packs:', error);
            this.error = true;
        } finally {
            this.loading = false;
        }
    },
};
