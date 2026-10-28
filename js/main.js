
import routes from './routes.js';
import NotificationsBell from './components/NotificationsBell.js';
import PlayerGoalsWidget from './components/PlayerGoalsWidget.js';
import CompetitionSeasonWidget from './components/CompetitionSeasonWidget.js';
import CompetitionAdminTools from './components/CompetitionAdminTools.js';
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

app.component('notifications-bell', NotificationsBell);
app.component('player-goals-widget', PlayerGoalsWidget);
app.component('competition-season-widget', CompetitionSeasonWidget);
app.component('competition-admin-tools', CompetitionAdminTools);

app.mount('#app');

// hallnoween
updateHalloweenTheme();
