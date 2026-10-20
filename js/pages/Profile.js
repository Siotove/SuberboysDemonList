export default {
    template: `
        <main class="account-page">
            <section class="account-card">
                <h1>Player profile</h1>
<p>
    <router-link to="/submit">
        Submit a Record
    </router-link>
</p>
                <p v-if="loading">Loading your profile...</p>

                <div v-else-if="user">
                    <h2>{{ user.username }}</h2>
                    <p>Suberboys Demon List member</p>

                    <hr>

                    <h2>Leaderboard identity</h2>

                    <p v-if="leaderboardLoading">
                        Loading leaderboard profile...
                    </p>

                    <div v-else-if="leaderboardProfile">
                        <p>
                            Linked identity:
                            <strong>
                                {{ leaderboardProfile.leaderboard_name }}
                            </strong>
                        </p>
                    </div>

                    <div v-else>
                        <p>
                            You haven't joined the leaderboard yet.
                        </p>

                        <form @submit.prevent="joinLeaderboard">
                            <label for="leaderboard-name">
                                Leaderboard name
                            </label>

                            <input
                                id="leaderboard-name"
                                v-model.trim="leaderboardName"
                                type="text"
                                minlength="1"
                                maxlength="24"
                                autocomplete="off"
                                required
                                :disabled="joining"
                            >

                            <button
                                type="submit"
                                :disabled="joining || !leaderboardName"
                            >
                                {{ joining
                                    ? 'Joining...'
                                    : 'Join Leaderboard'
                                }}
                            </button>
                        </form>
                    </div>

                    <p v-if="leaderboardMessage" role="status">
                        {{ leaderboardMessage }}
                    </p>

                    <hr>

                    <button
                        type="button"
                        @click="logout"
                        :disabled="loggingOut"
                    >
                        {{ loggingOut ? 'Logging out...' : 'Log out' }}
                    </button>

                    <p v-if="message" role="status">{{ message }}</p>
                </div>

                <div v-else>
                    <p>
                        {{ message || 'Please log in to view your profile.' }}
                    </p>
                    <router-link to="/login">Log in</router-link>
                    <span> · </span>
                    <router-link to="/register">Register</router-link>
                </div>
            </section>
        </main>
    `,

    data() {
        return {
            user: null,
            loading: true,
            loggingOut: false,
            message: '',
            leaderboardProfile: null,
            leaderboardName: '',
            leaderboardLoading: true,
            joining: false,
            leaderboardMessage: ''
        };
    },

    async mounted() {
        try {
            const response = await fetch('/api/auth/me', {
                credentials: 'same-origin',
                cache: 'no-store'
            });

            if (!response.ok) {
                throw new Error('Profile request failed');
            }

            const result = await response.json();
            this.user = result.user;

            if (!this.user) {
                this.message = 'Please log in to view your profile.';
                return;
            }

            await this.loadLeaderboardProfile();
        } catch {
            this.message = 'Could not load your profile. Please try again.';
        } finally {
            this.loading = false;
        }
    },

    methods: {
        async loadLeaderboardProfile() {
            this.leaderboardLoading = true;

            try {
                const response = await fetch(
                    '/api/leaderboard/profile',
                    {
                        credentials: 'same-origin',
                        cache: 'no-store'
                    }
                );

                if (!response.ok) {
                    throw new Error('Leaderboard profile request failed');
                }

                const result = await response.json();
                this.leaderboardProfile = result.profile || null;
            } catch {
                this.leaderboardMessage =
                    'Could not load your leaderboard identity. Please try again.';
            } finally {
                this.leaderboardLoading = false;
            }
        },

        async joinLeaderboard() {
            this.joining = true;
            this.leaderboardMessage = '';

            try {
                const response = await fetch('/api/leaderboard/join', {
                    method: 'POST',
                    credentials: 'same-origin',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        leaderboardName: this.leaderboardName
                    })
                });

                const result = await response.json();

                if (!response.ok) {
                    this.leaderboardMessage =
                        result.error || 'Could not join the leaderboard.';
                    return;
                }

                this.leaderboardProfile = result.profile;
                this.leaderboardName = '';
                this.leaderboardMessage =
                    'Leaderboard identity linked successfully!';
            } catch {
                this.leaderboardMessage =
                    'Could not connect. Please try again.';
            } finally {
                this.joining = false;
            }
        },

        async logout() {
            this.loggingOut = true;
            this.message = '';

            try {
                const response = await fetch('/api/auth/logout', {
                    method: 'POST',
                    credentials: 'same-origin'
                });

                if (!response.ok) {
                    this.message = 'Logout failed. Please try again.';
                    return;
                }

                this.user = null;
                await this.$router.push('/login');
            } catch {
                this.message = 'Could not connect. Please try again.';
            } finally {
                this.loggingOut = false;
            }
        }
    }
};
