import { fetchLeaderboard } from '../content.js';
import { localize } from '../util.js';
import Spinner from '../components/Spinner.js';

export default {
    components: { Spinner },
    data() {
        return {
            players: [],
            selectedPlayer: '',
            history: [],
            metric: 'rank',
            loading: true,
            historyLoading: false,
            error: null,
            historyError: null,
            leaderboardErrors: []
        };
    },
    template: `
        <main class="rank-history-page">
            <header class="rank-history-header">
                <p class="rank-history-eyebrow">PLAYER PROGRESSION</p>
                <h1>Rank History</h1>
                <p>See how a player's leaderboard position and points have changed over time.</p>
            </header>

            <div v-if="loading" class="rank-history-loading"><Spinner /></div>
            <section v-else>
                <div v-if="error" class="rank-history-message rank-history-message--error">{{ error }}</div>
                <div class="rank-history-controls">
                    <div class="rank-history-field">
                        <label for="rank-history-player">Player</label>
                        <select id="rank-history-player" v-model="selectedPlayer" @change="loadHistory">
                            <option value="">Choose a player...</option>
                            <option v-for="player in players" :key="player.user" :value="player.user">{{ player.user }}</option>
                        </select>
                    </div>
                    <div class="rank-history-field">
                        <label for="rank-history-metric">Chart</label>
                        <select id="rank-history-metric" v-model="metric">
                            <option value="rank">Leaderboard rank</option>
                            <option value="points">Total points</option>
                        </select>
                    </div>
                </div>

                <template v-if="selectedPlayer">
                    <div class="rank-history-stats">
                        <article class="rank-history-stat">
                            <span>Latest rank</span>
                            <strong>{{ latestRank ? '#' + latestRank : '—' }}</strong>
                            <small>{{ latestDateLabel }}</small>
                        </article>
                        <article class="rank-history-stat">
                            <span>Best saved rank</span>
                            <strong>{{ bestRank ? '#' + bestRank : '—' }}</strong>
                            <small>Lower rank numbers are better</small>
                        </article>
                        <article class="rank-history-stat">
                            <span>Latest points</span>
                            <strong>{{ latestPoints === null ? '—' : localize(latestPoints) }}</strong>
                            <small>{{ history.length }} daily snapshot{{ history.length === 1 ? '' : 's' }}</small>
                        </article>
                    </div>

                    <section class="rank-history-panel">
                        <div class="rank-history-panel-heading">
                            <div>
                                <h2>{{ metric === 'rank' ? 'Rank over time' : 'Points over time' }}</h2>
                                <p v-if="history.length">{{ history[0].snapshot_date }} to {{ history[history.length - 1].snapshot_date }}</p>
                            </div>
                            <span class="rank-history-live-dot">Daily snapshots</span>
                        </div>
                        <div v-if="historyLoading" class="rank-history-loading"><Spinner /></div>
                        <div v-else-if="historyError" class="rank-history-message rank-history-message--error">{{ historyError }}</div>
                        <div v-else-if="history.length < 2" class="rank-history-empty">
                            <span class="rank-history-empty-icon">↗</span>
                            <h3>History is getting started</h3>
                            <p v-if="history.length === 1">The first snapshot was saved on {{ history[0].snapshot_date }}. New snapshots are recorded daily, so the graph will fill in over time.</p>
                            <p v-else>A daily snapshot will be saved when this page is opened. Check back after the next daily update to see the trend.</p>
                        </div>
                        <div v-else class="rank-history-chart-wrap">
                            <svg class="rank-history-chart" viewBox="0 0 900 300" role="img" :aria-label="metric === 'rank' ? 'Historical leaderboard rank chart' : 'Historical total points chart'">
                                <g class="rank-history-grid-lines">
                                    <line v-for="guide in chartGuides" :key="guide" x1="42" :y1="guide" x2="874" :y2="guide" />
                                </g>
                                <polyline class="rank-history-line" :points="chartPoints" />
                                <circle v-for="(item, index) in history" :key="item.snapshot_date" class="rank-history-point" :cx="chartX(index)" :cy="chartY(item)" r="4">
                                    <title>{{ item.snapshot_date }} · {{ metric === 'rank' ? '#' + item.rank : localize(item.total_points) + ' points' }}</title>
                                </circle>
                            </svg>
                            <div class="rank-history-chart-labels"><span>{{ history[0].snapshot_date }}</span><span>{{ history[history.length - 1].snapshot_date }}</span></div>
                            <p class="rank-history-chart-note" v-if="metric === 'rank'">The chart is oriented so a better rank appears higher.</p>
                        </div>
                    </section>

                    <section class="rank-history-panel">
                        <div class="rank-history-panel-heading">
                            <div><h2>Recent snapshots</h2><p>Daily records from the history tracker.</p></div>
                        </div>
                        <div v-if="history.length" class="rank-history-table-scroll">
                            <table class="rank-history-table">
                                <thead><tr><th>Date (UTC)</th><th>Rank</th><th>Points</th><th>Completed</th><th>Verified</th></tr></thead>
                                <tbody>
                                    <tr v-for="item in recentHistory" :key="item.snapshot_date">
                                        <td>{{ item.snapshot_date }}</td>
                                        <td>#{{ item.rank }}</td>
                                        <td>{{ localize(item.total_points) }}</td>
                                        <td>{{ item.completed_count }}</td>
                                        <td>{{ item.verified_count }}</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                        <p v-else class="rank-history-empty-copy">No snapshots have been saved yet.</p>
                    </section>
                </template>
            </section>
        </main>
    `,
    computed: {
        selectedPlayerData() {
            return this.players.find(player => player.user === this.selectedPlayer) || null;
        },
        latestRow() {
            return this.history.length ? this.history[this.history.length - 1] : null;
        },
        latestRank() {
            return this.latestRow ? Number(this.latestRow.rank) : null;
        },
        latestPoints() {
            return this.latestRow ? Number(this.latestRow.total_points) : null;
        },
        bestRank() {
            const ranks = this.history.map(item => Number(item.rank)).filter(rank => Number.isFinite(rank) && rank > 0);
            return ranks.length ? Math.min(...ranks) : null;
        },
        latestDateLabel() {
            return this.latestRow ? this.latestRow.snapshot_date + ' (UTC)' : 'Awaiting first snapshot';
        },
        recentHistory() {
            return [...this.history].reverse().slice(0, 30);
        },
        chartGuides() {
            return [35, 92.5, 150, 207.5, 265];
        },
        chartPoints() {
            return this.history.map((item, index) => `${this.chartX(index)},${this.chartY(item)}`).join(' ');
        }
    },
    methods: {
        localize,
        chartX(index) {
            if (this.history.length <= 1) return 458;
            return 42 + (index / (this.history.length - 1)) * 832;
        },
        chartY(item) {
            const values = this.history.map(row => this.metric === 'rank' ? Number(row.rank) : Number(row.total_points)).filter(Number.isFinite);
            if (!values.length) return 150;
            const minimum = Math.min(...values);
            const maximum = Math.max(...values);
            const value = this.metric === 'rank' ? Number(item.rank) : Number(item.total_points);
            if (maximum === minimum) return 150;
            const ratio = (value - minimum) / (maximum - minimum);
            return this.metric === 'rank' ? 35 + ratio * 230 : 265 - ratio * 230;
        },
        async loadHistory() {
            this.history = [];
            this.historyError = null;
            if (!this.selectedPlayer) return;
            this.historyLoading = true;
            try {
                const response = await fetch(`/api/rank-history?player=${encodeURIComponent(this.selectedPlayer)}`, {
                    credentials: 'same-origin',
                    cache: 'no-store'
                });
                const result = await response.json().catch(() => ({}));
                if (!response.ok) throw new Error(result.error || 'Could not load rank history.');
                this.history = Array.isArray(result.history) ? result.history : [];
            } catch (error) {
                this.historyError = error.message || 'Could not load rank history.';
            } finally {
                this.historyLoading = false;
            }
        }
    },
    async mounted() {
        try {
            const [leaderboard, errors] = await fetchLeaderboard();
            this.players = leaderboard || [];
            this.leaderboardErrors = errors || [];
            const queryPlayer = typeof this.$route?.query?.player === 'string' ? this.$route.query.player : '';
            this.selectedPlayer = this.players.find(player => player.user.toLocaleLowerCase('en') === queryPlayer.toLocaleLowerCase('en'))?.user || this.players[0]?.user || '';
            if (this.selectedPlayer) await this.loadHistory();
        } catch (error) {
            this.error = error.message || 'Could not load the leaderboard.';
        } finally {
            this.loading = false;
        }
    }
};
