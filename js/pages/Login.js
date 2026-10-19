
export default {
    template: `
        <main class="account-page">
            <section class="account-card">
                <h1>Welcome back</h1>
                <p>Log in to your Suberboys account.</p>

                <p v-if="$route.query.registered === '1'" role="status">
                    Account created! You can now log in.
                </p>

                <form @submit.prevent="login">
                    <label for="login-email">Email</label>
                    <input
                        id="login-email"
                        v-model.trim="email"
                        type="email"
                        autocomplete="email"
                        required
                    >

                    <label for="login-password">Password</label>
                    <input
                        id="login-password"
                        v-model="password"
                        type="password"
                        autocomplete="current-password"
                        required
                    >

                    <p v-if="message" role="alert">{{ message }}</p>

                    <button type="submit" :disabled="loading">
                        {{ loading ? 'Logging in...' : 'Log in' }}
                    </button>
                </form>

                <p>New here?
                    <router-link to="/register">Create an account</router-link>
                </p>
            </section>
        </main>
    `,
    data() {
        return {
            email: '',
            password: '',
            message: '',
            loading: false
        };
    },
    methods: {
        async login() {
            this.loading = true;
            this.message = '';

            try {
                const response = await fetch('/api/auth/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'same-origin',
                    body: JSON.stringify({
                        email: this.email,
                        password: this.password
                    })
                });

                const result = await response.json();

                if (!response.ok) {
                    this.message = result.error || 'Login failed.';
                    return;
                }

                this.$router.push('/profile');
            } catch {
                this.message = 'Could not connect. Please try again.';
            } finally {
                this.loading = false;
            }
        }
    }
};
