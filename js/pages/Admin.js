export default {
    template: `
        <main class="admin-page">
            <h1>Admin Panel</h1>

            <p v-if="loading">
                Checking admin permissions...
            </p>

            <div v-else-if="isAdmin">
                <p>Welcome, {{ username }}!</p>

                <section class="admin-section">
                    <h2>Player Management</h2>

                    <p>
                        Link registered accounts to existing leaderboard
                        identities. Changing a link does not change scores.
                    </p>

                    <p v-if="playersLoading">
                        Loading player accounts...
                    </p>

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
                                <span v-if="player.is_admin === 1">
                                    (admin)
                                </span>
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

                            <p
                                v-if="playerMessages[player.id]"
                                role="status"
                            >
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
                        Review level verifications and completion submissions.
                    </p>

                    <p>Submission management is coming next.</p>
                </section>
            </div>

            <p v-else role="alert">
                {{ error }}
            </p>
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
            savingUser: null
        };
    },

    async mounted() {
        try {
            const response = await fetch('/api/admin/me', {
                credentials: 'same-origin',
                cache: 'no-store'
            });

            if (
                response.status === 401 ||
                response.status === 403
            ) {
                await this.$router.replace('/profile');
                return;
            }

            if (!response.ok) {
                throw new Error(
                    'Could not verify admin permissions.'
                );
            }

            const result = await response.json();

            if (result.admin !== true) {
                await this.$router.replace('/profile');
                return;
            }

            this.username = result.username;
            this.isAdmin = true;

            await this.loadPlayers();
        } catch {
            this.error =
                'Could not verify admin access or load player accounts. Please try again.';
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
                        result.error ||
                        'Could not load player accounts.'
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
                    error.message ||
                    'Could not load player accounts.';
            } finally {
                this.playersLoading = false;
            }
        },

        async saveProfile(player) {
            this.savingUser = player.id;
            this.playerMessages[player.id] = '';

            try {
                const response = await fetch(
                    '/api/admin/players/link',
                    {
                        method: 'POST',
                        credentials: 'same-origin',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            userId: player.id,
                            leaderboardName:
                                this.selectedProfiles[player.id] || ''
                        })
                    }
                );

                const result = await response.json();

                if (!response.ok) {
                    throw new Error(
                        result.error ||
                        'Could not update the profile link.'
                    );
                }

                player.leaderboard_name =
                    result.leaderboardName || null;

                this.selectedProfiles[player.id] =
                    result.leaderboardName || '';

                this.playerMessages[player.id] =
                    result.leaderboardName
                        ? `Linked to ${result.leaderboardName}.`
                        : 'Leaderboard identity unlinked.';
            } catch (error) {
                this.playerMessages[player.id] =
                    error.message ||
                    'Could not update the profile link.';
            } finally {
                this.savingUser = null;
            }
        }
    }
};
