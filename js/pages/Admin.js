
export default {
    template: `
        <main class="admin-page">
            <h1>Admin Panel</h1>

            <p v-if="loading">Checking admin permissions...</p>

            <div v-else-if="isAdmin">
                <p>Welcome, {{ username }}!</p>

                <section class="admin-section">
                    <h2>Dashboard</h2>
                    <div class="admin-stats">
                        <p>Accounts: <strong>{{ players.length }}</strong></p>
                        <p>Banned: <strong>{{ bannedCount }}</strong></p>
                        <p>Pending: <strong>{{ pendingCount }}</strong></p>
                        <p>Approved: <strong>{{ approvedCount }}</strong></p>
                        <p>Rejected: <strong>{{ rejectedCount }}</strong></p>
                    </div>
                </section>

                <section class="admin-section">
                    <details :open="players.length <= 50">
                        <summary>
                            <h2 style="display:inline">Player Management</h2>
                            <span> — {{ players.length }} accounts</span>
                        </summary>

                        <p>
                            Search accounts, manage bans, and link accounts
                            to existing leaderboard identities. Changing a
                            link does not change scores.
                        </p>

                        <p v-if="playersLoading">Loading player accounts...</p>
                        <p v-else-if="playersError" role="alert">
                            {{ playersError }}
                        </p>

                        <div v-else>
                            <label for="player-search">Search accounts</label>
                            <input
                                id="player-search"
                                v-model="playerSearch"
                                type="search"
                                placeholder="Username, email or leaderboard name..."
                            >

                            <label for="player-filter">Account status</label>
                            <select id="player-filter" v-model="playerFilter">
                                <option value="all">All accounts</option>
                                <option value="linked">Linked</option>
                                <option value="unlinked">Not linked</option>
                                <option value="banned">Banned</option>
                                <option value="active">Not banned</option>
                            </select>

                            <p>
                                Showing {{ visiblePlayers.length }}
                                of {{ filteredPlayers.length }} matching accounts.
                            </p>

                            <p v-if="filteredPlayers.length === 0">
                                No matching accounts.
                            </p>

                            <div
                                v-for="player in visiblePlayers"
                                :key="player.id"
                                class="admin-player"
                            >
                                <h3>
                                    {{ player.username }}
                                    <span v-if="player.is_admin === 1">(admin)</span>
                                    <span v-if="player.is_banned === 1">
                                        — BANNED
                                    </span>
                                </h3>

                                <p>{{ player.email }}</p>
                                <p>
                                    Current identity:
                                    <strong>
                                        {{ player.leaderboard_name || 'Not linked' }}
                                    </strong>
                                </p>

                                <p v-if="player.is_banned === 1">
                                    <strong>Ban reason:</strong>
                                    {{ player.ban_reason || 'No reason provided' }}
                                </p>

                                <details>
                                    <summary>Manage leaderboard link</summary>

                                    <label :for="'profile-' + player.id">
                                        Leaderboard identity
                                    </label>

                                    <input
                                        :id="'identity-search-' + player.id"
                                        v-model="identitySearch[player.id]"
                                        type="search"
                                        placeholder="Search leaderboard identities..."
                                    >

                                    <select
                                        :id="'profile-' + player.id"
                                        v-model="selectedProfiles[player.id]"
                                        :disabled="savingUser === player.id"
                                    >
                                        <option value="">Not linked</option>
                                        <option
                                            v-if="
                                                player.leaderboard_name &&
                                                !filteredIdentities(player).includes(
                                                    player.leaderboard_name
                                                )
                                            "
                                            :value="player.leaderboard_name"
                                        >
                                            {{ player.leaderboard_name }} (current)
                                        </option>
                                        <option
                                            v-for="identity in filteredIdentities(player)"
                                            :key="identity"
                                            :value="identity"
                                        >
                                            {{ identity }}
                                        </option>
                                    </select>

                                    <button
                                        type="button"
                                        @click="saveProfile(player)"
                                        :disabled="
                                            savingUser === player.id ||
                                            selectedProfiles[player.id] ===
                                            (player.leaderboard_name || '')
                                        "
                                    >
                                        {{
                                            savingUser === player.id
                                                ? 'Saving...'
                                                : 'Save link'
                                        }}
                                    </button>

                                    <p
                                        v-if="playerMessages[player.id]"
                                        role="status"
                                    >
                                        {{ playerMessages[player.id] }}
                                    </p>
                                </details>

                                <div v-if="player.is_admin !== 1">
                                    <button
                                        v-if="player.is_banned !== 1"
                                        type="button"
                                        @click="banPlayer(player)"
                                        :disabled="banningUser === player.id"
                                    >
                                        {{
                                            banningUser === player.id
                                                ? 'Banning...'
                                                : 'Ban account'
                                        }}
                                    </button>

                                    <button
                                        v-else
                                        type="button"
                                        @click="unbanPlayer(player)"
                                        :disabled="banningUser === player.id"
                                    >
                                        {{
                                            banningUser === player.id
                                                ? 'Unbanning...'
                                                : 'Unban account'
                                        }}
                                    </button>

                                    <p
                                        v-if="banMessages[player.id]"
                                        role="status"
                                    >
                                        {{ banMessages[player.id] }}
                                    </p>
                                </div>

                                <hr>
                            </div>

                            <button
                                v-if="visiblePlayers.length < filteredPlayers.length"
                                type="button"
                                @click="playerLimit += 50"
                            >
                                Show 50 more accounts
                            </button>
                        </div>

                        <button
                            type="button"
                            @click="loadPlayers"
                            :disabled="playersLoading"
                        >
                            Refresh accounts
                        </button>
                    </details>
                </section>

                <section class="admin-section">
                    <h2>Submissions</h2>
                    <p>
                        Review completion records and new level verifications.
                    </p>

                    <p v-if="submissionsLoading">Loading submissions...</p>

                    <p v-else-if="submissionsError" role="alert">
                        {{ submissionsError }}
                    </p>

                    <div v-else>
                        <label for="submission-search">Search submissions</label>
                        <input
                            id="submission-search"
                            v-model="submissionSearch"
                            type="search"
                            placeholder="Level, username, creator or submission ID..."
                        >

                        <label for="submission-filter">Show</label>
                        <select
                            id="submission-filter"
                            v-model="submissionFilter"
                        >
                            <option value="pending">Pending review</option>
                            <option value="failed">Failed</option>
                            <option value="processing">Processing</option>
                            <option value="approved">Approved</option>
                            <option value="rejected">Rejected</option>
                            <option value="all">All submissions</option>
                        </select>

                        <p>
                            Pending: {{ pendingCount }} |
                            Matching submissions: {{ filteredSubmissions.length }}
                        </p>

                        <p v-if="filteredSubmissions.length === 0">
                            No matching submissions.
                        </p>

                        <article
                            v-for="submission in filteredSubmissions"
                            :key="submission.id"
                            class="admin-submission"
                        >
                            <hr>

                            <h3>
                                {{ submission.type === 'completion'
                                    ? 'Completion'
                                    : 'Level verification' }}
                            </h3>

                            <p>
                                <strong>Status:</strong>
                                {{ submission.status }}
                            </p>
                            <p>
                                <strong>Submitted by:</strong>
                                {{ submission.username }}
                            </p>
                            <p>
                                <strong>Submitted:</strong>
                                {{ submission.created_at }}
                            </p>
                            <p>
                                <strong>Submission ID:</strong>
                                {{ submission.id }}
                            </p>

                            <div v-if="submission.type === 'completion'">
                                <p>
                                    <strong>Level:</strong>
                                    {{ submission.payload.levelFile }}
                                </p>
                                <p>
                                    <strong>Progress:</strong>
                                    {{ submission.payload.percent }}%
                                </p>
                                <p>
                                    <strong>Refresh rate:</strong>
                                    {{ submission.payload.hz }} Hz
                                </p>
                                <p>
                                    <strong>Video:</strong>
                                    <a
                                        :href="submission.payload.link"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                    >Open proof video</a>
                                </p>
                            </div>

                            <div v-else>
                                <p>
                                    <strong>Level name:</strong>
                                    {{ submission.payload.name }}
                                </p>
                                <p>
                                    <strong>Filename:</strong>
                                    {{ submission.payload.fileName }}.json
                                </p>
                                <p>
                                    <strong>Level ID:</strong>
                                    {{ submission.payload.id }}
                                </p>
                                <p>
                                    <strong>Author:</strong>
                                    {{ submission.payload.author }}
                                </p>
                                <p>
                                    <strong>Creators:</strong>
                                    {{ (submission.payload.creators || []).join(', ') }}
                                </p>
                                <p>
                                    <strong>Percent to qualify:</strong>
                                    {{ submission.payload.percentToQualify }}%
                                </p>
                                <p>
                                    <strong>Requested list position:</strong>
                                    {{ submission.payload.position }}
                                </p>
                                <p>
                                    <strong>Verification:</strong>
                                    <a
                                        :href="submission.payload.verification"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                    >Open verification video</a>
                                </p>
                            </div>

                            <p v-if="submission.error_message" role="alert">
                                <strong>Error:</strong>
                                {{ submission.error_message }}
                            </p>

                            <div v-if="submission.status === 'pending'">
                                <button
                                    type="button"
                                    @click="reviewSubmission(submission, 'approve')"
                                    :disabled="reviewingId !== null"
                                >
                                    {{
                                        reviewingId === submission.id
                                            ? 'Processing...'
                                            : 'Approve'
                                    }}
                                </button>

                                <button
                                    type="button"
                                    @click="reviewSubmission(submission, 'reject')"
                                    :disabled="reviewingId !== null"
                                >
                                    Reject
                                </button>
                            </div>

                            <p
                                v-if="submissionMessages[submission.id]"
                                role="status"
                            >
                                {{ submissionMessages[submission.id] }}
                            </p>
                        </article>
                    </div>

                    <button
                        type="button"
                        @click="loadSubmissions"
                        :disabled="submissionsLoading || reviewingId !== null"
                    >
                        Refresh submissions
                    </button>
                </section>
            </div>

            <p v-else role="alert">{{ error }}</p>
        </main>
    `,

    data() {
        return {
            loading: true,
            isAdmin: false,
            username: '',
            error: 'You do not have permission to access this page.',

            playersLoading: false,
            playersError: '',
            players: [],
            identities: [],
            selectedProfiles: {},
            playerMessages: {},
            savingUser: null,

            playerSearch: '',
            playerFilter: 'all',
            playerLimit: 50,
            identitySearch: {},
            banningUser: null,
            banMessages: {},

            submissionsLoading: false,
            submissionsError: '',
            submissions: [],
            submissionFilter: 'pending',
            submissionSearch: '',
            reviewingId: null,
            submissionMessages: {}
        };
    },

    computed: {
        filteredPlayers() {
            const query = this.playerSearch.trim().toLowerCase();

            return this.players.filter(player => {
                const matchesSearch = !query || [
                    player.username,
                    player.email,
                    player.leaderboard_name
                ].some(value =>
                    String(value || '').toLowerCase().includes(query)
                );

                const banned = player.is_banned === 1;

                const matchesFilter =
                    this.playerFilter === 'all' ||
                    (this.playerFilter === 'linked' &&
                        !!player.leaderboard_name) ||
                    (this.playerFilter === 'unlinked' &&
                        !player.leaderboard_name) ||
                    (this.playerFilter === 'banned' && banned) ||
                    (this.playerFilter === 'active' && !banned);

                return matchesSearch && matchesFilter;
            });
        },

        visiblePlayers() {
            return this.filteredPlayers.slice(0, this.playerLimit);
        },

        bannedCount() {
            return this.players.filter(p => p.is_banned === 1).length;
        },

        pendingCount() {
            return this.submissions.filter(s => s.status === 'pending').length;
        },

        approvedCount() {
            return this.submissions.filter(s => s.status === 'approved').length;
        },

        rejectedCount() {
            return this.submissions.filter(s => s.status === 'rejected').length;
        },

        filteredSubmissions() {
            const query = this.submissionSearch.trim().toLowerCase();

            return this.submissions.filter(submission => {
                const matchesStatus =
                    this.submissionFilter === 'all' ||
                    submission.status === this.submissionFilter;

                const payload = submission.payload || {};
                const searchable = [
                    submission.id,
                    submission.username,
                    submission.type,
                    submission.status,
                    payload.levelFile,
                    payload.name,
                    payload.fileName,
                    payload.author,
                    ...(payload.creators || [])
                ].join(' ').toLowerCase();

                return matchesStatus &&
                    (!query || searchable.includes(query));
            });
        }
    },

    async mounted() {
        try {
            const response = await fetch('/api/admin/me', {
                credentials: 'same-origin',
                cache: 'no-store'
            });

            if (response.status === 401 || response.status === 403) {
                await this.$router.replace('/profile');
                return;
            }

            if (!response.ok) {
                throw new Error('Could not verify admin permissions.');
            }

            const result = await response.json();

            if (result.admin !== true) {
                await this.$router.replace('/profile');
                return;
            }

            this.username = result.username;
            this.isAdmin = true;

            await Promise.all([
                this.loadPlayers(),
                this.loadSubmissions()
            ]);
        } catch {
            this.error = 'Could not verify admin access. Please try again.';
        } finally {
            this.loading = false;
        }
    },

    methods: {
        filteredIdentities(player) {
            const query = (this.identitySearch[player.id] || '')
                .trim().toLowerCase();

            return this.identities
                .filter(identity =>
                    !query || identity.toLowerCase().includes(query)
                )
                .slice(0, 100);
        },

        async loadPlayers() {
            this.playersLoading = true;
            this.playersError = '';

            try {
                const response = await fetch('/api/admin/players', {
                    credentials: 'same-origin',
                    cache: 'no-store'
                });

                const result = await response.json();

                if (!response.ok) {
                    throw new Error(
                        result.error || 'Could not load player accounts.'
                    );
                }

                this.players = result.players || [];
                this.identities = result.identities || [];

                this.selectedProfiles = Object.fromEntries(
                    this.players.map(player => [
                        player.id,
                        player.leaderboard_name || ''
                    ])
                );

                this.playerMessages = {};
                this.banMessages = {};
                this.playerLimit = 50;
            } catch (error) {
                this.playersError =
                    error.message || 'Could not load player accounts.';
            } finally {
                this.playersLoading = false;
            }
        },

        async saveProfile(player) {
            this.savingUser = player.id;
            this.playerMessages[player.id] = '';

            try {
                const response = await fetch('/api/admin/players/link', {
                    method: 'POST',
                    credentials: 'same-origin',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        userId: player.id,
                        leaderboardName: this.selectedProfiles[player.id] || ''
                    })
                });

                const result = await response.json();

                if (!response.ok) {
                    throw new Error(
                        result.error || 'Could not update the profile link.'
                    );
                }

                player.leaderboard_name = result.leaderboardName || null;
                this.selectedProfiles[player.id] = result.leaderboardName || '';
                this.playerMessages[player.id] = result.leaderboardName
                    ? `Linked to ${result.leaderboardName}.`
                    : 'Leaderboard identity unlinked.';
            } catch (error) {
                this.playerMessages[player.id] =
                    error.message || 'Could not update the profile link.';
            } finally {
                this.savingUser = null;
            }
        },

        async banPlayer(player) {
            const reason = window.prompt(
                `Why are you banning ${player.username}? (Optional, max 500 characters)`
            );

            if (reason === null) return;

            if (reason.trim().length > 500) {
                window.alert('The ban reason must be 500 characters or fewer.');
                return;
            }

            if (!window.confirm(
                `Are you sure you want to ban ${player.username}?`
            )) {
                return;
            }

            await this.setBanStatus(player, 'ban', reason.trim());
        },

        async unbanPlayer(player) {
            if (!window.confirm(
                `Are you sure you want to unban ${player.username}?`
            )) {
                return;
            }

            await this.setBanStatus(player, 'unban', '');
        },

        async setBanStatus(player, action, reason) {
            this.banningUser = player.id;
            this.banMessages[player.id] = '';

            try {
                const response = await fetch('/api/admin/players/ban', {
                    method: 'POST',
                    credentials: 'same-origin',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        userId: player.id,
                        action,
                        reason
                    })
                });

                const result = await response.json();

                if (!response.ok) {
                    throw new Error(
                        result.error || `Could not ${action} account.`
                    );
                }

                this.banMessages[player.id] = result.message ||
                    `Account ${action === 'ban' ? 'banned' : 'unbanned'}.`;

                await this.loadPlayers();
            } catch (error) {
                this.banMessages[player.id] =
                    error.message || `Could not ${action} account.`;
            } finally {
                this.banningUser = null;
            }
        },

        async loadSubmissions() {
            this.submissionsLoading = true;
            this.submissionsError = '';

            try {
                const response = await fetch('/api/admin/submissions', {
                    credentials: 'same-origin',
                    cache: 'no-store'
                });

                const result = await response.json();

                if (!response.ok) {
                    throw new Error(
                        result.error || 'Could not load submissions.'
                    );
                }

                this.submissions = result.submissions || [];
            } catch (error) {
                this.submissionsError =
                    error.message || 'Could not load submissions.';
            } finally {
                this.submissionsLoading = false;
            }
        },

        async reviewSubmission(submission, action) {
            const verb = action === 'approve' ? 'approve' : 'reject';

            if (!window.confirm(
                `Are you sure you want to ${verb} this ${submission.type} submission?`
            )) {
                return;
            }

            this.reviewingId = submission.id;
            this.submissionMessages[submission.id] = '';

            try {
                const response = await fetch(
                    '/api/admin/submissions/review',
                    {
                        method: 'POST',
                        credentials: 'same-origin',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            id: submission.id,
                            action
                        })
                    }
                );

                const result = await response.json();

                if (!response.ok) {
                    throw new Error(
                        result.error || `Could not ${verb} submission.`
                    );
                }

                this.submissionMessages[submission.id] =
                    `Submission ${result.status}.`;

                await this.loadSubmissions();
            } catch (error) {
                this.submissionMessages[submission.id] =
                    error.message || `Could not ${verb} submission.`;
                await this.loadSubmissions();
            } finally {
                this.reviewingId = null;
            }
        }
    }
};
