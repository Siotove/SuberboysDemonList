import { fetchLeaderboard } from '../content.js';
import { ACHIEVEMENTS, getAchievements } from '../achievements.js';
import Spinner from '../components/Spinner.js';

export default {
    components: {
        Spinner,
    },

template: `
    <main class="achievements-page">
        <h1>Achievements</h1>
        <p>Choose a player to view their achievements.</p>

        <div v-if="loading" class="achievements-loading">
            <Spinner />
        </div>

        <div v-else>
            <label for="achievement-player">Player</label>
            <select id="achievement-player" v-model="selectedPlayer">
                <option value="">Choose a player...</option>
                <option
                    v-for="player in players"
                    :key="player.user"
                    :value="player.user"
                >
                    {{ player.user }}
                </option>
            </select>

            <div v-if="selectedPlayerData">
                <h2>{{ selectedPlayerData.user }}</h2>

                
<div class="achievement-summary">
    <p>
        <strong>
            {{ selectedPlayerData.achievements.filter(a => a.unlocked).length }}
            / {{ achievements.length }}
        </strong>
        achievements unlocked
    </p>

    <div
        class="achievement-progress"
        role="progressbar"
        :aria-valuenow="selectedPlayerData.achievements.filter(a => a.unlocked).length"
        :aria-valuemin="0"
        :aria-valuemax="achievements.length"
        aria-label="Achievement completion"
    >
        <div
            class="achievement-progress__fill"
            :style="{
                width: (
                    selectedPlayerData.achievements.filter(a => a.unlocked).length
                    / achievements.length * 100
                ) + '%'
            }"
        ></div>
    </div>
</div>

                <div class="achievement-grid">
                    <article
                        v-for="achievement in selectedPlayerData.achievements"
                        :key="achievement.id"
                        class="achievement-card"
                        :class="[
                            'tier-' + achievement.tier.toLowerCase(),
                            { 'is-locked': !achievement.unlocked }
                        ]"
                    >
                        <div class="achievement-icon">
                            {{ achievement.unlocked ? '🏆' : '🔒' }}
                        </div>

                        <h3>{{ achievement.name }}</h3>
                        <p>{{ achievement.description }}</p>

                        <span class="achievement-tier">
                            {{ achievement.tier }}
                        </span>

                        <p class="achievement-status">
                            {{ achievement.unlocked ? 'Unlocked!' : 'Locked' }}
                        </p>
                    </article>
                </div>
            </div>
        </div>
    </main>
`,
    data() {
        return {
            leaderboard: [],
            loading: true,
            error: null,
            selectedPlayer: '',
        };
    },

    computed: {
        achievements() {
            return ACHIEVEMENTS;
        },

        players() {
            return this.leaderboard.map(player => ({
                ...player,
                achievements: getAchievements(player),
            }));
        },

        selectedPlayerData() {
            return this.players.find(
                player => player.user === this.selectedPlayer
            ) || null;
        },
    },

    async mounted() {
        const [leaderboard, errors] = await fetchLeaderboard();

        this.leaderboard = leaderboard;
        this.loading = false;

        if (errors.length > 0) {
            console.warn('Some leaderboard data could not be loaded:', errors);
        }
    },
};

