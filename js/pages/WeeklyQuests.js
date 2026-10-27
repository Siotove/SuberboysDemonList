import Spinner from '../components/Spinner.js';
import { localize } from '../util.js';

export default {
    components: { Spinner },
    data() {
        return {
            loading: true,
            data: null,
            error: null,
            statusCode: 0
        };
    },
    template: `
        <main class="weekly-quests-page">
            <header class="weekly-quests-header">
                <p class="weekly-quests-eyebrow">WEEKLY CHALLENGES</p>
                <h1>Quests & Secrets</h1>
                <p>Make progress on the list, complete weekly challenges, and uncover hidden achievements.</p>
            </header>

            <div v-if="loading" class="weekly-quests-loading"><Spinner /></div>
            <section v-else-if="error" class="weekly-quests-panel weekly-quests-gate">
                <span class="weekly-quests-gate-icon">✦</span>
                <h2>{{ statusCode === 401 ? 'Log in to track your quests' : statusCode === 409 ? 'Link your leaderboard identity' : 'Quests could not load' }}</h2>
                <p>{{ error }}</p>
                <div class="weekly-quests-gate-actions">
                    <router-link v-if="statusCode === 401" class="weekly-quests-button" to="/login">Log in</router-link>
                    <router-link v-if="statusCode === 409" class="weekly-quests-button" to="/profile">Open Profile</router-link>
                    <button class="weekly-quests-button weekly-quests-button--quiet" @click="loadQuests">Try again</button>
                </div>
            </section>
            <template v-else-if="data">
                <section class="weekly-quests-overview">
                    <div class="weekly-quests-overview-copy">
                        <span class="weekly-quests-kicker">YOUR WEEKLY RUN</span>
                        <h2>{{ data.playerName }}</h2>
                        <p>Week starting {{ data.weekStart }} · Resets {{ data.resetsAt }} (UTC)</p>
                    </div>
                    <div class="weekly-quests-overview-rank">
                        <span>Current rank</span>
                        <strong>#{{ data.current.rank }}</strong>
                        <small>{{ localize(data.current.totalPoints) }} points</small>
                    </div>
                </section>

                <section class="weekly-quests-section">
                    <div class="weekly-quests-section-heading">
                        <div><h2>Weekly quests</h2><p>Progress is based on the first saved snapshot of this week.</p></div>
                        <span class="weekly-quests-count">{{ completedQuestCount }} / {{ data.quests.length }} complete</span>
                    </div>
                    <div class="weekly-quest-grid">
                        <article v-for="(quest, index) in data.quests" :key="quest.id" class="weekly-quest-card" :class="{ 'is-complete': quest.completed }">
                            <div class="weekly-quest-card-top">
                                <span class="weekly-quest-number">{{ String(index + 1).padStart(2, '0') }}</span>
                                <span class="weekly-quest-state">{{ quest.completed ? '✓ Complete' : 'In progress' }}</span>
                            </div>
                            <h3>{{ quest.name }}</h3>
                            <p>{{ quest.description }}</p>
                            <div class="weekly-quest-progress-copy"><span>{{ formatProgress(quest) }}</span><strong>{{ Math.round(progressPercent(quest)) }}%</strong></div>
                            <div class="weekly-quest-progress" role="progressbar" :aria-valuenow="Math.round(progressPercent(quest))" aria-valuemin="0" aria-valuemax="100" :aria-label="quest.name + ' progress'"><div class="weekly-quest-progress-fill" :style="{ width: progressPercent(quest) + '%' }"></div></div>
                            <small v-if="quest.completedAt" class="weekly-quest-completed-date">Completed {{ quest.completedAt }}</small>
                        </article>
                    </div>
                </section>

                <section class="weekly-quests-section weekly-secrets-section">
                    <div class="weekly-quests-section-heading">
                        <div><h2>Secret achievements</h2><p>The locked ones stay hidden until you discover them.</p></div>
                        <span class="weekly-quests-count">{{ data.secretUnlockedCount }} / {{ data.secretCount }} uncovered</span>
                    </div>
                    <div class="weekly-secret-grid">
                        <article v-for="secret in data.secretAchievements" :key="secret.id" class="weekly-secret-card is-unlocked">
                            <div class="weekly-secret-icon">✦</div>
                            <div class="weekly-secret-copy"><h3>{{ secret.name }}</h3><p>{{ secret.description }}</p><small>Unlocked {{ secret.unlockedAt }}</small></div>
                            <span class="weekly-secret-check">✓</span>
                        </article>
                        <article v-for="secretIndex in data.secretCount - data.secretUnlockedCount" :key="'hidden-' + secretIndex" class="weekly-secret-card is-hidden">
                            <div class="weekly-secret-icon">?</div>
                            <div class="weekly-secret-copy"><h3>???</h3><p>Hidden achievement. Keep playing to find out how to unlock it.</p><small>Still undiscovered</small></div>
                            <span class="weekly-secret-lock">🔒</span>
                        </article>
                    </div>
                </section>
                <p class="weekly-quests-footnote">Rank history is saved once per UTC day. Weekly progress updates with the next snapshot, and completed quests remain complete until the weekly reset.</p>
            </template>
        </main>
    `,
    computed: {
        completedQuestCount() {
            return this.data?.quests?.filter(quest => quest.completed).length || 0;
        }
    },
    methods: {
        localize,
        progressPercent(quest) {
            if (quest.completed) return 100;
            return Math.min(100, Math.max(0, (Number(quest.progress) || 0) / Number(quest.target || 1) * 100));
        },
        formatProgress(quest) {
            const value = Number(quest.progress) || 0;
            const formatted = quest.unit === 'points' ? localize(Number(value.toFixed(3))) : String(Math.floor(value));
            return `${formatted} / ${quest.target} ${quest.unit}`;
        },
        async loadQuests() {
            this.loading = true;
            this.error = null;
            this.statusCode = 0;
            try {
                const response = await fetch('/api/weekly-quests', {
                    credentials: 'same-origin',
                    cache: 'no-store'
                });
                const result = await response.json().catch(() => ({}));
                if (!response.ok) {
                    this.statusCode = response.status;
                    throw new Error(result.error || 'Could not load weekly quests.');
                }
                this.data = result;
            } catch (error) {
                this.error = error.message || 'Could not load weekly quests.';
            } finally {
                this.loading = false;
            }
        }
    },
    mounted() {
        this.loadQuests();
    }
};
