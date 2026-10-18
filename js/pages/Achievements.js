import { fetchLeaderboard } from '../content.js';
import { ACHIEVEMENTS, getAchievements } from '../achievements.js';
import Spinner from '../components/Spinner.js';

export default {
    components: {
        Spinner,
    },

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
