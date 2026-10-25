
import routes from './routes.js';
import { isHalloweenEventActive } from './event-schedule.js';

export const store = Vue.reactive({
    dark: JSON.parse(localStorage.getItem('dark')) || false,

    halloween: isHalloweenEventActive(),

    toggleDark() {
        this.dark = !this.dark;
        localStorage.setItem('dark', JSON.stringify(this.dark));
    },
});

function updateHalloweenTheme() {
    store.halloween = isHalloweenEventActive();

    document.body.classList.toggle(
        'halloween-theme',
        store.halloween
    );
}

const app = Vue.createApp({
    data: () => ({ store }),

    mounted() {
        updateHalloweenTheme();

        this.halloweenTimer = setInterval(
            updateHalloweenTheme,
            60 * 1000
        );
    },

    beforeUnmount() {
        clearInterval(this.halloweenTimer);
    },
});

const router = VueRouter.createRouter({
    history: VueRouter.createWebHashHistory(),
    routes,
});

app.use(router);
app.mount('#app');

// hallnoween
updateHalloweenTheme();
