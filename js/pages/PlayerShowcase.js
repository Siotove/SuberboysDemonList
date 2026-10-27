import { fetchLeaderboard } from '../content.js';
import { getAchievements } from '../achievements.js';
import Spinner from '../components/Spinner.js';
import { PROFILE_CUSTOMIZATION_DEFAULTS, countryFlag, countryName } from '../profile-customization-options.js';

export default {
    components: { Spinner },
    data() {
        return {
            loading: true,
            error: '',
            players: [],
            playerProfiles: [],
            player: null,
            profile: null,
            loadErrors: [],
            selectedAchievementTier: 'All',
            achievementSearch: '',
            showAllAchievements: false
        };
    },
    template: `
        <main class="player-showcase-page">
            <div v-if="loading" class="player-showcase-loading"><Spinner /></div>
            <section v-else-if="error" class="player-showcase-error">
                <p class="ps-eyebrow">SUBERBOYS DEMON LIST</p>
                <h1>Player not found</h1>
                <p>{{ error }}</p>
                <router-link class="ps-button" to="/leaderboard">Back to leaderboard</router-link>
            </section>
            <div v-else-if="player" class="player-showcase" :class="showcaseClasses" :style="showcaseStyle">
                <div class="ps-banner" :class="'ps-banner-' + (customization.banner_style || 'aurora')">
                    <span class="ps-banner-kicker">PLAYER SHOWCASE</span>
                    <span class="ps-banner-rank">#{{ rank }}</span>
                </div>
                <section class="ps-hero-card" :class="'ps-border-' + (customization.border_style || 'glow')">
                    <div class="ps-hero-row">
                        <div class="ps-avatar" aria-label="Player avatar">
                            <img :src="profile?.avatar_url || '/assets/profile/No%20PFP.png'" alt="" width="80" height="80">
                            <img v-if="profile?.frame_url" class="ps-avatar-frame" :src="profile.frame_url" alt="" width="80" height="80">
                        </div>
                        <div class="ps-identity">
                            <div class="ps-metadata" v-if="customization.country_code || customization.clan_name">
                                <span v-if="customization.country_code" class="ps-country">{{ countryFlag(customization.country_code) }} {{ countryName(customization.country_code) }}</span>
                                <span v-if="customization.clan_name" class="ps-clan">{{ customization.clan_tag ? '[' + customization.clan_tag + '] ' : '' }}{{ customization.clan_name }}<small v-if="customization.clan_role"> · {{ customization.clan_role }}</small></span>
                            </div>
                            <h1>{{ customization.display_name || player.user }}</h1>
                            <p v-if="customization.profile_title" class="ps-title">{{ customization.profile_title }}</p>
                            <p v-if="customization.tagline" class="ps-tagline">{{ customization.tagline }}</p>
                            <p v-if="customization.status" class="ps-status"><span></span>{{ customization.status }}</p>
                        </div>
                    </div>
                    <p v-if="customization.bio" class="ps-bio">{{ customization.bio }}</p>
                    <div class="ps-quick-facts">
                        <span v-if="customization.main_gamemode && customization.main_gamemode !== 'All-around'">Main: {{ customization.main_gamemode }}</span>
                        <span v-if="customization.favorite_level">Favourite level: {{ customization.favorite_level }}</span>
                        <a v-if="customization.website_url" :href="customization.website_url" target="_blank" rel="noopener noreferrer">Website ↗</a>
                    </div>
                </section>

                <section class="ps-stats-grid" aria-label="Player statistics">
                    <article class="ps-stat"><span>Total points</span><strong>{{ localize(player.total || 0) }}</strong></article>
                    <article class="ps-stat"><span>Verified</span><strong>{{ (player.verified || []).length }}</strong></article>
                    <article class="ps-stat"><span>Completed</span><strong>{{ (player.completed || []).length }}</strong></article>
                    <article class="ps-stat"><span>Progress records</span><strong>{{ (player.progressed || []).length }}</strong></article>
                    <article class="ps-stat"><span>Packs beaten</span><strong>{{ (player.packsBeaten || []).length }}</strong></article>
                    <article class="ps-stat"><span>Achievements</span><strong>{{ unlockedAchievements.length }}</strong></article>
                </section>

                <section class="ps-section" v-if="topRecords.length">
                    <div class="ps-section-heading"><div><p class="ps-eyebrow">HIGHLIGHTS</p><h2>Standout records</h2></div><span>{{ topRecords.length }} shown</span></div>
                    <div class="ps-record-list">
                        <a v-for="(record, index) in topRecords" :key="record.level + '-' + index" class="ps-record" :href="record.link || '#levels'" :target="record.link ? '_blank' : null" :rel="record.link ? 'noopener noreferrer' : null">
                            <span class="ps-record-rank">#{{ record.rank || '—' }}</span>
                            <span class="ps-record-main"><strong>{{ record.level }}</strong><small>{{ record.kind }}<template v-if="record.percent"> · {{ record.percent }}%</template></small></span>
                            <strong class="ps-record-score">+{{ localize(record.score || 0) }}</strong>
                        </a>
                    </div>
                </section>

                <section class="ps-section" v-if="allAchievements.length">
                    <div class="ps-section-heading">
                        <div><p class="ps-eyebrow">MILESTONES</p><h2>Achievements</h2></div>
                        <span>{{ unlockedAchievements.length }} / {{ allAchievements.length }} unlocked</span>
                    </div>
                    <div class="ps-achievement-progress-wrap">
                        <div class="ps-achievement-progress" role="progressbar" aria-label="Achievement completion" aria-valuemin="0" aria-valuemax="100" :aria-valuenow="achievementProgressPercent">
                            <span class="ps-achievement-progress-fill" :style="{ width: achievementProgressPercent + '%' }"></span>
                        </div>
                        <span class="ps-achievement-progress-label">{{ achievementProgressPercent }}% complete</span>
                    </div>
                    <div class="ps-achievement-tools" v-if="unlockedAchievements.length">
                        <label class="ps-achievement-search">
                            <span class="ps-sr-only">Search unlocked achievements</span>
                            <input v-model="achievementSearch" type="search" placeholder="Search achievements…" autocomplete="off">
                        </label>
                        <div class="ps-tier-filters" role="group" aria-label="Filter achievements by tier">
                            <button type="button" class="ps-tier-filter" :class="{ 'is-active': selectedAchievementTier === 'All' }" :aria-pressed="selectedAchievementTier === 'All'" @click="selectedAchievementTier = 'All'">All <span>{{ unlockedAchievements.length }}</span></button>
                            <button v-for="tier in achievementTierFilters" :key="tier.name" type="button" :class="['ps-tier-filter', 'ps-filter-' + tierSlug(tier.name), { 'is-active': selectedAchievementTier === tier.name }]" :aria-pressed="selectedAchievementTier === tier.name" @click="selectedAchievementTier = tier.name">{{ tier.name }} <span>{{ tier.count }}</span></button>
                        </div>
                    </div>
                    <div v-if="displayedAchievements.length" class="ps-achievements">
                        <article v-for="achievement in displayedAchievements" :key="achievement.id" :class="['ps-achievement', 'ps-tier-' + tierSlug(achievement.tier)]">
                            <span class="ps-achievement-gem" aria-hidden="true">✦</span>
                            <div class="ps-achievement-copy"><strong>{{ achievement.name }}</strong><small class="ps-achievement-tier">{{ achievement.tier }}</small></div>
                        </article>
                    </div>
                    <p v-else class="ps-achievement-empty">No unlocked achievements match that search or tier.</p>
                    <button v-if="filteredAchievements.length > 12" type="button" class="ps-achievement-expand" @click="showAllAchievements = !showAllAchievements">{{ showAllAchievements ? 'Show fewer' : 'Show all ' + filteredAchievements.length + ' achievements' }}</button>
                </section>

                <section class="ps-section ps-bottom-actions">
                    <router-link class="ps-button" to="/leaderboard">← Back to leaderboard</router-link>
                    <router-link class="ps-button ps-button-secondary" to="/profile">Customise your own profile</router-link>
                </section>
            </div>
        </main>
    `,
    computed: {
        customization() {
            return { ...PROFILE_CUSTOMIZATION_DEFAULTS, ...(this.profile || {}) };
        },
        showcaseStyle() {
            return { '--ps-accent': this.customization.accent_color || '#a855f7' };
        },
        showcaseClasses() {
            return [
                'ps-theme-' + (this.customization.profile_theme || 'midnight'),
                'ps-banner-mode-' + (this.customization.banner_style || 'aurora')
            ];
        },
        rank() {
            const sorted = [...this.players].sort((a, b) => (Number(b.total) || 0) - (Number(a.total) || 0));
            return Math.max(1, sorted.findIndex(item => item.user?.toLocaleLowerCase('en') === this.player?.user?.toLocaleLowerCase('en')) + 1);
        },
        allAchievements() {
            return this.player ? getAchievements(this.player) : [];
        },
        unlockedAchievements() {
            return this.allAchievements.filter(item => item.unlocked);
        },
        achievementProgressPercent() {
            return this.allAchievements.length
                ? Math.round((this.unlockedAchievements.length / this.allAchievements.length) * 100)
                : 0;
        },
        achievementTierFilters() {
            const order = ['Bronze', 'Silver', 'Gold', 'Diamond', 'Platinum', 'Legendary'];
            return order.map(name => ({
                name,
                count: this.unlockedAchievements.filter(item => String(item.tier || '').toLowerCase() === name.toLowerCase()).length
            })).filter(item => item.count > 0);
        },
        filteredAchievements() {
            const query = this.achievementSearch.trim().toLocaleLowerCase('en');
            return this.unlockedAchievements.filter(item => {
                const tierMatches = this.selectedAchievementTier === 'All' || String(item.tier || '').toLowerCase() === this.selectedAchievementTier.toLowerCase();
                const searchMatches = !query || String(item.name || '').toLocaleLowerCase('en').includes(query) || String(item.tier || '').toLocaleLowerCase('en').includes(query);
                return tierMatches && searchMatches;
            });
        },
        displayedAchievements() {
            return this.showAllAchievements ? this.filteredAchievements : this.filteredAchievements.slice(0, 12);
        },
        topRecords() {
            if (!this.player) return [];
            const scoreOf = item => Number(item.score) || 0;
            const records = [
                ...(this.player.verified || []).map(item => ({ ...item, kind: 'Verified' })),
                ...(this.player.completed || []).map(item => ({ ...item, kind: 'Completed' })),
                ...(this.player.progressed || []).map(item => ({ ...item, kind: 'Progress', percent: item.percent }))
            ];
            return records.sort((a, b) => scoreOf(b) - scoreOf(a)).slice(0, 8);
        }
    },
    async mounted() {
        await this.loadPlayer();
    },
    watch: {
        '$route.params.name'() { this.loadPlayer(); }
    },
    methods: {
        countryFlag,
        countryName,
        localize(value) {
            return Number(value || 0).toLocaleString('en-GB', { maximumFractionDigits: 3 });
        },
        tierSlug(value) {
            return String(value || 'default').toLocaleLowerCase('en').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'default';
        },
        async loadPlayer() {
            this.loading = true;
            this.error = '';
            this.player = null;
            this.profile = null;
            this.selectedAchievementTier = 'All';
            this.achievementSearch = '';
            this.showAllAchievements = false;
            const requestedName = String(this.$route.params.name || '');
            try {
                const [players, errors] = await (async () => {
                    const result = await fetchLeaderboard();
                    return [result?.[0] || [], result?.[1] || []];
                })();
                this.players = players;
                this.loadErrors = errors;
                const found = this.players.find(item => item.user?.toLocaleLowerCase('en') === requestedName.toLocaleLowerCase('en'));
                if (!found) {
                    this.error = 'No leaderboard entry exists for “' + requestedName + '”.';
                    return;
                }
                this.player = found;
                const response = await fetch('/api/leaderboard/avatar-frames', { cache: 'no-store', credentials: 'same-origin' });
                if (response.ok) {
                    const data = await response.json();
                    this.playerProfiles = data.profiles || [];
                    const matched = this.playerProfiles.find(item => item.leaderboard_name?.toLocaleLowerCase('en') === found.user?.toLocaleLowerCase('en'));
                    this.profile = matched || { ...PROFILE_CUSTOMIZATION_DEFAULTS, avatar_url: '/assets/profile/No%20PFP.png', frame_url: null };
                } else {
                    this.profile = { ...PROFILE_CUSTOMIZATION_DEFAULTS, avatar_url: '/assets/profile/No%20PFP.png', frame_url: null };
                }
            } catch (error) {
                this.error = error?.message || 'Could not load this player profile. Please try again.';
            } finally {
                this.loading = false;
            }
        }
    }
};
