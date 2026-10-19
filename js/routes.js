
import HigherLower from './pages/HigherLower.js';
import List from './pages/List.js';
import Achievements from './pages/Achievements.js';
import Leaderboard from './pages/Leaderboard.js';
import Roulette from './pages/Roulette.js';
import Packs from './pages/Packs.js';
import Games from './pages/Games.js';

import Login from './pages/Login.js';
import Register from './pages/Register.js';
import Profile from './pages/Profile.js';

export default [
    { path: '/', component: List },
    { path: '/leaderboard', component: Leaderboard },
    { path: '/achievements', component: Achievements },
    { path: '/games', component: Games },
    { path: '/games/higher-lower', component: HigherLower },
    { path: '/games/roulette', component: Roulette },
    { path: '/roulette', redirect: '/games/roulette' },
    { path: '/packs', component: Packs },

    { path: '/login', component: Login },
    { path: '/register', component: Register },
    { path: '/profile', component: Profile },
];
