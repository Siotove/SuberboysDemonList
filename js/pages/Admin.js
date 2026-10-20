
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
                        Manage player accounts and link existing
                        leaderboard identities.
                    </p>
                    <p>Player management is coming next.</p>
                </section>

                <section class="admin-section">
                    <h2>Submissions</h2>
                    <p>
                        Review level verifications and completion
                        submissions.
                    </p>
                    <p>Submission management is coming next.</p>
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
            error: 'You do not have permission to access this page.'
        };
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
        } catch {
            this.error = 'Could not verify admin access. Please try again.';
        } finally {
            this.loading = false;
        }
    }
};
