import List from './pages/List.js';
import Achievements from './pages/Achievements.js';
import Leaderboard from './pages/Leaderboard.js';
import Roulette from './pages/Roulette.js';
import Packs from './pages/Packs.js';

export default [
    { path: '/', component: List },
    { path: '/leaderboard', component: Leaderboard },
    { path: '/achievements', component: Achievements },
    { path: '/roulette', component: Roulette },
    { path: '/packs', component: Packs },
];
