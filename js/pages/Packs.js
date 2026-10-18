import { fetchList } from '../content.js';
import Spinner from '../components/Spinner.js';

export default {
    components: { Spinner },

    template: `
        <main class="page-packs">
            <h1>Packs</h1>
            <p>
                Complete every level in a pack at 100%
                to earn bonus points.
            </p>

            <div v-if="loading">
                <Spinner />
            </div>

            <div v-else>
                <p>Levels loaded: {{ levels.length }}</p>
                <p v-if="levels.length === 0">
                    No levels could be loaded.
                </p>

                <ul>
                    <li v-for="level in levels" :key="level.path">
                        #{{ level.rank }} — {{ level.name }}
                    </li>
                </ul>
            </div>
        </main>
    `,

    data: () => ({
        loading: true,
        levels: [],
    }),

    async mounted() {
        try {
            const result = await fetchList();

            this.levels = (result || [])
                .filter(([level]) => level)
                .map(([level], index) => ({
                    ...level,
                    rank: index + 1,
                }));
        } catch (error) {
            console.error('Failed to load levels:', error);
        } finally {
            this.loading = false;
        }
    },
};
