function todayUtc() { return new Date().toISOString().slice(0, 10); }
function afterDaysUtc(days) { const d = new Date(); d.setUTCDate(d.getUTCDate() + days); return d.toISOString().slice(0, 10); }

export default {
    name: 'CompetitionAdminTools',
    data() {
        return {
            loading: true, savingAnnouncement: false, savingSeason: false,
            error: '', overview: null,
            announcementTitle: '', announcementMessage: '', announcementHref: '/leaderboard', announcementStatus: '',
            seasonName: '', seasonStart: todayUtc(), seasonEnd: afterDaysUtc(14), seasonActivate: true, seasonStatus: ''
        };
    },
    template: `
        <section class="admin-section competition-admin-tools">
            <details open>
                <summary><h2 style="display:inline">Competition Operations</h2><span> — notifications, seasons and platform health</span></summary>
                <p class="competition-admin-intro">Operational tools for the community competition system. All actions below are admin-protected and recorded in the audit log.</p>
                <div class="competition-admin-toolbar"><button type="button" @click="loadOverview" :disabled="loading">{{ loading ? 'Refreshing…' : 'Refresh status' }}</button><span v-if="overview" class="competition-admin-updated">Latest snapshot: {{ overview.latestSnapshot || 'not recorded yet' }}</span></div>
                <p v-if="error" class="competition-error" role="alert">{{ error }}</p>
                <div v-if="overview" class="competition-admin-metrics">
                    <article><small>Accounts</small><strong>{{ overview.accountCount }}</strong><span>+{{ overview.newAccountsWeek }} in 7 days</span></article>
                    <article><small>Banned accounts</small><strong>{{ overview.bannedCount }}</strong><span>Existing admin controls remain unchanged</span></article>
                    <article><small>Snapshot history</small><strong>{{ overview.snapshotDays }} days</strong><span>{{ overview.snapshotRows }} player snapshots</span></article>
                    <article><small>Notifications</small><strong>{{ overview.notificationCount }}</strong><span>{{ overview.unreadNotifications }} unread across all accounts</span></article>
                    <article><small>Recent notifications</small><strong>{{ overview.notificationsLastDay }}</strong><span>Created in the last 24 hours</span></article>
                    <article><small>Season records</small><strong>{{ overview.seasonCount }}</strong><span>{{ overview.activeSeasonCount }} active season(s)</span></article>
                </div>
                <div v-if="overview" class="competition-admin-active-season">
                    <strong>Active season</strong>
                    <span v-if="overview.activeSeason">{{ overview.activeSeason.name }} · {{ overview.activeSeason.start_date }} → {{ overview.activeSeason.end_date }}</span>
                    <span v-else>No active season selected</span>
                </div>

                <div class="competition-admin-tools-grid">
                    <form class="competition-admin-box" @submit.prevent="sendAnnouncement">
                        <span class="competition-eyebrow">COMMUNITY MESSAGING</span><h3>Broadcast an announcement</h3>
                        <p class="competition-muted">Creates an in-site notification for every non-banned account. It does not send email.</p>
                        <label>Title<input v-model.trim="announcementTitle" maxlength="100" required minlength="3" placeholder="Maintenance or community news"></label>
                        <label>Message<textarea v-model.trim="announcementMessage" maxlength="500" rows="3" required placeholder="Write a short, clear announcement"></textarea></label>
                        <label>Open when clicked<select v-model="announcementHref"><option value="/leaderboard">Leaderboard</option><option value="/profile">Profile</option><option value="/quests">Weekly quests</option><option value="/history">Rank history</option></select></label>
                        <button type="submit" :disabled="savingAnnouncement || !announcementTitle || !announcementMessage">{{ savingAnnouncement ? 'Sending…' : 'Send announcement' }}</button>
                        <p v-if="announcementStatus" role="status" class="competition-admin-status">{{ announcementStatus }}</p>
                    </form>

                    <form class="competition-admin-box" @submit.prevent="createSeason">
                        <span class="competition-eyebrow">SEASON CONTROL</span><h3>Create a season</h3>
                        <p class="competition-muted">The season uses genuine daily leaderboard snapshots. Existing history isn't fabricated.</p>
                        <label>Season name<input v-model.trim="seasonName" maxlength="60" minlength="3" required placeholder="Winter Sprint"></label>
                        <div class="competition-admin-date-grid"><label>Start date<input v-model="seasonStart" type="date" required></label><label>End date<input v-model="seasonEnd" type="date" required></label></div>
                        <label class="competition-admin-check"><input v-model="seasonActivate" type="checkbox"><span>Make this the active season (replaces the current active season)</span></label>
                        <button type="submit" :disabled="savingSeason || !seasonName || !seasonStart || !seasonEnd">{{ savingSeason ? 'Creating…' : 'Create season' }}</button>
                        <p v-if="seasonStatus" role="status" class="competition-admin-status">{{ seasonStatus }}</p>
                    </form>
                </div>

                <div v-if="overview" class="competition-admin-audit">
                    <div class="competition-admin-audit-heading"><div><span class="competition-eyebrow">ACCOUNTABILITY</span><h3>Recent admin actions</h3></div><span>{{ overview.recentActions.length }} shown</span></div>
                    <p v-if="!overview.recentActions.length" class="competition-muted">No competition-admin actions recorded yet.</p>
                    <div v-for="item in overview.recentActions" :key="item.id" class="competition-admin-audit-row">
                        <div><strong>{{ item.action.replace(/_/g, ' ') }}</strong><small>{{ item.admin_username }} · {{ item.created_at }}</small></div>
                        <span>{{ auditSummary(item) }}</span>
                    </div>
                </div>
            </details>
        </section>
    `,
    async mounted() { await this.loadOverview(); },
    methods: {
        async loadOverview() {
            this.loading = true; this.error = '';
            try {
                const response = await fetch('/api/competition/admin/overview', { credentials: 'same-origin', cache: 'no-store' });
                const result = await response.json();
                if (!response.ok) throw new Error(result.error || 'Could not load competition operations.');
                this.overview = result;
            } catch (error) { this.error = error.message || 'Could not load competition operations.'; }
            finally { this.loading = false; }
        },
        async sendAnnouncement() {
            this.savingAnnouncement = true; this.announcementStatus = ''; this.error = '';
            try {
                const response = await fetch('/api/competition/admin/announce', {
                    method: 'POST', credentials: 'same-origin',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ title: this.announcementTitle, message: this.announcementMessage, href: this.announcementHref })
                });
                const result = await response.json();
                if (!response.ok) throw new Error(result.error || 'Announcement failed.');
                this.announcementStatus = `Announcement delivered to ${result.recipientCount} account(s).`;
                this.announcementTitle = ''; this.announcementMessage = '';
                await this.loadOverview();
            } catch (error) { this.error = error.message || 'Announcement failed.'; }
            finally { this.savingAnnouncement = false; }
        },
        async createSeason() {
            if (this.seasonEnd < this.seasonStart) { this.seasonStatus = 'End date must be on or after start date.'; return; }
            this.savingSeason = true; this.seasonStatus = ''; this.error = '';
            try {
                const response = await fetch('/api/competition/admin/seasons', {
                    method: 'POST', credentials: 'same-origin',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name: this.seasonName, startDate: this.seasonStart, endDate: this.seasonEnd, activate: this.seasonActivate })
                });
                const result = await response.json();
                if (!response.ok) throw new Error(result.error || 'Could not create season.');
                this.seasonStatus = `Created “${result.season.name}”.`;
                this.seasonName = '';
                await this.loadOverview();
            } catch (error) { this.error = error.message || 'Could not create season.'; }
            finally { this.savingSeason = false; }
        },
        auditSummary(item) {
            const details = item.details || {};
            if (details.recipientCount !== undefined) return `${details.recipientCount} recipients`;
            if (details.name) return `${details.name} · ${details.startDate || ''} ${details.endDate ? '→ ' + details.endDate : ''}`;
            if (details.title) return details.title;
            return 'Recorded';
        }
    }
};
