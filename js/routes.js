import Submit from './pages/Submit.js';
import HigherLower from './pages/HigherLower.js';
import List from './pages/List.js';
import Achievements from './pages/Achievements.js';
import Leaderboard from './pages/Leaderboard.js';
import Roulette from './pages/Roulette.js';
import Packs from './pages/Packs.js';
import Games from './pages/Games.js';
import Admin from './pages/Admin.js';
import Login from './pages/Login.js';
import Register from './pages/Register.js';
import Profile from './pages/Profile.js';
import PlayerShowcase from './pages/PlayerShowcase.js';
import RankHistory from './pages/RankHistory.js';
import WeeklyQuests from './pages/WeeklyQuests.js';

export default [
    { path: '/submit', component: Submit },
    { path: '/', component: List },
    { path: '/leaderboard', component: Leaderboard },
    { path: '/achievements', component: Achievements },
    { path: '/history', component: RankHistory },
    { path: '/quests', component: WeeklyQuests },
    { path: '/games', component: Games },
    { path: '/games/higher-lower', component: HigherLower },
    { path: '/games/roulette', component: Roulette },
    { path: '/roulette', redirect: '/games/roulette' },
    { path: '/packs', component: Packs },
    { path: '/admin', component: Admin },
    { path: '/login', component: Login },
    { path: '/register', component: Register },
    { path: '/players/:name', component: PlayerShowcase },
    { path: '/profile', component: Profile },
];
