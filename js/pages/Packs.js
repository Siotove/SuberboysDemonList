
import { PACK_DEFINITIONS, PACK_CATEGORIES } from '../packs.js';
import { fetchList } from '../content.js';
import Spinner from '../components/Spinner.js';

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

            <div v-else>
                <div class="packs-filter">
                    <label for="pack-category">Category:</label>
                    <select id="pack-category" v-model="selectedCategory">
                        <option value="All">All categories</option>
                        <option
                            v-for="category in categories"
                            :key="category"
                            :value="category"
                        >
                            {{ category }}
                        </option>
                    </select>
                </div>

                <div class="packs-grid">
                    <article
                        v-for="pack in filteredPacks"
                        :key="pack.id"
                        class="pack-card"
                    >
                        <h2>{{ pack.name }}</h2>
                        
<p
    class="pack-category"
    :class="'category-' + (pack.category || 'uncategorized').toLowerCase()"
>
    {{ pack.category || 'Uncategorized' }}
</p>
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

                    <p v-if="filteredPacks.length === 0">
                        No packs found in this category.
                    </p>
                </div>
            </div>
        </main>
    `,

    data() {
        return {
            loading: true,
            error: false,
            packs: [],
            selectedCategory: 'All',
        };
    },

    
    computed: {
        categories() {
            return PACK_CATEGORIES;
        },

        filteredPacks() {
            if (this.selectedCategory === 'All') {
                return this.packs;
            }

            return this.packs.filter(
                pack =>
                    (pack.category || 'Uncategorized') === this.selectedCategory
            );
        },
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
