import Spinner from '../components/Spinner.js';
export default {
    components: { Spinner },
    data() { return { loading: true, error: '', data: null, view: 'champions' }; },
    template: `
        <main class="community-page community-hall-page">
            <header class="community-header">
                <p class="community-eyebrow">THE RECORD BOOK</p>
                <h1>Hall of Fame</h1>
                <p>Celebrate current champions, former #1 players, peak points and the best ranks recorded since the archive began.</p>
            </header>
            <div v-if="loading" class="community-loading"><Spinner /></div>
            <section v-else-if="error" class="community-panel community-empty"><h2>Hall of Fame couldn't load</h2><p>{{ error }}</p><button class="community-button" @click="load">Try again</button></section>
            <template v-else-if="data">
                <section class="community-hof-champion" v-if="data.currentLeader">
                    <div class="community-hof-laurel">♛</div>
                    <div><p class="community-kicker">CURRENT #1 PLAYER</p><h2>{{ data.currentLeader.name }}</h2><p>{{ formatPoints(data.currentLeader.totalPoints) }} points · Snapshot {{ data.snapshotDate }}</p><router-link class="community-button" :to="profileRoute(data.currentLeader.name)">View champion profile</router-link></div>
                </section>
                <div class="community-hof-stats">
                    <article class="community-stat-card"><span>Former / current champions</span><strong>{{ data.numberOneDays.length }}</strong><small>Players with at least one saved #1 day</small></article>
                    <article class="community-stat-card"><span>Longest #1 streak in archive</span><strong>{{ data.longestStreak ? data.longestStreak.days + ' day' + (data.longestStreak.days === 1 ? '' : 's') : '—' }}</strong><small>{{ data.longestStreak ? data.longestStreak.player : 'No streak recorded yet' }}</small></article>
                    <article class="community-stat-card"><span>Saved daily snapshots</span><strong>{{ data.archiveDays }}</strong><small>Archive starts {{ data.archiveStarted || 'with the first snapshot' }}</small></article>
                </div>
                <section class="community-panel">
                    <div class="community-section-heading"><div><h2>Records & champions</h2><p>Switch between lifetime points, best saved rank and days at #1.</p></div></div>
                    <div class="community-segmented"><button :class="{ active: view === 'champions' }" @click="view = 'champions'">Most #1 days</button><button :class="{ active: view === 'points' }" @click="view = 'points'">Peak points</button><button :class="{ active: view === 'rank' }" @click="view = 'rank'">Best rank</button></div>
                    <div v-if="view === 'champions'" class="community-hof-table"><div class="community-hof-row community-hof-row--head"><span>Rank</span><span>Player</span><span>#1 days</span><span>First / latest</span></div><div v-if="!data.numberOneDays.length" class="community-empty">No #1 days are archived yet.</div><div v-for="(row,index) in data.numberOneDays" :key="row.player_key" class="community-hof-row"><span class="community-place" :class="'place-' + (index + 1)">#{{ index + 1 }}</span><router-link :to="profileRoute(row.player_name)">{{ row.player_name }}</router-link><strong>{{ row.number_one_days }}</strong><small>{{ row.first_number_one }} / {{ row.latest_number_one }}</small></div></div>
                    <div v-else-if="view === 'points'" class="community-hof-table"><div class="community-hof-row community-hof-row--head"><span>Rank</span><span>Player</span><span>Peak points</span><span>Recorded</span></div><div v-for="(row,index) in data.pointsRecords" :key="row.player_key" class="community-hof-row"><span class="community-place" :class="'place-' + (index + 1)">#{{ index + 1 }}</span><router-link :to="profileRoute(row.player_name)">{{ row.player_name }}</router-link><strong>{{ formatPoints(row.best_points) }}</strong><small>{{ row.best_points_date }}</small></div></div>
                    <div v-else class="community-hof-table"><div class="community-hof-row community-hof-row--head"><span>Rank</span><span>Player</span><span>Best rank</span><span>Recorded</span></div><div v-for="(row,index) in data.bestRankRecords" :key="row.player_key" class="community-hof-row"><span class="community-place" :class="'place-' + (index + 1)">#{{ index + 1 }}</span><router-link :to="profileRoute(row.player_name)">{{ row.player_name }}</router-link><strong>#{{ row.best_rank }}</strong><small>{{ row.best_rank_date }}</small></div></div>
                </section>
                <section class="community-panel"><div class="community-section-heading"><div><h2>Recent #1 history</h2><p>Daily #1 snapshots, oldest first in this recent window.</p></div></div><div v-if="!data.recentChampions.length" class="community-empty">No champions saved yet.</div><div class="community-champion-timeline"><article v-for="row in data.recentChampions" :key="row.snapshot_date" class="community-champion-day"><span class="community-timeline-dot"></span><small>{{ row.snapshot_date }}</small><strong>{{ row.player_name }}</strong><span>{{ formatPoints(row.total_points) }} points</span></article></div></section>
                <p class="community-footnote">{{ data.note }} This archive records data from installation onward; it does not invent pre-installation results.</p>
            </template>
        </main>
    `,
    mounted() { this.load(); },
    methods: {
        async load() {
            this.loading = true; this.error = '';
            try {
                const response = await fetch('/api/community/hall-of-fame', { credentials: 'same-origin' });
                const data = await response.json().catch(() => ({}));
                if (!response.ok) throw new Error(data.error || 'Could not load Hall of Fame.');
                this.data = data;
            } catch (error) { this.error = error.message || 'Could not load Hall of Fame.'; }
            finally { this.loading = false; }
        },
        formatPoints(value) { return (Number(value) || 0).toLocaleString(undefined, { maximumFractionDigits: 3 }); },
        profileRoute(name) { return '/players/' + encodeURIComponent(name); }
    }
};
