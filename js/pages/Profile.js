
export default {
    template: `
        <main class="account-page profile-page">
            <section class="profile-hero">
                <div class="profile-avatar">
    <img
        class="profile-avatar-image"
        src="/assets/profile/No%20PFP.png"
        alt="Profile picture"
        width="100"
        height="100"
    >

    <img
        v-if="equippedFrame === 'fire'"
        class="profile-avatar-frame"
        src="/assets/profile/Fire%20Frame.png"
        alt=""
        width="100"
        height="100"
    >
</div>

<p class="profile-eyebrow">SUBERBOYS DEMON LIST</p>
                <h1>Player Profile</h1>

                <p v-if="loading" class="profile-muted">
                    Loading your account...
                </p>

                <template v-else-if="user">
                    <h2 class="profile-username">{{ user.username }}</h2>
                    <p class="profile-muted">
                        Member of the Demon List community
                    </p>

                    <div class="profile-actions">
                        <router-link
                            class="profile-primary-button"
                            to="/submit"
                        >
                            Submit a Record
                        </router-link>

                        <router-link
                            class="profile-secondary-button"
                            to="/leaderboard"
                        >
                            View Leaderboard
                        </router-link>
                    </div>
                </template>

                <template v-else>
                    <p class="profile-muted">
                        {{ message || 'Log in to view your player profile.' }}
                    </p>

                    <div class="profile-actions">
                        <router-link
                            class="profile-primary-button"
                            to="/login"
                        >
                            Log In
                        </router-link>

                        <router-link
                            class="profile-secondary-button"
                            to="/register"
                        >
                            Create Account
                        </router-link>
                    </div>
                </template>
            </section>

            <template v-if="!loading && user">
                <section class="profile-panel">
                    <div class="profile-panel-heading">
                        <div>
                            <p class="profile-eyebrow">YOUR ACCOUNT</p>
                            <h2>Leaderboard Identity</h2>
                        </div>

                        <span
                            class="profile-status"
                            :class="leaderboardProfile
                                ? 'profile-status-linked'
                                : 'profile-status-unlinked'"
                        >
                            {{ leaderboardProfile ? 'Linked' : 'Not linked' }}
                        </span>
                    </div>

                    <p v-if="leaderboardLoading" class="profile-muted">
                        Loading leaderboard identity...
                    </p>

                    <div
                        v-else-if="leaderboardProfile"
                        class="profile-identity"
                    >
                        <div class="profile-identity-icon" aria-hidden="true">
                            {{
                                leaderboardProfile.leaderboard_name
                                    .charAt(0).toUpperCase()
                            }}
                        </div>

                        <div>
                            <p class="profile-muted">
                                Your public leaderboard name
                            </p>
                            <h3>{{ leaderboardProfile.leaderboard_name }}</h3>
                        </div>
                    </div>

                    <div v-else class="profile-link-form">
                        <p>
                            Link your leaderboard name to submit records
                            under your public player identity.
                        </p>

                        <form @submit.prevent="joinLeaderboard">
                            <label for="leaderboard-name">
                                Leaderboard name
                            </label>

                            <input
                                id="leaderboard-name"
                                v-model.trim="leaderboardName"
                                type="text"
                                minlength="1"
                                maxlength="24"
                                autocomplete="off"
                                placeholder="Enter your leaderboard name"
                                required
                                :disabled="joining"
                            >

                            <button
                                type="submit"
                                class="profile-primary-button"
                                :disabled="joining || !leaderboardName"
                            >
                                {{
                                    joining
                                        ? 'Linking...'
                                        : 'Link Leaderboard Identity'
                                }}
                            </button>
                        </form>
                    </div>

                    <p
                        v-if="leaderboardMessage"
                        role="status"
                        class="profile-message"
                    >
                        {{ leaderboardMessage }}
                    </p>
                </section>

                <!-- Avatar frames -->
                <section class="profile-panel">
                    <p class="profile-eyebrow">CUSTOMIZATION</p>
                    <h2>Avatar Frames</h2>

                    <p class="profile-muted">
                        Earn achievements to unlock frames for your profile.
                    </p>

                    <div class="profile-frame-item">
                        <img
                            class="profile-frame-preview"
                            src="/assets/profile/Fire%20Frame.png"
                            alt="Fire Frame preview"
                            width="100"
                            height="100"
                        >

                        <div class="profile-frame-info">
                            <h3>Fire Frame</h3>

                            <p>
                                Unlock by earning the “I Got This” achievement.
                            </p>

                            <p
                                v-if="!hasFireFrame"
                                class="profile-muted"
                            >
                                Locked — earn “I Got This” to unlock this frame.
                            </p>

                            <button
                                v-else
                                type="button"
                                class="profile-primary-button"
                                @click="toggleFireFrame"
                            >
                                {{
                                    equippedFrame === 'fire'
                                        ? 'Unequip Frame'
                                        : 'Equip Frame'
                                }}
                            </button>
                        </div>
                    </div>

                    <p
                        v-if="frameMessage"
                        class="profile-message"
                        role="status"
                    >
                        {{ frameMessage }}
                    </p>
                </section>

                <!-- Player comparison -->
                <section
                    v-if="leaderboardProfile"
                    class="profile-panel"
                >
                    <p class="profile-eyebrow">PLAYER STATS</p>
                    <h2>Compare Completions</h2>

                    <p class="profile-muted">
                        Compare accepted list completions with another player.
                    </p>

                    <form @submit.prevent="comparePlayer">
                        <label for="compare-player">Compare against</label>

                        <select
                            id="compare-player"
                            v-model="compareOpponent"
                            required
                            :disabled="compareLoading"
                        >
                            <option value="" disabled>
                                Select a player
                            </option>

                            <option
                                v-for="identity in compareIdentities"
                                :key="identity"
                                :value="identity"
                            >
                                {{ identity }}
                            </option>
                        </select>

                        <button
                            type="submit"
                            class="profile-primary-button"
                            :disabled="compareLoading || !compareOpponent"
                        >
                            {{
                                compareLoading
                                    ? 'Comparing...'
                                    : 'Compare Players'
                            }}
                        </button>
                    </form>

                    <p
                        v-if="compareMessage"
                        role="status"
                        class="profile-message"
                    >
                        {{ compareMessage }}
                    </p>

                    <template v-if="comparison">
                        <div class="profile-comparison-stats">
                            <div>
                                <p class="profile-muted">
                                    {{ comparison.ownName }}
                                </p>
                                <h3>{{ comparison.ownCount }}</h3>
                                <p>Accepted completions</p>

                                <p v-if="comparison.ownHardest">
                                    Hardest: #{{ comparison.ownHardest.rank }}
                                    — {{ comparison.ownHardest.name }}
                                </p>
                            </div>

                            <div>
                                <p class="profile-muted">
                                    {{ comparison.opponentName }}
                                </p>
                                <h3>{{ comparison.opponentCount }}</h3>
                                <p>Accepted completions</p>

                                <p v-if="comparison.opponentHardest">
                                    Hardest: #{{ comparison.opponentHardest.rank }}
                                    — {{ comparison.opponentHardest.name }}
                                </p>
                            </div>
                        </div>

                        <h3>
                            Shared completions ({{ comparison.shared.length }})
                        </h3>
                        <ul>
                            <li
                                v-for="level in comparison.shared"
                                :key="level.file"
                            >
                                #{{ level.rank }} — {{ level.name }}
                            </li>
                        </ul>

                        <h3>
                            Your unique completions
                            ({{ comparison.ownUnique.length }})
                        </h3>
                        <ul>
                            <li
                                v-for="level in comparison.ownUnique"
                                :key="level.file"
                            >
                                #{{ level.rank }} — {{ level.name }}
                            </li>
                        </ul>

                        <h3>
                            {{ comparison.opponentName }}'s unique completions
                            ({{ comparison.opponentUnique.length }})
                        </h3>
                        <ul>
                            <li
                                v-for="level in comparison.opponentUnique"
                                :key="level.file"
                            >
                                #{{ level.rank }} — {{ level.name }}
                            </li>
                        </ul>
                    </template>
                </section>

                <!-- Quick access -->
                <section class="profile-panel">
                    <p class="profile-eyebrow">QUICK ACCESS</p>
                    <h2>What do you want to do?</h2>

                    <div class="profile-quick-links">
                        <router-link
                            to="/submit"
                            class="profile-quick-link"
                        >
                            <span class="profile-quick-icon">＋</span>
                            <span>
                                <strong>Submit a Record</strong>
                                <small>
                                    Send a completion or verification for review
                                </small>
                            </span>
                            <span aria-hidden="true">→</span>
                        </router-link>

                        <router-link
                            to="/leaderboard"
                            class="profile-quick-link"
                        >
                            <span class="profile-quick-icon">★</span>
                            <span>
                                <strong>Leaderboard</strong>
                                <small>
                                    Explore players and leaderboard rankings
                                </small>
                            </span>
                            <span aria-hidden="true">→</span>
                        </router-link>
                    </div>
                </section>

                <!-- Account -->
                <section class="profile-panel profile-account-panel">
                    <div>
                        <h2>Account</h2>
                        <p class="profile-muted">
                            Logged in as {{ user.username }}
                        </p>
                    </div>

                    <button
                        type="button"
                        class="profile-logout-button"
                        @click="logout"
                        :disabled="loggingOut"
                    >
                        {{ loggingOut ? 'Logging out...' : 'Log Out' }}
                    </button>
                </section>
            </template>

            <p
                v-if="message && user"
                role="status"
                class="profile-message"
            >
                {{ message }}
            </p>
        </main>
    `,

    data() {
        return {
            user: null,
            loading: true,
            loggingOut: false,
            message: '',

            leaderboardProfile: null,
            leaderboardName: '',
            leaderboardLoading: true,
            joining: false,
            leaderboardMessage: '',

            compareIdentities: [],
            compareOpponent: '',
            compareLoading: false,
            compareMessage: '',
            comparison: null,

            // Temporary frame state; connect this to the API next.
            hasFireFrame: false,
            equippedFrame: null,
            frameMessage: ''
        };
    },

    async mounted() {
        try {
            const response = await fetch('/api/auth/me', {
                credentials: 'same-origin',
                cache: 'no-store'
            });

            if (!response.ok) {
                throw new Error('Profile request failed');
            }

            const result = await response.json();
            this.user = result.user;

            if (this.user) {
                await this.loadLeaderboardProfile();

                if (this.leaderboardProfile) {
                    await this.loadComparisonIdentities();
                }
            }
        } catch {
            this.message =
                'Could not load your profile. Please try again.';
        } finally {
            this.loading = false;
        }
    },

    methods: {
        async loadComparisonIdentities() {
            try {
                const response = await fetch(
                    '/api/leaderboard/identities',
                    {
                        credentials: 'same-origin',
                        cache: 'no-store'
                    }
                );

                const result = await response.json();

                if (!response.ok) {
                    throw new Error(
                        result.error ||
                        'Could not load player identities.'
                    );
                }

                const ownName = (
                    this.leaderboardProfile?.leaderboard_name || ''
                ).toLocaleLowerCase('en');

                this.compareIdentities = (result.identities || [])
                    .filter(name =>
                        name.toLocaleLowerCase('en') !== ownName
                    );
            } catch {
                this.compareMessage =
                    'Could not load players for comparison. Please refresh.';
            }
        },

        async comparePlayer() {
            if (!this.compareOpponent) return;

            this.compareLoading = true;
            this.compareMessage = '';
            this.comparison = null;

            try {
                const response = await fetch(
                    '/api/leaderboard/compare?opponent=' +
                    encodeURIComponent(this.compareOpponent),
                    {
                        credentials: 'same-origin',
                        cache: 'no-store'
                    }
                );

                const result = await response.json();

                if (!response.ok) {
                    throw new Error(
                        result.error || 'Could not compare players.'
                    );
                }

                this.comparison = result;
            } catch (error) {
                this.compareMessage =
                    error.message ||
                    'Comparison failed. Please try again.';
            } finally {
                this.compareLoading = false;
            }
        },

        async loadLeaderboardProfile() {
            this.leaderboardLoading = true;

            try {
                const response = await fetch(
                    '/api/leaderboard/profile',
                    {
                        credentials: 'same-origin',
                        cache: 'no-store'
                    }
                );

                if (!response.ok) {
                    throw new Error(
                        'Leaderboard profile request failed'
                    );
                }

                const result = await response.json();
                this.leaderboardProfile = result.profile || null;
            } catch {
                this.leaderboardMessage =
                    'Could not load your leaderboard identity. Please try again.';
            } finally {
                this.leaderboardLoading = false;
            }
        },

        async joinLeaderboard() {
            this.joining = true;
            this.leaderboardMessage = '';

            try {
                const response = await fetch(
                    '/api/leaderboard/join',
                    {
                        method: 'POST',
                        credentials: 'same-origin',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            leaderboardName: this.leaderboardName
                        })
                    }
                );

                const result = await response.json();

                if (!response.ok) {
                    this.leaderboardMessage =
                        result.error ||
                        'Could not link your leaderboard identity.';
                    return;
                }

                this.leaderboardProfile = result.profile;
                this.leaderboardName = '';
                this.leaderboardMessage =
                    'Leaderboard identity linked successfully!';

                await this.loadComparisonIdentities();
            } catch {
                this.leaderboardMessage =
                    'Connection failed. Please try again.';
            } finally {
                this.joining = false;
            }
        },

        toggleFireFrame() {
            if (!this.hasFireFrame) {
                this.frameMessage =
                    'Earn the “I Got This” achievement to unlock this frame.';
                return;
            }

            this.equippedFrame =
                this.equippedFrame === 'fire' ? null : 'fire';

            this.frameMessage = this.equippedFrame === 'fire'
                ? 'Fire Frame equipped.'
                : 'Fire Frame unequipped.';
        },

        async logout() {
            this.loggingOut = true;
            this.message = '';

            try {
                const response = await fetch('/api/auth/logout', {
                    method: 'POST',
                    credentials: 'same-origin'
                });

                if (!response.ok) {
                    this.message = 'Logout failed. Please try again.';
                    return;
                }

                this.user = null;
                await this.$router.push('/login');
            } catch {
                this.message = 'Could not connect. Please try again.';
            } finally {
                this.loggingOut = false;
            }
        }
    }
};
