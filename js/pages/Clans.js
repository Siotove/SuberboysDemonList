export default {
    data() {
        return {
            loading: true,
            saving: false,
            error: "",
            message: "",
            clans: [],
            myState: { membership: null, members: [], requests: [] },
            detail: null,
            createForm: { name: "", tag: "", description: "", accentColor: "#a855f7" },
            editForm: { name: "", tag: "", description: "", accentColor: "#a855f7" },
            showCreate: false,
            showEdit: false,
            colors: ["#a855f7", "#6366f1", "#3b82f6", "#06b6d4", "#14b8a6", "#22c55e", "#eab308", "#f97316", "#ef4444", "#ec4899"]
        };
    },
    computed: {
        isDetail() { return Boolean(this.$route.params.id); },
        membership() { return this.myState.membership; },
        canManage() { return this.membership && this.membership.status === "member" && ["owner", "officer"].includes(this.membership.role); },
        canEdit() { return this.membership && this.membership.status === "member" && this.membership.role === "owner"; }
    },
    watch: { "$route.params.id"() { this.load(); } },
    mounted() { this.load(); },
    template: `
        <main class="community-page community-clans-page">
            <header class="community-header">
                <p class="community-eyebrow">COMMUNITY TEAMS</p>
                <h1>{{ isDetail ? (detail ? '[' + detail.clan.tag + '] ' + detail.clan.name : 'Clan') : 'Clans' }}</h1>
                <p>Build a team, request to join other clans, and compete using the combined points of linked members.</p>
            </header>
            <div v-if="loading" class="community-message">Loading clans…</div>
            <template v-else>
                <div v-if="error" class="community-alert community-alert--error">{{ error }}</div>
                <div v-if="message" class="community-alert">{{ message }}</div>
                <template v-if="isDetail && detail">
                    <router-link class="community-button community-button--quiet" to="/clans">← All clans</router-link>
                    <section class="community-hero-card" :style="{ '--community-accent': detail.clan.accent_color }">
                        <div class="community-clan-badge">{{ detail.clan.tag }}</div>
                        <div class="community-clan-hero-copy">
                            <p class="community-kicker">CLAN SHOWCASE</p>
                            <h2>{{ detail.clan.name }}</h2>
                            <p>{{ detail.clan.description || 'This clan has not added a description yet.' }}</p>
                            <div class="community-meta-row"><span>{{ detail.clan.member_count }} members</span><span>{{ formatPoints(detail.clan.total_points) }} points</span><span>Created {{ dateOnly(detail.clan.created_at) }}</span></div>
                        </div>
                    </section>
                    <section class="community-panel">
                        <div class="community-section-heading"><div><h2>Roster</h2><p>Members with a linked leaderboard identity contribute their current points.</p></div></div>
                        <div v-if="!detail.members.length" class="community-empty">No members are listed yet.</div>
                        <div v-for="member in detail.members" :key="member.username" class="community-member-row">
                            <div class="community-member-avatar">{{ initials(member.leaderboard_name || member.username) }}</div>
                            <div class="community-member-copy"><strong>{{ member.leaderboard_name || member.username }}</strong><small>{{ member.role }}<span v-if="member.leaderboard_name && member.leaderboard_name !== member.username"> · Account {{ member.username }}</span></small></div>
                            <div class="community-member-stats"><strong>{{ formatPoints(member.total_points) }}</strong><small>{{ member.rank ? '#' + member.rank : 'Unranked' }}</small></div>
                        </div>
                    </section>
                    <section v-if="!detail.ownMembership || detail.ownMembership.status !== 'member'" class="community-panel community-join-panel">
                        <h2>Want to join?</h2><p>Join requests need approval from a clan leader or officer.</p>
                        <button class="community-button" @click="joinClan(detail.clan.id)" :disabled="saving || Boolean(membership) || detail.ownMembership?.status === 'pending'">{{ detail.ownMembership?.status === 'pending' ? 'Request pending' : (membership ? 'Already in a clan / pending' : 'Request to join') }}</button>
                    </section>
                </template>
                <template v-else-if="!isDetail">
                    <section v-if="membership" class="community-panel community-current-clan">
                        <div class="community-section-heading"><div><p class="community-kicker">YOUR CLAN STATUS</p><h2>{{ membership.clan_name ? '[' + membership.clan_tag + '] ' + membership.clan_name : 'Clan request pending' }}</h2><p>{{ membership.status === 'pending' ? 'Your request is waiting for a clan leader or officer.' : 'You are ' + membership.role + ' of this clan.' }}</p></div><router-link v-if="membership.clan_id" class="community-button community-button--quiet" :to="'/clans/' + membership.clan_id">Open clan ↗</router-link></div>
                        <template v-if="membership.status === 'member'">
                            <div v-if="myState.members.length" class="community-section-subhead"><h3>Manage members</h3><button class="community-button community-button--quiet community-button--small" @click="showEdit = !showEdit" v-if="canEdit">{{ showEdit ? 'Cancel edit' : 'Edit clan' }}</button></div>
                            <form v-if="showEdit && canEdit" class="community-form community-edit-form" @submit.prevent="saveEdit">
                                <div class="community-form-grid"><label>Clan name<input v-model="editForm.name" maxlength="32" required></label><label>Clan tag<input v-model="editForm.tag" maxlength="6" required></label></div>
                                <label>Description<textarea v-model="editForm.description" maxlength="240" rows="3"></textarea></label>
                                <div class="community-color-picker"><span>Clan colour</span><button v-for="color in colors" :key="color" type="button" :aria-label="color" :class="{ selected: editForm.accentColor === color }" :style="{ backgroundColor: color }" @click="editForm.accentColor = color"></button></div>
                                <button class="community-button" :disabled="saving">{{ saving ? 'Saving…' : 'Save clan details' }}</button>
                            </form>
                            <div v-for="member in myState.members" :key="member.user_id" class="community-member-row">
                                <div class="community-member-avatar">{{ initials(member.leaderboard_name || member.username) }}</div>
                                <div class="community-member-copy"><strong>{{ member.leaderboard_name || member.username }}</strong><small>{{ member.role }} · {{ member.username }}</small></div>
                                <div v-if="membership.role === 'owner' && member.role !== 'owner'" class="community-inline-actions"><button class="community-button community-button--quiet community-button--small" @click="changeRole(member, member.role === 'officer' ? 'member' : 'officer')">{{ member.role === 'officer' ? 'Make member' : 'Make officer' }}</button><button class="community-button community-button--quiet community-button--small" @click="removeMember(member.user_id)">Remove</button></div>
                            </div>
                            <div v-if="canManage && myState.requests.length" class="community-requests"><h3>Join requests ({{ myState.requests.length }})</h3><div v-for="request in myState.requests" :key="request.user_id" class="community-member-row"><div class="community-member-copy"><strong>{{ request.leaderboard_name || request.username }}</strong><small>Requested {{ dateOnly(request.requested_at) }}</small></div><div class="community-inline-actions"><button class="community-button community-button--small" @click="manageRequest(request, 'approve')">Approve</button><button class="community-button community-button--quiet community-button--small" @click="manageRequest(request, 'reject')">Decline</button></div></div></div>
                            <div class="community-danger-zone"><button class="community-button community-button--quiet" @click="leaveClan">Leave clan</button><button v-if="canEdit" class="community-button community-button--danger" @click="disbandClan">Disband clan</button></div>
                        </template>
                        <div v-else class="community-danger-zone"><button class="community-button community-button--quiet" @click="leaveClan">Cancel request</button></div>
                    </section>
                    <section class="community-section">
                        <div class="community-section-heading"><div><h2>Clan leaderboard</h2><p>Points are the sum of members' latest saved leaderboard scores.</p></div><button v-if="!membership" class="community-button" @click="showCreate = !showCreate">{{ showCreate ? 'Cancel' : 'Create clan' }}</button></div>
                        <form v-if="showCreate && !membership" class="community-panel community-form" @submit.prevent="createClan">
                            <div class="community-form-grid"><label>Clan name<input v-model="createForm.name" maxlength="32" minlength="3" placeholder="e.g. Wave Runners" required></label><label>Clan tag<input v-model="createForm.tag" maxlength="6" minlength="2" placeholder="e.g. WAVE" required></label></div>
                            <label>Description<textarea v-model="createForm.description" maxlength="240" rows="3" placeholder="What is your clan about?"></textarea></label>
                            <div class="community-color-picker"><span>Clan colour</span><button v-for="color in colors" :key="color" type="button" :aria-label="color" :class="{ selected: createForm.accentColor === color }" :style="{ backgroundColor: color }" @click="createForm.accentColor = color"></button></div>
                            <p class="community-small-note">You need a linked leaderboard identity to create or join a clan. Accounts can belong to one clan at a time.</p>
                            <button class="community-button" :disabled="saving">{{ saving ? 'Creating…' : 'Create clan' }}</button>
                        </form>
                        <div v-if="!clans.length" class="community-panel community-empty"><h3>No clans yet</h3><p>Create the first clan and start a team.</p></div>
                        <div v-else class="community-clan-list">
                            <article v-for="(clan, index) in clans" :key="clan.id" class="community-clan-card" :style="{ '--community-accent': clan.accent_color }">
                                <div class="community-clan-rank">#{{ index + 1 }}</div><div class="community-clan-badge">{{ clan.tag }}</div>
                                <div class="community-clan-card-copy"><h3>{{ clan.name }}</h3><p>{{ clan.description || 'No description yet.' }}</p><small>{{ clan.member_count }} members · {{ formatPoints(clan.total_points) }} points</small></div>
                                <div class="community-clan-card-actions"><router-link class="community-button community-button--quiet community-button--small" :to="'/clans/' + clan.id">View</router-link><button v-if="!membership" class="community-button community-button--small" @click="joinClan(clan.id)" :disabled="saving">Join</button></div>
                            </article>
                        </div>
                    </section>
                </template>
            </template>
        </main>
    `,
    methods: {
        async api(path, options = {}) {
            const response = await fetch(path, { credentials: 'same-origin', ...options, headers: { ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...(options.headers || {}) } });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) { const error = new Error(data.error || 'Request failed.'); error.status = response.status; throw error; }
            return data;
        },
        async load() {
            this.loading = true; this.error = '';
            try {
                this.myState = { membership: null, members: [], requests: [] };
                try { this.myState = await this.api('/api/community/clans/me'); }
                catch (error) { if (error.status !== 401) throw error; }
                if (this.myState.membership) this.editForm = { name: this.myState.membership.clan_name || '', tag: this.myState.membership.clan_tag || '', description: this.myState.membership.description || '', accentColor: this.myState.membership.accent_color || '#a855f7' };
                if (this.isDetail) {
                    this.detail = await this.api('/api/community/clans/detail?id=' + encodeURIComponent(this.$route.params.id));
                } else {
                    const data = await this.api('/api/community/clans');
                    this.clans = data.clans || [];
                }
            } catch (error) { this.error = error.message || 'Could not load clans.'; }
            finally { this.loading = false; }
        },
        async runAction(path, body = {}, success = 'Done.') {
            this.saving = true; this.error = ''; this.message = '';
            try { const data = await this.api(path, { method: 'POST', body: JSON.stringify(body) }); this.message = data.message || success; await this.load(); }
            catch (error) { this.error = error.message; }
            finally { this.saving = false; }
        },
        createClan() { return this.runAction('/api/community/clans', this.createForm, 'Clan created!'); },
        joinClan(clanId) { return this.runAction('/api/community/clans/join', { clanId }, 'Join request sent.'); },
        manageRequest(request, action) { return this.runAction('/api/community/clans/requests', { userId: request.user_id, action }, action === 'approve' ? 'Member approved.' : 'Request declined.'); },
        changeRole(member, role) { return this.runAction('/api/community/clans/role', { userId: member.user_id, role }, 'Member role updated.'); },
        removeMember(userId) { return this.runAction('/api/community/clans/remove-member', { userId }, 'Member removed.'); },
        leaveClan() { return this.runAction('/api/community/clans/leave', {}, 'You left the clan / cancelled your request.'); },
        disbandClan() { if (window.confirm('Disband this clan for everyone? This cannot be undone.')) return this.runAction('/api/community/clans/disband', {}, 'Clan disbanded.'); },
        saveEdit() { return this.runAction('/api/community/clans/update', this.editForm, 'Clan details saved.').then(() => { this.showEdit = false; }); },
        formatPoints(value) { return (Number(value) || 0).toLocaleString(undefined, { maximumFractionDigits: 3 }); },
        dateOnly(value) { return value ? String(value).slice(0, 10) : '—'; },
        initials(value) { return String(value || '?').trim().slice(0, 2).toUpperCase(); }
    }
};
