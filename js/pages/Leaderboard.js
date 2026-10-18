import { fetchLeaderboard } from '../content.js';
import { localize } from '../util.js';
import { ACHIEVEMENTS, getAchievements } from '../achievements.js';
import Spinner from '../components/Spinner.js';

export default {
    components: {
        Spinner,
    },
    data: () => ({
    leaderboard: [],
    loading: true,
    selected: 0,
    sortBy: 'points',
    err: [],
    }),
    template: `
        <main v-if="loading">
            <Spinner></Spinner>
        </main>
        <main v-else class="page-leaderboard-container">
            <div class="page-leaderboard">
                <div class="error-container">
                    <p class="error" v-if="err.length > 0">
                        Leaderboard may be incorrect, as the following levels could not be loaded: {{ err.join(', ') }}
                    </p>
                </div>
                <div class="board-container">
                <div class="leaderboard-controls">
    <label for="leaderboard-sort">Sort by:</label>
    <select id="leaderboard-sort" v-model="sortBy"
        @change="selected = 0">
        <option value="points">Most Points</option>
        <option value="verified">Most Verified Levels</option>
        <option value="completed">Most Completed Levels</option>
        <option value="progressed">Most Progressed Levels</option>
        <option value="packs">Most Packs Beaten</option>
        <option value="achievements">Most Achievements</option>
<option value="rarest">Rarest Achievements</option>
    </select>
</div>
                    <table class="board">
                        <tr v-for="(ientry, i) in sortedLeaderboard" :key="ientry.user">
                            <td class="rank">
                                <p class="type-label-lg">#{{ i + 1 }}</p>
                            </td>
                            <tr>
    <th>Rank</th>
    <th>{{ valueHeading }}</th>
    <th>Player</th>
</tr>
                            <td class="total">
    <p class="type-label-lg">{{ rankingValue(ientry) }}</p>
</td>
                            <td class="user" :class="{ 'active': selected == i }">
                                <button @click="selected = i">
                                    <span class="type-label-lg">{{ ientry.user }}</span>
                                </button>
                            </td>
                        </tr>
                    </table>
                </div>
                <div class="player-container">
                    <div class="player">
                        <h1>#{{ selected + 1 }} {{ entry.user }}</h1>
                        <h3>{{ entry.total }}</h3>
                        <h2 v-if="entry.verified.length > 0">Verified ({{ entry.verified.length}})</h2>
                        <table class="table">
                            <tr v-for="score in entry.verified">
                                <td class="rank">
                                    <p>#{{ score.rank }}</p>
                                </td>
                                <td class="level">
                                    <a class="type-label-lg" target="_blank" :href="score.link">{{ score.level }}</a>
                                </td>
                                <td class="score">
                                    <p>+{{ localize(score.score) }}</p>
                                </td>
                            </tr>
                        </table>
                        <h2 v-if="entry.completed.length > 0">Completed ({{ entry.completed.length }})</h2>
                        <table class="table">
                            <tr v-for="score in entry.completed">
                                <td class="rank">
                                    <p>#{{ score.rank }}</p>
                                </td>
                                <td class="level">
                                    <a class="type-label-lg" target="_blank" :href="score.link">{{ score.level }}</a>
                                </td>
                                <td class="score">
                                    <p>+{{ localize(score.score) }}</p>
                                </td>
                            </tr>
                        </table>
                        <h2 v-if="entry.progressed.length > 0">Progressed ({{entry.progressed.length}})</h2>
                        <table class="table">
                            <tr v-for="score in entry.progressed">
                                <td class="rank">
                                    <p>#{{ score.rank }}</p>
                                </td>
                                <td class="level">
                                    <a class="type-label-lg" target="_blank" :href="score.link">{{ score.percent }}% {{ score.level }}</a>
                                </td>
                                <td class="score">
                                    <p>+{{ localize(score.score) }}</p>
                                </td>
                            </tr>
                        </table>
                        <h2 v-if="entry.packsBeaten && entry.packsBeaten.length > 0">
    Packs Beaten ({{ entry.packsBeaten.length }})
</h2>
<table class="table" v-if="entry.packsBeaten && entry.packsBeaten.length > 0">
    <tr v-for="pack in entry.packsBeaten" :key="pack.id">
        <td class="level">
            <span class="type-label-lg">{{ pack.name }}</span>
        </td>
        <td class="score">
            <p>+{{ localize(pack.bonus) }}</p>
        </td>
    </tr>
</table>
                    </div>
                </div>
            </div>
        </main>
    `,
    computed: {
        sortedLeaderboard() {
    const count = (player, key) =>
        Array.isArray(player[key]) ? player[key].length : 0;

    return [...this.leaderboard].sort((a, b) => {
        switch (this.sortBy) {
            case 'verified':
                return count(b, 'verified') - count(a, 'verified');
            case 'completed':
                return count(b, 'completed') - count(a, 'completed');
            case 'progressed':
                return count(b, 'progressed') - count(a, 'progressed');
            case 'packs':
                return count(b, 'packsBeaten') - count(a, 'packsBeaten');
            default:
                return (Number(b.total) || 0) - (Number(a.total) || 0);
        }
    });
},
        entry() {
    return this.sortedLeaderboard[this.selected] || {
        user: 'No players',
        total: 0,
        verified: [],
        completed: [],
        progressed: [],
        packsBeaten: [],
    };
},
    },
    async mounted() {
        const [leaderboard, err] = await fetchLeaderboard();
        this.leaderboard = leaderboard;
        this.err = err;
        // Hide loading spinner
        this.loading = false;
    },
    methods: {
        localize,
    },
};
