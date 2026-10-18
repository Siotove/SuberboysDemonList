
import { fetchList } from '../content.js';
import Spinner from '../components/Spinner.js';

const PACK_DEFINITIONS = [
    {
        id: 'milestone-pack',
        name: 'Milestone Trilogy',
        bonus: 100,
        levelPaths: [
            'MilestoneI',
            'MilestoneII',
            'MilestoneIII',
        ],
    },
    {
        id: 'aina-pack',
        name: 'Aina Poni Duo',
        bonus: 150,
        levelPaths: [
            'AinaPoni',
            'AinaPoniII',
        ],
    },
    {
        id: 'polychromatical-pack',
        name: 'Polychromaticals',
        bonus: 200,
        levelPaths: [
            'Polychromatical',
            'PolychromaticalII',
        ],
    },
    {
        id: 'sadaclysm-pack',
        name: 'Sadaclysm Versions',
        bonus: 250,
        levelPaths: [
            'Sadaclysm',
            'USadaclysm',
        ],
    },
];

export default {
    components: { Spinner },

    template: `
        <main class="page-packs">
            <h1>Packs</h1>
            <p class="packs-description">
                Don't bother with packs right now, they are in the works.
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
