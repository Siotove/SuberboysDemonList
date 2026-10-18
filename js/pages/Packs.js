import { fetchList, fetchLeaderboard } from '../content.js';
import { PACK_DEFINITIONS, PACK_CATEGORIES } from '../packs.js';
import Spinner from '../components/Spinner.js';

export default {
    components: { Spinner },

    template: `
        <main class="page-packs">
            <h1>Packs</h1>
            <p class="packs-description">
                WE GOT PACKS BABYYY
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
<button
    class="pack-beaten-count"
    @click="toggleVictors(pack.id)"
>
    {{ pack.beatenCount }} victors
</button>

<div
    v-if="expandedPack === pack.id"
    class="pack-victors"
>
    <p
        v-for="name in pack.victorNames"
        :key="name"
    >
        {{ name }}
    </p>

    <p v-if="pack.victorNames.length === 0">
        No victors yet!
    </p>
</div>
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
        expandedPack: null,
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
methods: {
    toggleVictors(packId) {
        this.expandedPack =
            this.expandedPack === packId ? null : packId;
    },
},
    async mounted() {
        try {
            const result = await fetchList();

            if (!result) {
                throw new Error('The level list could not be loaded nyeheheh.');
            }

            const levels = result
                .filter(([level]) => level)
                .map(([level], index) => ({
                    ...level,
                    rank: index + 1,
                }));


const [leaderboard] = await fetchLeaderboard();

this.packs = PACK_DEFINITIONS.map(pack => {
    const victorNames = leaderboard
        .filter(player =>
            player.packsBeaten.some(beaten => beaten.id === pack.id)
        )
        .map(player => player.user);

    return {
        ...pack,
        levels: pack.levelPaths
            .map(path => levels.find(level => level.path === path))
            .filter(Boolean),
        victorNames,
        beatenCount: victorNames.length,
    };
});
        } catch (error) {
            console.error('Failed to load pakks:', error);
            this.error = true;
        } finally {
            this.loading = false;
        }
    },
};
