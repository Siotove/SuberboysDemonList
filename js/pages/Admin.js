
export default {
    template: `
        <main class="admin-page">
            <h1>Admin Panel</h1>

            <p v-if="loading">Checking admin permissions...</p>

            <div v-else-if="isAdmin">
                <p>Welcome, {{ username }}!</p>

                <section class="admin-section">
                    <h2>Player Management</h2>

                    <p>
                        Link registered accounts to existing leaderboard
                        identities. Changing a link does not change scores.
                    </p>

                    <p v-if="playersLoading">Loading player accounts...</p>
                    <p v-else-if="playersError" role="alert">
                        {{ playersError }}
                    </p>

                    <div v-else>
                        <p v-if="players.length === 0">
                            No registered accounts found.
                        </p>

                        <div
                            v-for="player in players"
                            :key="player.id"
                            class="admin-player"
                        >
                            <h3>
                                {{ player.username }}
                                <span v-if="player.is_admin === 1">(admin)</span>
                            </h3>

                            <p>{{ player.email }}</p>
                            <p>
                                Current identity:
                                <strong>
                                    {{ player.leaderboard_name || 'Not linked' }}
                                </strong>
                            </p>

                            <label :for="'profile-' + player.id">
                                Leaderboard identity
                            </label>

                            <select
                                :id="'profile-' + player.id"
                                v-model="selectedProfiles[player.id]"
                                :disabled="savingUser === player.id"
                            >
                                <option value="">Not linked</option>
                                <option
                                    v-for="identity in identities"
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

                            <p v-if="playerMessages[player.id]" role="status">
                                {{ playerMessages[player.id] }}
                            </p>
                            <hr>
                        </div>
                    </div>

                    <button
                        type="button"
                        @click="loadPlayers"
                        :disabled="playersLoading"
                    >
                        Refresh accounts
                    </button>
                </section>

                <section class="admin-section">
                    <h2>Submissions</h2>
                    <p>
                        Review completion records and new level verifications.
                    </p>

                    <p v-if="submissionsLoading">
                        Loading submissions...
                    </p>

                    <p v-else-if="submissionsError" role="alert">
                        {{ submissionsError }}
                    </p>

                    <div v-else>
                        <label for="submission-filter">Show</label>
                        <select id="submission-filter" v-model="submissionFilter">
                            <option value="pending">Pending review</option>
                            <option value="failed">Failed</option>
                            <option value="processing">Processing</option>
                            <option value="approved">Approved</option>
                            <option value="rejected">Rejected</option>
                            <option value="all">All submissions</option>
                        </select>

                        <p v-if="filteredSubmissions.length === 0">
                            No submissions in this category.
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
                            <p><strong>Submitted by:</strong> {{ submission.username }}</p>
                            <p><strong>Submitted:</strong> {{ submission.created_at }}</p>
                            <p><strong>Submission ID:</strong> {{ submission.id }}</p>

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
                                    >
                                        Open proof video
                                    </a>
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
                                    {{ submission.payload.creators.join(', ') }}
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
                                    >
                                        Open verification video
                                    </a>
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

            submissionsLoading: false,
            submissionsError: '',
            submissions: [],
            submissionFilter: 'pending',
            reviewingId: null,
            submissionMessages: {}
        };
    },

    computed: {
        filteredSubmissions() {
            if (this.submissionFilter === 'all') {
                return this.submissions;
            }

            return this.submissions.filter(
                submission => submission.status === this.submissionFilter
            );
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
            this.error =
                'Could not verify admin access. Please try again.';
        } finally {
            this.loading = false;
        }
    },

    methods: {
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
