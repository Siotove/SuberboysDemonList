
export default {
    template: `
        <main class="account-page">
            <section class="account-card">
                <h1>Player profile</h1>
                <p>Your Suberboys account and player information.</p>

                <div v-if="user">
                    <h2>{{ user.username }}</h2>
                    <p>{{ user.email }}</p>
                    <button type="button" @click="logout">
                        Log out
                    </button>
                </div>

                <div v-else>
                    <p>You need to log in to view your profile.</p>
                    <router-link to="/login">Log in</router-link>
                    <span> · </span>
                    <router-link to="/register">Create an account</router-link>
                </div>
            </section>
        </main>
    `,
    data() {
        return {
            user: null
        };
    },
    methods: {
        logout() {
            this.user = null;
            this.$router.push('/login');
        }
    }
};

