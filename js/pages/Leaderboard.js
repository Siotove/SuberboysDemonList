import { fetchLeaderboard } from '../content.js';
import { localize } from '../util.js';
import { getAchievements } from '../achievements.js';
import Spinner from '../components/Spinner.js';

export default {
    components: {
        Spinner,
    },
    data: () => ({
    leaderboard: [],
    loading: true,
    avatarProfiles: [],
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
    <tr>
        <th>Rank</th>
        <th>{{ valueHeading }}</th>
        <th>Player</th>
    </tr>
    <tr v-for="(ientry, i) in sortedLeaderboard" :key="ientry.user">
        <td class="rank">
            <p class="type-label-lg">#{{ i + 1 }}</p>
        </td>
        <td class="total">
            <p class="type-label-lg">{{ rankingValue(ientry) }}</p>
        </td>
        <td class="user" :class="{ active: selected === i }">
    <button
        class="leaderboard-player-button"
        @click="selected = i"
    >
        <span class="leaderboard-avatar">
            <img
                class="leaderboard-avatar-pfp"
                :src="avatarFor(ientry).pfp"
                alt=""
                width="48"
                height="48"
            >
            <img
                v-if="avatarFor(ientry).frame"
                class="leaderboard-avatar-frame"
                :src="avatarFor(ientry).frame"
                alt=""
                width="48"
                height="48"
            >
        </span>

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
    valueHeading() {
        switch (this.sortBy) {
            case 'verified': return 'Verified';
            case 'completed': return 'Completed';
            case 'progressed': return 'Progressed';
            case 'packs': return 'Packs Beaten';
            case 'achievements': return 'Achievements';
            case 'rarest': return 'Rarity Score';
            default: return 'Points';
        }
    },

    sortedLeaderboard() {
        const count = (player, key) =>
            Array.isArray(player[key]) ? player[key].length : 0;

        return [...this.leaderboard].sort((a, b) => {
            let difference;

            switch (this.sortBy) {
                case 'verified':
                    difference = count(b, 'verified') - count(a, 'verified');
                    break;
                case 'completed':
                    difference = count(b, 'completed') - count(a, 'completed');
                    break;
                case 'progressed':
                    difference = count(b, 'progressed') - count(a, 'progressed');
                    break;
                case 'packs':
                    difference = count(b, 'packsBeaten') - count(a, 'packsBeaten');
                    break;
                case 'achievements':
                    difference = this.achievementCount(b) - this.achievementCount(a);
                    break;
                case 'rarest':
                    difference = this.rarityScore(b) - this.rarityScore(a);
                    break;
                default:
                    difference = (Number(b.total) || 0) - (Number(a.total) || 0);
            }

            // Use points to break ties.
            return difference || (Number(b.total) || 0) - (Number(a.total) || 0);
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
    try {
        const [leaderboard, err] = await fetchLeaderboard();

        this.leaderboard = leaderboard;
        this.err = err;

        const response = await fetch(
            '/api/leaderboard/avatar-frames',
            {
                credentials: 'same-origin',
                cache: 'no-store',
            }
        );

        if (response.ok) {
            const result = await response.json();
            this.avatarProfiles = result.profiles || [];
        }
    } catch (error) {
        console.error('Could not load leaderboard:', error);
    } finally {
        this.loading = false;
    }
},

methods: {
    localize,

    avatarFor(player) {
        const profile = this.avatarProfiles.find(
            item =>
                item.leaderboard_name?.toLocaleLowerCase('en') ===
                player.user?.toLocaleLowerCase('en')
        );

        const frames = {
            angy: '/assets/profile/Angy.png',
            appi: '/assets/profile/Appi.png',
            borgir: '/assets/profile/Borgir.png',
            bronze: '/assets/profile/Bronze.png',
            cool: '/assets/profile/Cool.png',
            diamond: '/assets/profile/Diamond.png',
            fire: '/assets/profile/Fire%20Frame.png',
            furter: '/assets/profile/Furter.png',
            gold: '/assets/profile/Gold.png',
            hidrog: '/assets/profile/Hidrog.png',
            honeycomb: '/assets/profile/Honeycomb.png',
            legendary: '/assets/profile/Legendary.png',
            platinum: '/assets/profile/Platinum.png',
            polish: '/assets/profile/Polish.png',
            punpkin: '/assets/profile/Punpkin.png',
            ssjjasaiah: '/assets/profile/SSJJasaiah.png',
            silver: '/assets/profile/Silver.png',
            victory: '/assets/profile/Victory.png',
            wjat: '/assets/profile/Wjat.png',
            gartyen: '/assets/profile/gartyen.png',
        };

        return {
            pfp: profile?.avatar_url || '/assets/profile/No%20PFP.png',
            frame: frames[profile?.equipped_frame] || null,
        };
    },

    achievementCount(player) {
        return getAchievements(player).filter(
            achievement => achievement.unlocked
        ).length;
    },

    rarityScore(player) {
        const unlocked = getAchievements(player).filter(
            achievement => achievement.unlocked
        );

        if (this.leaderboard.length === 0) return 0;

        return unlocked.reduce((score, achievement) => {
            const holders = this.leaderboard.filter(other =>
                getAchievements(other).some(item =>
                    item.id === achievement.id && item.unlocked
                )
            ).length;

            return score + (1 / Math.max(holders, 1));
        }, 0);
    },

    rankingValue(player) {
        switch (this.sortBy) {
            case 'verified':
                return player.verified?.length || 0;
            case 'completed':
                return player.completed?.length || 0;
            case 'progressed':
                return player.progressed?.length || 0;
            case 'packs':
                return player.packsBeaten?.length || 0;
            case 'achievements':
                return this.achievementCount(player);
            case 'rarest':
                return this.rarityScore(player).toFixed(2);
            default:
                return localize(player.total);
        }
    },
},
};
