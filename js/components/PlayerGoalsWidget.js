import { fetchLeaderboard } from '../content.js';

export default {
    name: 'PlayerGoalsWidget',
    data() {
        return { goal: null, loading: true, message: '', error: '', timer: null };
    },
    template: `
        <section v-if="goal" class="competition-goal-card">
            <div class="competition-goal-header"><span class="competition-eyebrow">YOUR NEXT TARGET</span><span class="competition-live-label">Live leaderboard</span></div>
            <template v-if="goal.isFirst">
                <h3>You're #1 — defend your lead 🏆</h3>
                <p class="competition-muted">You have {{ formatPoints(goal.totalPoints) }} points. Check back after the leaderboard updates to see if anyone closes the gap.</p>
            </template>
            <template v-else>
                <h3>Overtake <strong>{{ goal.target.name }}</strong> <span class="competition-goal-rank">(#{{ goal.target.rank }})</span></h3>
                <p class="competition-goal-needed">You need <strong>+{{ formatPoints(goal.pointsNeeded) }}</strong> points to move ahead.</p>
                <div class="competition-progress-track" role="progressbar" :aria-valuenow="goal.progress" aria-valuemin="0" aria-valuemax="100" :aria-label="'Progress toward ' + goal.target.name">
                    <span :style="{ width: goal.progress + '%' }"></span>
                </div>
                <div class="competition-goal-foot"><span>Your points: {{ formatPoints(goal.totalPoints) }}</span><span>Target: {{ formatPoints(goal.target.totalPoints + 0.001) }}</span></div>
            </template>
            <p v-if="goal.snapshotDate" class="competition-muted competition-goal-date">Snapshot: {{ goal.snapshotDate }} · goal recalculates from current board data when available.</p>
        </section>
        <p v-else-if="message" class="competition-goal-message">{{ message }}</p>
    `,
    async mounted() {
        await this.load();
        this.timer = setInterval(() => this.load(), 120000);
    },
    beforeUnmount() { if (this.timer) clearInterval(this.timer); },
    methods: {
        formatPoints(value) {
            return (Number(value) || 0).toLocaleString('en-GB', { maximumFractionDigits: 3 });
        },
        async load() {
            this.loading = true;
            this.error = '';
            try {
                const response = await fetch('/api/competition/goals', { credentials: 'same-origin', cache: 'no-store' });
                const serverGoal = await response.json();
                if (!response.ok) {
                    this.goal = null;
                    this.message = response.status === 401 ? '' : (serverGoal.error || 'Your next goal is unavailable.');
                    return;
                }
                this.message = '';
                let leaderboard = [];
                try {
                    const result = await fetchLeaderboard();
                    leaderboard = Array.isArray(result?.[0]) ? result[0] : [];
                } catch { /* Fall back to the snapshot goal below. */ }
                const identity = String(serverGoal.playerName || '').trim().toLocaleLowerCase('en');
                const ordered = [...leaderboard].sort((a, b) => (Number(b.total) || 0) - (Number(a.total) || 0));
                const index = ordered.findIndex(player => String(player.user || '').trim().toLocaleLowerCase('en') === identity);
                if (index >= 0) {
                    const player = ordered[index];
                    const target = index > 0 ? ordered[index - 1] : null;
                    const needed = target ? Math.max(0, Number((Number(target.total) - Number(player.total) + 0.001).toFixed(3))) : 0;
                    const targetPoints = target ? Number(target.total) + 0.001 : Number(player.total);
                    this.goal = {
                        playerName: player.user, rank: index + 1, totalPoints: Number(player.total) || 0,
                        target: target ? { name: target.user, rank: index, totalPoints: Number(target.total) || 0 } : null,
                        pointsNeeded: needed, isFirst: !target,
                        progress: targetPoints > 0 ? Math.max(0, Math.min(100, Math.round((Number(player.total) / targetPoints) * 100))) : 100,
                        snapshotDate: serverGoal.snapshotDate
                    };
                } else {
                    this.goal = { ...serverGoal, progress: serverGoal.target?.totalPoints ? Math.max(0, Math.min(100, Math.round((Number(serverGoal.totalPoints) / (Number(serverGoal.target.totalPoints) + 0.001)) * 100))) : 100 };
                }
            } catch (error) {
                this.goal = null;
                this.error = error.message || 'Goal data is temporarily unavailable.';
            } finally {
                this.loading = false;
            }
        }
    }
};
