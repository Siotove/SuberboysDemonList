
export default {
    template: `
        <main class="account-page">
            <section class="account-card">
                <h1>Player profile</h1>

                <p v-if="loading">Loading your profile...</p>

                <div v-else-if="user">
                    <h2>{{ user.username }}</h2>
                    <p>Suberboys Demon List member</p>

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
                    <p>{{ message || 'Please log in to view your profile.' }}</p>
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
            message: ''
        };
    },
    async mounted() {
        try {
            const response = await fetch('/api/auth/me', {
                credentials: 'same-origin',
                cache: 'no-store'
            });

            const result = await response.json();
            this.user = result.user;

            if (!this.user) {
                this.message = 'Please log in to view your profile.';
            }
        } catch {
            this.message = 'Could not load your profile. Please try again.';
        } finally {
            this.loading = false;
        }
    },
    methods: {
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
