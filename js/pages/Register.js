
export default {
    template: `
        <main class="account-page">
            <section class="account-card">
                <h1>Create an account</h1>
                <p>Join the Suberboys Demon List community.</p>

                <form @submit.prevent="register">
                    <label for="register-username">Username</label>
                    <input
                        id="register-username"
                        v-model.trim="username"
                        type="text"
                        minlength="3"
                        maxlength="24"
                        pattern="[A-Za-z0-9_]+"
                        autocomplete="username"
                        required
                    >

                    <label for="register-email">Email</label>
                    <input
                        id="register-email"
                        v-model.trim="email"
                        type="email"
                        maxlength="254"
                        autocomplete="email"
                        required
                    >

                    <label for="register-password">Password</label>
                    <input
                        id="register-password"
                        v-model="password"
                        type="password"
                        minlength="12"
                        maxlength="128"
                        autocomplete="new-password"
                        required
                    >

                    <p v-if="message" role="status">{{ message }}</p>

                    <button type="submit" :disabled="loading">
                        {{ loading ? 'Creating account...' : 'Register' }}
                    </button>
                </form>

                <p>Already have an account?
                    <router-link to="/login">Log in</router-link>
                </p>
            </section>
        </main>
    `,
    data() {
        return {
            username: '',
            email: '',
            password: '',
            message: '',
            loading: false
        };
    },
    methods: {
        async register() {
            this.loading = true;
            this.message = '';

            try {
                const response = await fetch('/api/auth/register', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'same-origin',
                    body: JSON.stringify({
                        username: this.username,
                        email: this.email,
                        password: this.password
                    })
                });

                const result = await response.json();

                if (!response.ok) {
                    this.message = result.error || 'Registration failed.';
                    return;
                }

                this.$router.push({
                    path: '/login',
                    query: { registered: '1' }
                });
            } catch {
                this.message = 'Could not connect. Please try again.';
            } finally {
                this.loading = false;
            }
        }
    }
};
