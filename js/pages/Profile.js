
export default {
    template: `
        <main class="account-page profile-page">
            <section class="profile-hero">
                <div class="profile-avatar" aria-hidden="true">
                    {{ user ? user.username.charAt(0).toUpperCase() : '?' }}
                </div>

                <p class="profile-eyebrow">SUBERBOYS DEMON LIST</p>
                <h1>Player Profile</h1>

                <p v-if="loading" class="profile-muted">
                    Loading your account...
                </p>

                <template v-else-if="user">
                    <h2 class="profile-username">{{ user.username }}</h2>
                    <p class="profile-muted">Member of the Demon List community</p>

                    <div class="profile-actions">
                        <router-link class="profile-primary-button" to="/submit">
                            Submit a Record
                        </router-link>

                        <router-link class="profile-secondary-button" to="/leaderboard">
                            View Leaderboard
                        </router-link>
                    </div>
                </template>

                <template v-else>
                    <p class="profile-muted">
                        {{ message || 'Log in to view your player profile.' }}
                    </p>

                    <div class="profile-actions">
                        <router-link class="profile-primary-button" to="/login">
                            Log In
                        </router-link>

                        <router-link class="profile-secondary-button" to="/register">
                            Create Account
                        </router-link>
                    </div>
                </template>
            </section>

            <section v-if="!loading && user" class="profile-panel">
                <div class="profile-panel-heading">
                    <div>
                        <p class="profile-eyebrow">YOUR ACCOUNT</p>
                        <h2>Leaderboard Identity</h2>
                    </div>
                    <span
                        class="profile-status"
                        :class="leaderboardProfile ? 'profile-status-linked' : 'profile-status-unlinked'"
                    >
                        {{ leaderboardProfile ? 'Linked' : 'Not linked' }}
                    </span>
                </div>

                <p v-if="leaderboardLoading" class="profile-muted">
                    Loading leaderboard identity...
                </p>

                <div v-else-if="leaderboardProfile" class="profile-identity">
                    <div class="profile-identity-icon" aria-hidden="true">
                        {{ leaderboardProfile.leaderboard_name.charAt(0).toUpperCase() }}
                    </div>

                    <div>
                        <p class="profile-muted">Your public leaderboard name</p>
                        <h3>{{ leaderboardProfile.leaderboard_name }}</h3>
                    </div>
                </div>

                <div v-else class="profile-link-form">
                    <p>
                        Link your leaderboard name to submit records under
                        your public player identity.
                    </p>

                    <form @submit.prevent="joinLeaderboard">
                        <label for="leaderboard-name">Leaderboard name</label>

                        <input
                            id="leaderboard-name"
                            v-model.trim="leaderboardName"
                            type="text"
                            minlength="1"
                            maxlength="24"
                            autocomplete="off"
                            placeholder="Enter your leaderboard name"
                            required
                            :disabled="joining"
                        >

                        <button
                            type="submit"
                            class="profile-primary-button"
                            :disabled="joining || !leaderboardName"
                        >
                            {{ joining ? 'Linking...' : 'Link Leaderboard Identity' }}
                        </button>
                    </form>
                </div>

                <p v-if="leaderboardMessage" role="status" class="profile-message">
                    {{ leaderboardMessage }}
                </p>
            </section>

            <section v-if="!loading && user" class="profile-panel">
                <p class="profile-eyebrow">QUICK ACCESS</p>
                <h2>What do you want to do?</h2>

                <div class="profile-quick-links">
                    <router-link to="/submit" class="profile-quick-link">
                        <span class="profile-quick-icon">＋</span>
                        <span>
                            <strong>Submit a Record</strong>
                            <small>Send a completion or verification for review</small>
                        </span>
                        <span aria-hidden="true">→</span>
                    </router-link>

                    <router-link to="/leaderboard" class="profile-quick-link">
                        <span class="profile-quick-icon">★</span>
                        <span>
                            <strong>Leaderboard</strong>
                            <small>Explore players and leaderboard rankings</small>
                        </span>
                        <span aria-hidden="true">→</span>
                    </router-link>
                </div>
            </section>

            <section v-if="!loading && user" class="profile-panel profile-account-panel">
                <div>
                    <h2>Account</h2>
                    <p class="profile-muted">
                        Logged in as {{ user.username }}
                    </p>
                </div>

                <button
                    type="button"
                    class="profile-logout-button"
                    @click="logout"
                    :disabled="loggingOut"
                >
                    {{ loggingOut ? 'Logging out...' : 'Log Out' }}
                </button>
            </section>

            <p v-if="message && user" role="status" class="profile-message">
                {{ message }}
            </p>
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

            if (this.user) {
                await this.loadLeaderboardProfile();
            }
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
                const response = await fetch('/api/leaderboard/profile', {
                    credentials: 'same-origin',
                    cache: 'no-store'
                });

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
                        result.error || 'Could not link your leaderboard identity.';
                    return;
                }

                this.leaderboardProfile = result.profile;
                this.leaderboardName = '';
                this.leaderboardMessage =
                    'Leaderboard identity linked successfully!';
            } catch {
                this.leaderboardMessage = 'Connection failed. Please try again.';
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
