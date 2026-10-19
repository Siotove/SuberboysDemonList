
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
                        autocomplete="username"
                        required
                    >

                    <label for="register-email">Email</label>
                    <input
                        id="register-email"
                        v-model.trim="email"
                        type="email"
                        autocomplete="email"
                        required
                    >

                    <label for="register-password">Password</label>
                    <input
                        id="register-password"
                        v-model="password"
                        type="password"
                        minlength="12"
                        autocomplete="new-password"
                        required
                    >

                    <p v-if="message" role="status">{{ message }}</p>

                    <button type="submit" :disabled="loading">
                        {{ loading ? 'Creating account...' : 'Register' }}
                    </button>
                </form>

                <p>
                    Already registered?
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
            this.message = 'Account registration is not connected yet.';
        }
    }
};

