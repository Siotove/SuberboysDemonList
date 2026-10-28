export default {
    name: 'CompetitionSeasonWidget',
    props: { players: { type: Array, default: () => [] } },
    data() {
        return { seasons: [], seasonId: '', activeSeasonId: '', baselinePoints: {}, serverStandings: [], loading: true, error: '', snapshotDate: '', liveMode: false, status: '' };
    },
    computed: {
        selectedSeason() { return this.seasons.find(item => item.id === this.seasonId) || null; },
        displayStandings() {
            if (this.liveMode) {
                return this.players.map(player => {
                    const key = String(player.user || '').trim().toLocaleLowerCase('en');
                    const hasBaseline = Object.prototype.hasOwnProperty.call(this.baselinePoints, key);
                    const baseline = hasBaseline ? Number(this.baselinePoints[key]) || 0 : Number(player.total) || 0;
                    return { name: player.user, totalPoints: Number(player.total) || 0, points: Math.max(0, (Number(player.total) || 0) - baseline) };
                }).sort((a, b) => b.points - a.points || b.totalPoints - a.totalPoints || a.name.localeCompare(b.name)).slice(0, 10).map((row, index) => ({ ...row, seasonRank: index + 1 }));
            }
            return this.serverStandings.slice(0, 10);
        }
    },
    template: `
        <section class="competition-season-card">
            <header class="competition-season-header"><div><span class="competition-eyebrow">COMPETITIVE SEASONS</span><h2>{{ selectedSeason ? selectedSeason.name : 'Season leaderboard' }}</h2></div><span v-if="liveMode" class="competition-live-label">Live</span></header>
            <div class="competition-season-controls">
                <label for="competition-season-select">Season</label>
                <select id="competition-season-select" v-model="seasonId" @change="loadSelected" :disabled="loading || !seasons.length">
                    <option v-for="season in seasons" :key="season.id" :value="season.id">{{ season.name }}{{ Number(season.is_active) === 1 ? ' · Active' : '' }}</option>
                </select>
                <button type="button" @click="loadSelected" :disabled="loading || !seasonId">{{ loading ? 'Loading…' : 'Refresh' }}</button>
            </div>
            <p v-if="error" class="competition-error" role="alert">{{ error }}</p>
            <p v-else-if="status === 'upcoming'" class="competition-muted">This season has not started yet.</p>
            <p v-else-if="status === 'waiting-for-snapshots'" class="competition-muted">Season results will appear after the first rank snapshot.</p>
            <template v-else>
                <p class="competition-muted">Scores are points gained since the season baseline. History starts from the first available daily snapshot; older data is not invented.</p>
                <div v-if="displayStandings.length" class="competition-season-table">
                    <div v-for="row in displayStandings" :key="row.name" class="competition-season-row">
                        <span class="competition-season-rank">#{{ row.seasonRank || row.rank }}</span><strong>{{ row.name }}</strong><span class="competition-season-points">+{{ formatPoints(row.points) }}</span>
                    </div>
                </div>
                <p v-else class="competition-muted">No players have season results yet.</p>
                <small v-if="snapshotDate" class="competition-muted">Data through {{ snapshotDate }}.</small>
            </template>
        </section>
    `,
    async mounted() { await this.loadSeasons(); },
    methods: {
        formatPoints(value) { return (Number(value) || 0).toLocaleString('en-GB', { maximumFractionDigits: 3 }); },
        async loadSeasons() {
            this.loading = true;
            try {
                const response = await fetch('/api/competition/seasons', { cache: 'no-store' });
                const result = await response.json();
                if (!response.ok) throw new Error(result.error || 'Could not load seasons.');
                this.seasons = result.seasons || [];
                this.activeSeasonId = result.activeSeasonId || '';
                this.seasonId = this.activeSeasonId || this.seasons[0]?.id || '';
                if (this.seasonId) await this.loadSelected();
                else { this.status = 'waiting-for-snapshots'; this.loading = false; }
            } catch (error) { this.error = error.message || 'Could not load seasons.'; this.loading = false; }
        },
        async loadSelected() {
            if (!this.seasonId) return;
            this.loading = true;
            this.error = '';
            try {
                const response = await fetch('/api/competition/seasons?season=' + encodeURIComponent(this.seasonId), { cache: 'no-store' });
                const result = await response.json();
                if (!response.ok) throw new Error(result.error || 'Could not load season standings.');
                this.seasons = result.seasons || this.seasons;
                this.activeSeasonId = result.activeSeasonId || this.activeSeasonId;
                this.baselinePoints = result.baselinePoints || {};
                this.serverStandings = result.standings || [];
                this.snapshotDate = result.snapshotDate || '';
                this.liveMode = result.liveMode === true;
                this.status = result.status || '';
            } catch (error) { this.error = error.message || 'Could not load season standings.'; }
            finally { this.loading = false; }
        }
    }
};
