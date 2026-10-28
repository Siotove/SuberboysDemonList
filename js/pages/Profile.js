import { PROFILE_CUSTOMIZATION_DEFAULTS, COUNTRY_OPTIONS, ACCENT_OPTIONS, BANNER_OPTIONS, THEME_OPTIONS, BORDER_OPTIONS, GAMEMODE_OPTIONS, CLAN_ROLE_OPTIONS } from '../profile-customization-options.js';
export default {
    template: `
        <main class="account-page profile-page">
            <!-- Profile header -->
            <section class="profile-hero">
                <div class="profile-avatar">
                    <img
                        class="profile-avatar-image"
                        :src="profilePictureUrl"
                        alt="Profile picture"
                        width="100"
                        height="100"
                    >

                    <img
                        v-if="equippedFrameImage"
                        class="profile-avatar-frame"
                        :src="equippedFrameImage"
                        :alt="equippedFrameName + ' equipped'"
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
                <player-goals-widget></player-goals-widget>
            </template>

 <div class="avatar-upload">
    <label for="profile-avatar-file">Custom profile picture</label>

    <input
        id="profile-avatar-file"
        type="file"
        accept="image/png,image/jpeg,image/webp"
        @change="uploadAvatar"
    />

    <p>PNG, JPEG or WebP · Maximum 2 MB</p>

    <button
        type="button"
        @click="saveAvatar"
        :disabled="!selectedAvatar || uploadingAvatar"
    >
        {{ uploadingAvatar ? "Uploading..." : "Upload picture" }}
    </button>

    <p v-if="avatarMessage">{{ avatarMessage }}</p>
</div>

            <template v-if="!loading && user">
                <!-- Expanded profile customisation -->
                <section class="profile-panel profile-customization-panel pc-customizer" :style="{ '--pc-accent': customization.accent_color }">
                    <p class="profile-eyebrow">MAKE IT YOURS</p>
                    <h2>Profile Studio</h2>
                    <p class="profile-muted">Your nationality is optional. Clan details are self-declared display information, not verified clan membership. Use the visibility switches to control what appears publicly.</p>

                    <div class="pc-preview" :class="['pc-theme-' + customization.profile_theme, 'pc-banner-' + customization.banner_style, 'pc-border-' + customization.border_style]" :style="{ '--pc-accent': customization.accent_color }">
                        <div class="pc-preview-banner"><span>SUBERBOYS DEMON LIST</span><span class="pc-preview-chip">LIVE PREVIEW</span></div>
                        <div class="pc-preview-body">
                            <div class="pc-preview-avatar"><img :src="profilePictureUrl" alt=""><img v-if="equippedFrameImage" :src="equippedFrameImage" alt="" class="pc-preview-frame"></div>
                            <div class="pc-preview-identity">
                                <p class="pc-preview-topline"><span v-if="customization.show_nationality && customization.country_code">{{ countryFlag(customization.country_code) }} {{ countryLabel(customization.country_code) }}</span><span v-if="customization.show_clan && customization.clan_name">{{ customization.clan_tag ? '[' + customization.clan_tag + '] ' : '' }}{{ customization.clan_name }}<small v-if="customization.clan_role"> · {{ customization.clan_role }}</small></span></p>
                                <h3>{{ customization.display_name || leaderboardProfile?.leaderboard_name || user?.username || 'Your display name' }}</h3>
                                <p v-if="customization.show_title && customization.profile_title" class="pc-preview-title">{{ customization.profile_title }}</p>
                                <p v-if="customization.show_tagline && customization.tagline" class="pc-preview-tagline">{{ customization.tagline }}</p>
                                <p v-if="customization.show_status && customization.status" class="pc-preview-status">● {{ customization.status }}</p>
                            </div>
                        </div>
                        <p v-if="customization.show_bio && customization.bio" class="pc-preview-bio">{{ customization.bio }}</p>
                        <div class="pc-preview-facts"><span v-if="customization.show_gamemode && customization.main_gamemode !== 'All-around'">Main: {{ customization.main_gamemode }}</span><span v-if="customization.show_favorite_level && customization.favorite_level">Favourite: {{ customization.favorite_level }}</span><span v-if="customization.show_website && customization.website_url">Website link set ↗</span></div>
                    </div>

                    <form class="pc-form" @submit.prevent="saveCustomization">
                        <div class="pc-form-heading"><h3>Identity</h3><span>Optional public details</span></div>
                        <div class="pc-form-grid">
                            <label class="pc-field"><span>Display name</span><input v-model.trim="customization.display_name" maxlength="24" placeholder="Use your leaderboard name"></label>
                            <label class="pc-field"><span>Nationality / country</span><select v-model="customization.country_code"><option v-for="country in customizationCountries" :key="country.value" :value="country.value">{{ country.value ? countryFlag(country.value) + ' ' : '' }}{{ country.label }}</option></select></label>
                            <label class="pc-field"><span>Clan / team name</span><input v-model.trim="customization.clan_name" maxlength="32" placeholder="e.g. Suberboys"></label>
                            <label class="pc-field"><span>Clan tag (8 characters max)</span><input v-model.trim="customization.clan_tag" maxlength="8" placeholder="SBDL"></label>
                            <label class="pc-field"><span>Clan role</span><select v-model="customization.clan_role"><option v-for="role in customizationClanRoles" :key="role.value" :value="role.value">{{ role.label }}</option></select></label>
                            <label class="pc-field"><span>Profile title</span><input v-model.trim="customization.profile_title" maxlength="32" placeholder="Wave grinder, verifier…"></label>
                            <label class="pc-field"><span>Tagline</span><input v-model.trim="customization.tagline" maxlength="64" placeholder="One line about your playstyle"></label>
                            <label class="pc-field"><span>Status</span><input v-model.trim="customization.status" maxlength="40" placeholder="Grinding top 20"></label>
                            <label class="pc-field"><span>Main gamemode</span><select v-model="customization.main_gamemode"><option v-for="mode in customizationGamemodes" :key="mode.value" :value="mode.value">{{ mode.label }}</option></select></label>
                            <label class="pc-field"><span>Favourite level</span><input v-model.trim="customization.favorite_level" maxlength="80" placeholder="Your favourite level"></label>
                            <label class="pc-field pc-field-full"><span>Bio</span><textarea v-model.trim="customization.bio" maxlength="240" rows="3" placeholder="Tell the community a little about your Geometry Dash journey…"></textarea><small>{{ customization.bio.length }}/240 characters</small></label>
                            <label class="pc-field pc-field-full"><span>Website or public link (HTTPS)</span><input v-model.trim="customization.website_url" type="url" maxlength="240" placeholder="https://example.com"></label>
                        </div>

                        <div class="pc-form-heading"><h3>Appearance</h3><span>Mix and match your style</span></div>
                        <div class="pc-form-grid">
                            <label class="pc-field"><span>Accent colour</span><select v-model="customization.accent_color"><option v-for="colour in customizationAccents" :key="colour.value" :value="colour.value">{{ colour.label }}</option></select></label>
                            <label class="pc-field"><span>Banner style</span><select v-model="customization.banner_style"><option v-for="banner in customizationBanners" :key="banner.value" :value="banner.value">{{ banner.label }}</option></select></label>
                            <label class="pc-field"><span>Card theme</span><select v-model="customization.profile_theme"><option v-for="theme in customizationThemes" :key="theme.value" :value="theme.value">{{ theme.label }}</option></select></label>
                            <label class="pc-field"><span>Card border</span><select v-model="customization.border_style"><option v-for="border in customizationBorders" :key="border.value" :value="border.value">{{ border.label }}</option></select></label>
                        </div>

                        <div class="pc-form-heading"><h3>Privacy and visibility</h3><span>Change what other players can see</span></div>
                        <div class="pc-visibility-grid">
                            <label><input type="checkbox" v-model="customization.show_nationality"><span>Show nationality</span></label>
                            <label><input type="checkbox" v-model="customization.show_clan"><span>Show clan</span></label>
                            <label><input type="checkbox" v-model="customization.show_title"><span>Show title</span></label>
                            <label><input type="checkbox" v-model="customization.show_tagline"><span>Show tagline</span></label>
                            <label><input type="checkbox" v-model="customization.show_status"><span>Show status</span></label>
                            <label><input type="checkbox" v-model="customization.show_bio"><span>Show bio</span></label>
                            <label><input type="checkbox" v-model="customization.show_gamemode"><span>Show main gamemode</span></label>
                            <label><input type="checkbox" v-model="customization.show_favorite_level"><span>Show favourite level</span></label>
                            <label><input type="checkbox" v-model="customization.show_website"><span>Show public link</span></label>
                        </div>
                        <div class="pc-save-row"><p v-if="customizationMessage" role="status" class="profile-message">{{ customizationMessage }}</p><div><button type="button" class="profile-secondary-button" @click="resetCustomization" :disabled="customizationSaving">Reset defaults</button><button type="submit" class="profile-primary-button" :disabled="customizationSaving || customizationLoading">{{ customizationSaving ? 'Saving…' : 'Save profile style' }}</button></div></div>
                    </form>
                </section>
                <!-- Leaderboard identity -->
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
                <section class="profile-panel profile-customization-panel">
                    <p class="profile-eyebrow">CUSTOMIZATION</p>
                    <h2>Avatar Frames</h2>

                    <p class="profile-muted">
                        Browse the available frames and preview them on your
                        profile picture. Requirements are shown for each frame.
                    </p>

                    <div class="profile-frame-current">
                        <p class="profile-muted">
                            Currently selected:
                            <strong>
                                {{ equippedFrameName || 'No frame' }}
                            </strong>
                        </p>

                        <button
                            v-if="equippedFrame"
                            type="button"
                            class="profile-secondary-button"
                            @click="unequipFrame"
                        >
                            Remove Frame
                        </button>
                    </div>

                    <div class="profile-frames-grid">
                        <article
                            v-for="frame in availableFrames"
                            :key="frame.id"
                            class="profile-frame-item"
                            :class="{
                                'profile-frame-selected':
                                    equippedFrame === frame.id
                            }"
                        >
                            <div class="profile-frame-preview-wrap">
                                <img
                                    class="profile-frame-preview"
                                    :src="frame.image"
                                    :alt="frame.name + ' preview'"
                                    width="100"
                                    height="100"
                                    loading="lazy"
                                >
                            </div>

                            <div class="profile-frame-info">
                                <h3>{{ frame.name }}</h3>

                                <p>{{ frame.requirement }}</p>

                                <button
    type="button"
    class="profile-primary-button"
    :disabled="
        frame.saving ||
        !frame.unlocked ||
        equippedFrame === frame.id
    "
    @click="equipFrame(frame)"
>
    {{
        frame.saving
            ? 'Saving...'
            : !frame.unlocked
                ? 'Locked'
                : equippedFrame === frame.id
                    ? 'Equipped'
                    : 'Equip Frame'
    }}
</button>
                            </div>
                        </article>
                    </div>

                    <p
                        v-if="frameMessage"
                        role="status"
                        class="profile-message"
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
                        <label for="compare-player">
                            Compare against
                        </label>

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
            profilePictureUrl: "/assets/profile/No%20PFP.png",

            compareIdentities: [],
            compareOpponent: '',
            compareLoading: false,
            compareMessage: '',
            comparison: null,

            equippedFrame: null,
            frameMessage: '',
selectedAvatar: null,
uploadingAvatar: false,
avatarMessage: "",
            customization: { ...PROFILE_CUSTOMIZATION_DEFAULTS },
            customizationLoading: false,
            customizationSaving: false,
            customizationMessage: '',
            customizationCountries: COUNTRY_OPTIONS,
            customizationAccents: ACCENT_OPTIONS,
            customizationBanners: BANNER_OPTIONS,
            customizationThemes: THEME_OPTIONS,
            customizationBorders: BORDER_OPTIONS,
            customizationGamemodes: GAMEMODE_OPTIONS,
            customizationClanRoles: CLAN_ROLE_OPTIONS,
            availableFrames: [
                {
                    id: 'angy',
                    name: 'Angy',
                    image: '/assets/profile/Angy.png',
                    requirement: 'Available by default.'
                },
                {
                    id: 'appi',
                    name: 'Appi',
                    image: '/assets/profile/Appi.png',
                    requirement: 'Available by default.'
                },
                {
                    id: 'borgir',
                    name: 'Borgir',
                    image: '/assets/profile/Borgir.png',
                    requirement: 'Beat Ice Carbon Zustgame.'
                },
                {
                    id: 'bronze',
                    name: 'Bronze',
                    image: '/assets/profile/Bronze.png',
                    requirement: 'Earn any Bronze achievement.'
                },
                {
                    id: 'cool',
                    name: 'Cool',
                    image: '/assets/profile/Cool.png',
                    requirement: 'Beat NG Wave Reborn 3.'
                },
                {
                    id: 'diamond',
                    name: 'Diamond',
                    image: '/assets/profile/Diamond.png',
                    requirement: 'Earn any Diamond achievement.'
                },
                {
                    id: 'fire',
                    name: 'Fire Frame',
                    image: '/assets/profile/Fire%20Frame.png',
                    requirement: 'Earn the "I Got This" achievement.'
                },
                {
                    id: 'furter',
                    name: 'Furter',
                    image: '/assets/profile/Furter.png',
                    requirement: 'Beat the Halloween pack.'
                },
                {
                    id: 'gold',
                    name: 'Gold',
                    image: '/assets/profile/Gold.png',
                    requirement: 'Earn any Gold achievement.'
                },
                {
                    id: 'hidrog',
                    name: 'Hidrog',
                    image: '/assets/profile/Hidrog.png',
                    requirement: 'Available by default.'
                },
                {
                    id: 'honeycomb',
                    name: 'Honeycomb',
                    image: '/assets/profile/Honeycomb.png',
                    requirement: 'Beat Casher.'
                },
                {
                    id: 'legendary',
                    name: 'Legendary',
                    image: '/assets/profile/Legendary.png',
                    requirement: 'Earn any Legendary achievement.'
                },
                {
                    id: 'platinum',
                    name: 'Platinum',
                    image: '/assets/profile/Platinum.png',
                    requirement: 'Earn any Platinum achievement.'
                },
                {
                    id: 'polish',
                    name: 'Polish',
                    image: '/assets/profile/Polish.png',
                    requirement: 'Available by default.'
                },
                {
                    id: 'punpkin',
                    name: 'Punpkin',
                    image: '/assets/profile/Punpkin.png',
                    requirement: 'Beat Halloween Panic.'
                },
                {
                    id: 'ssjjasaiah',
                    name: 'SSJJasaiah',
                    image: '/assets/profile/SSJJasaiah.png',
                    requirement: 'Beat Society but No 3.'
                },
                {
                    id: 'silver',
                    name: 'Silver',
                    image: '/assets/profile/Silver.png',
                    requirement: 'Earn any Silver achievement.'
                },
                {
                    id: 'victory',
                    name: 'Victory',
                    image: '/assets/profile/Victory.png',
                    requirement: 'Currently be #1 on the leaderboard.'
                },
                {
                    id: 'wjat',
                    name: 'Wjat',
                    image: '/assets/profile/Wjat.png',
                    requirement: 'Beat Acheron Easy.'
                    
                },
                {
                    id: 'gartyen',
                    name: 'Gartyen',
                    image: '/assets/profile/gartyen.png',
                    requirement: 'Beat Milestone II.'
                }
            ]
        };
    },

    computed: {
        equippedFrameImage() {
            const frame = this.availableFrames.find(
                item => item.id === this.equippedFrame
            );

            return frame ? frame.image : null;
        },

        equippedFrameName() {
            const frame = this.availableFrames.find(
                item => item.id === this.equippedFrame
            );

            return frame ? frame.name : '';
        }
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
                await this.loadCustomization();
                await this.loadLeaderboardProfile();
                await this.loadAvatarFrames();

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
        countryFlag(code) {
            const value = String(code || '').toUpperCase();
            if (!/^[A-Z]{2}$/.test(value)) return '';
            return String.fromCodePoint(...[...value].map(char => 127397 + char.charCodeAt(0)));
        },
        countryLabel(code) {
            const country = this.customizationCountries.find(item => item.value === String(code || '').toUpperCase());
            return country ? country.label : '';
        },
        async loadCustomization() {
            this.customizationLoading = true;
            this.customizationMessage = '';
            try {
                const response = await fetch('/api/profile/customization', { credentials: 'same-origin', cache: 'no-store' });
                const result = await response.json();
                if (!response.ok) throw new Error(result.error || 'Could not load profile settings.');
                this.customization = { ...PROFILE_CUSTOMIZATION_DEFAULTS, ...(result.customization || {}) };
            } catch (error) {
                this.customizationMessage = error.message || 'Could not load profile settings.';
            } finally {
                this.customizationLoading = false;
            }
        },
        async saveCustomization() {
            if (this.customizationSaving) return;
            this.customizationSaving = true;
            this.customizationMessage = '';
            try {
                const response = await fetch('/api/profile/customization', {
                    method: 'POST',
                    credentials: 'same-origin',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(this.customization)
                });
                const result = await response.json();
                if (!response.ok) throw new Error(result.error || 'Could not save profile settings.');
                this.customization = { ...PROFILE_CUSTOMIZATION_DEFAULTS, ...(result.customization || {}) };
                this.customizationMessage = 'Profile customisation saved! Your public profile and leaderboard details will use these settings.';
            } catch (error) {
                this.customizationMessage = error.message || 'Could not save profile settings.';
            } finally {
                this.customizationSaving = false;
            }
        },
        async resetCustomization() {
            this.customization = { ...PROFILE_CUSTOMIZATION_DEFAULTS };
            await this.saveCustomization();
        },

        async equipFrame(frame) {
    if (!frame.unlocked || frame.saving) return;

    frame.saving = true;
    this.frameMessage = '';

    try {
        const response = await fetch('/api/profile/frames', {
            method: 'POST',
            credentials: 'same-origin',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                frameId: frame.id
            })
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(
                result.error || 'Could not equip this frame.'
            );
        }

        this.equippedFrame = result.equippedFrame;
        this.frameMessage = `${frame.name} equipped successfully!`;
    } catch (error) {
        this.frameMessage =
            error.message || 'Could not save your frame. Please try again.';
    } finally {
        frame.saving = false;
    }
},
        
uploadAvatar(event) {
    const file = event.target.files?.[0];

    this.avatarMessage = "";
    this.selectedAvatar = null;

    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
        this.avatarMessage = "Image must be 2 MB or smaller.";
        event.target.value = "";
        return;
    }

    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
        this.avatarMessage = "Choose a PNG, JPEG, or WebP image.";
        event.target.value = "";
        return;
    }

    this.selectedAvatar = file;
},

async saveAvatar() {
    if (!this.selectedAvatar || this.uploadingAvatar) return;

    this.uploadingAvatar = true;
    this.avatarMessage = "";

    try {
        const form = new FormData();
        form.append("image", this.selectedAvatar);

        const response = await fetch("/api/profile/avatar", {
            method: "POST",
            credentials: "same-origin",
            body: form
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || "Upload failed.");
        }

        this.avatarMessage = "Profile picture updated!";
        this.selectedAvatar = null;

        // Reload the profile image here using data.avatarUrl.
        // If your profile uses a different image variable, update that variable.
        this.profilePictureUrl = data.avatarUrl;
    } catch (error) {
        this.avatarMessage = error.message || "Could not upload image.";
    } finally {
        this.uploadingAvatar = false;
    }
},

async loadAvatarFrames() {
    try {
        const response = await fetch('/api/profile/frames', {
            credentials: 'same-origin',
            cache: 'no-store'
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(
                result.error || 'Could not load avatar frames.'
            );
        }

        this.equippedFrame = result.equippedFrame || null;

        const serverFrames = new Map(
            (result.frames || []).map(frame => [frame.id, frame])
        );

        this.availableFrames = this.availableFrames.map(frame => {
            const serverFrame = serverFrames.get(frame.id);

            return {
                ...frame,
                unlocked: serverFrame
                    ? Boolean(serverFrame.unlocked)
                    : false,
                saving: false
            };
        });
    } catch (error) {
        this.frameMessage =
            error.message || 'Could not load your saved frame.';
    }
},
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
