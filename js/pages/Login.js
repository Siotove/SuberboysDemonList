
export default {
    template: `
        <main class="account-page">
            <section class="account-card">
                <h1>Welcome back</h1>
                <p>Log in to your Suberboys account.</p>

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

                    <p v-if="message" role="status">{{ message }}</p>

                    <button type="submit" :disabled="loading">
                        {{ loading ? 'Logging in...' : 'Log in' }}
                    </button>
                </form>

                <p>
                    Don't have an account?
                    <router-link to="/register">Register</router-link>
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
            this.message = 'Account authentication is not connected yet.';
        }
    }
};

