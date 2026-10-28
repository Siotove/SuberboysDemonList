import Spinner from '../components/Spinner.js';
export default {
    components: { Spinner },
    data() { return { loading: true, comparing: false, error: '', notice: '', players: [], playerA: '', playerB: '', result: null }; },
    template: `
        <main class="community-page community-compare-page">
            <header class="community-header">
                <p class="community-eyebrow">HEAD TO HEAD</p>
                <h1>Player Battles</h1>
                <p>Compare leaderboard points, records, hardest levels and shared completions. Share the URL to show the same matchup.</p>
            </header>
            <section class="community-panel">
                <div class="community-section-heading"><div><h2>Choose your players</h2><p>Comparisons use the latest saved leaderboard snapshot and published level records.</p></div></div>
                <div v-if="loading" class="community-loading"><Spinner /></div>
                <template v-else>
                    <div class="community-form-grid community-battle-selects">
                        <label>Player A<select v-model="playerA"><option value="">Choose a player…</option><option v-for="player in players" :key="'a-' + player.name" :value="player.name">#{{ player.rank }} · {{ player.name }}</option></select></label>
                        <div class="community-versus">VS</div>
                        <label>Player B<select v-model="playerB"><option value="">Choose a player…</option><option v-for="player in players" :key="'b-' + player.name" :value="player.name">#{{ player.rank }} · {{ player.name }}</option></select></label>
                    </div>
                    <div class="community-form-actions"><button class="community-button" @click="compare" :disabled="comparing || !playerA || !playerB || playerA === playerB">{{ comparing ? 'Comparing…' : 'Compare players' }}</button><button v-if="result" class="community-button community-button--quiet" @click="copyLink">Copy matchup link</button></div>
                </template>
                <div v-if="error" class="community-alert community-alert--error">{{ error }}</div>
                <div v-if="notice" class="community-alert">{{ notice }}</div>
            </section>
            <template v-if="result">
                <section class="community-battle-summary">
                    <article class="community-battle-player" :class="{ 'is-ahead': Number(result.playerA.totalPoints) > Number(result.playerB.totalPoints) }"><span class="community-player-side">PLAYER A</span><h2>{{ result.playerA.name }}</h2><strong class="community-battle-points">{{ formatPoints(result.playerA.totalPoints) }}</strong><span>points</span><router-link class="community-button community-button--quiet community-button--small" :to="profileRoute(result.playerA.name)">View profile</router-link></article>
                    <div class="community-battle-middle"><span>POINT DIFFERENCE</span><strong>{{ result.pointDifference > 0 ? '+' : '' }}{{ formatPoints(result.pointDifference) }}</strong><small>{{ result.pointDifference === 0 ? 'Tied on points' : (result.pointDifference > 0 ? result.playerA.name : result.playerB.name) + ' is ahead' }}</small></div>
                    <article class="community-battle-player" :class="{ 'is-ahead': Number(result.playerB.totalPoints) > Number(result.playerA.totalPoints) }"><span class="community-player-side">PLAYER B</span><h2>{{ result.playerB.name }}</h2><strong class="community-battle-points">{{ formatPoints(result.playerB.totalPoints) }}</strong><span>points</span><router-link class="community-button community-button--quiet community-button--small" :to="profileRoute(result.playerB.name)">View profile</router-link></article>
                </section>
                <section class="community-panel">
                    <div class="community-section-heading"><div><h2>Stat comparison</h2><p>Counts match the site's current leaderboard calculation.</p></div></div>
                    <div class="community-compare-table-wrap"><table class="community-compare-table"><thead><tr><th>Statistic</th><th>{{ result.playerA.name }}</th><th>{{ result.playerB.name }}</th></tr></thead><tbody><tr v-for="stat in stats" :key="stat.key"><th>{{ stat.label }}</th><td>{{ formatStat(result.playerA[stat.key], stat.key) }}</td><td>{{ formatStat(result.playerB[stat.key], stat.key) }}</td></tr></tbody></table></div>
                </section>
                <div class="community-two-columns">
                    <section class="community-panel"><h2>{{ result.playerA.name }} · hardest records</h2><div v-if="!result.playerA.hardest.length" class="community-empty">No records found.</div><div v-for="record in result.playerA.hardest" :key="record.kind + record.file" class="community-record-row"><span class="community-record-rank">#{{ record.rank }}</span><div><strong>{{ record.name }}</strong><small>{{ record.kind }}<span v-if="record.percent != null"> · {{ record.percent }}%</span></small></div><a v-if="record.link" :href="record.link" target="_blank" rel="noopener noreferrer">Proof ↗</a></div></section>
                    <section class="community-panel"><h2>{{ result.playerB.name }} · hardest records</h2><div v-if="!result.playerB.hardest.length" class="community-empty">No records found.</div><div v-for="record in result.playerB.hardest" :key="record.kind + record.file" class="community-record-row"><span class="community-record-rank">#{{ record.rank }}</span><div><strong>{{ record.name }}</strong><small>{{ record.kind }}<span v-if="record.percent != null"> · {{ record.percent }}%</span></small></div><a v-if="record.link" :href="record.link" target="_blank" rel="noopener noreferrer">Proof ↗</a></div></section>
                </div>
                <section class="community-panel"><div class="community-section-heading"><div><h2>Shared completions</h2><p>Levels completed or verified by both players, ordered by list rank.</p></div><span class="community-count-chip">{{ result.sharedCompletions.length }}</span></div><div v-if="!result.sharedCompletions.length" class="community-empty">No shared completions found yet.</div><div class="community-shared-grid"><div v-for="level in result.sharedCompletions" :key="level.file" class="community-shared-item"><span>#{{ level.rank }}</span><strong>{{ level.name }}</strong></div></div></section>
            </template>
        </main>
    `,
    computed: {
        stats() { return [ { key: 'rank', label: 'Leaderboard rank' }, { key: 'completedCount', label: 'Completed levels' }, { key: 'verifiedCount', label: 'Verified levels' }, { key: 'progressedCount', label: 'Progress records' }, { key: 'packsCount', label: 'Packs beaten' } ]; }
    },
    mounted() { this.load(); },
    methods: {
        async load() {
            this.loading = true; this.error = ''; this.notice = '';
            try {
                const response = await fetch('/api/community/players', { credentials: 'same-origin' });
                const data = await response.json().catch(() => ({}));
                if (!response.ok) throw new Error(data.error || 'Could not load players.');
                this.players = data.players || [];
                const queryA = this.$route.query.a || '';
                const queryB = this.$route.query.b || '';
                this.playerA = this.players.find(p => p.name.toLowerCase() === String(queryA).toLowerCase())?.name || this.players[0]?.name || '';
                this.playerB = this.players.find(p => p.name.toLowerCase() === String(queryB).toLowerCase())?.name || this.players[1]?.name || '';
                if (queryA && queryB) await this.compare();
            } catch (error) { this.error = error.message || 'Could not load players.'; }
            finally { this.loading = false; }
        },
        async compare() {
            if (!this.playerA || !this.playerB || this.playerA === this.playerB) { this.error = 'Choose two different players.'; return; }
            this.comparing = true; this.error = ''; this.notice = '';
            try {
                const query = new URLSearchParams({ playerA: this.playerA, playerB: this.playerB });
                const response = await fetch('/api/community/compare?' + query, { credentials: 'same-origin' });
                const data = await response.json().catch(() => ({}));
                if (!response.ok) throw new Error(data.error || 'Could not compare those players.');
                this.result = data;
                this.$router.replace({ path: '/compare', query: { a: this.playerA, b: this.playerB } });
            } catch (error) { this.error = error.message || 'Comparison failed.'; this.result = null; }
            finally { this.comparing = false; }
        },
        async copyLink() {
            try { await navigator.clipboard.writeText(window.location.href); this.notice = 'Matchup link copied.'; }
            catch { this.error = 'Copy is blocked by the browser. Copy the page URL from the address bar instead.'; }
        },
        formatPoints(value) { return (Number(value) || 0).toLocaleString(undefined, { maximumFractionDigits: 3 }); },
        formatStat(value, key) { return key === 'rank' ? (Number(value) ? '#' + value : '—') : (Number(value) || 0).toLocaleString(); },
        profileRoute(name) { return '/players/' + encodeURIComponent(name); }
    }
};
