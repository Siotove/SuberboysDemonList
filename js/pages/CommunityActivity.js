import Spinner from '../components/Spinner.js';
export default {
    components: { Spinner },
    data() { return { loading: true, error: '', activity: [], limit: 50 }; },
    template: `
        <main class="community-page community-activity-page">
            <header class="community-header">
                <p class="community-eyebrow">WHAT'S HAPPENING</p>
                <h1>Community Activity</h1>
                <p>Leaderboard movements, new completions and verifications, and clan milestones in one place.</p>
            </header>
            <section class="community-panel">
                <div class="community-section-heading"><div><h2>Latest events</h2><p>Leaderboard activity is detected from daily snapshots. Clan actions appear as they happen.</p></div><button class="community-button community-button--quiet" @click="load">Refresh</button></div>
                <div v-if="loading" class="community-loading"><Spinner /></div>
                <div v-else-if="error" class="community-alert community-alert--error">{{ error }} <button class="community-button community-button--small" @click="load">Try again</button></div>
                <div v-else-if="!activity.length" class="community-empty"><span class="community-empty-icon">✦</span><h3>It's quiet in here</h3><p>Activity will appear as players move up the leaderboard, gain records, and build clans. Daily leaderboard events begin with the first snapshot after this update.</p></div>
                <div v-else class="community-activity-list">
                    <article v-for="item in activity" :key="item.id" class="community-activity-item" :class="'is-' + item.event_type">
                        <div class="community-activity-icon">{{ iconFor(item.event_type) }}</div>
                        <div class="community-activity-copy"><p>{{ item.message }}</p><small>{{ formatDate(item.created_at) }}</small></div>
                        <span class="community-event-type">{{ labelFor(item.event_type) }}</span>
                    </article>
                </div>
            </section>
            <p class="community-footnote">Only public activity is shown. Private account details and pending clan requests are never included in this feed.</p>
        </main>
    `,
    mounted() { this.load(); },
    methods: {
        async load() {
            this.loading = true; this.error = '';
            try {
                const response = await fetch('/api/community/activity?limit=' + this.limit, { credentials: 'same-origin' });
                const data = await response.json().catch(() => ({}));
                if (!response.ok) throw new Error(data.error || 'Could not load community activity.');
                this.activity = data.activity || [];
            } catch (error) { this.error = error.message || 'Could not load community activity.'; }
            finally { this.loading = false; }
        },
        iconFor(type) { return ({ number_one: '♛', rank_up: '↗', rank_down: '↘', points_gain: '✦', completion_gain: '✓', verification_gain: '◆', progress_gain: '◒', clan_created: '⚑', clan_join_request: '＋', clan_member_joined: '✓', clan_member_left: '↗', clan_disbanded: '×', clan_updated: '✎', clan_role_changed: '★' })[type] || '•'; },
        labelFor(type) { return ({ number_one: 'Champion', rank_up: 'Rank up', rank_down: 'Rank change', points_gain: 'Points', completion_gain: 'Completion', verification_gain: 'Verification', progress_gain: 'Progress', clan_created: 'Clan', clan_join_request: 'Clan', clan_member_joined: 'Clan', clan_member_left: 'Clan', clan_disbanded: 'Clan', clan_updated: 'Clan', clan_role_changed: 'Clan' })[type] || 'Activity'; },
        formatDate(value) { if (!value) return 'Just now'; const d = new Date(value.includes('T') ? value : value.replace(' ', 'T') + 'Z'); return Number.isNaN(d.getTime()) ? value : d.toLocaleString(); }
    }
};
