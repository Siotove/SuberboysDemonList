
import { fetchList } from '../content.js';

export default {
    template: `
        <main class="account-page">
            <section class="account-card submit-card">
                <h1>Submit a Record</h1>
                <p>
                    Submit completions, verifications, and progressions
                    for review by the Suberboys Demon List team.
                </p>

                <p v-if="loading">Checking your account...</p>

                <div v-else-if="!user">
                    <p>You need to log in to submit records.</p>
                    <router-link to="/login">Log in</router-link>
                    <span> · </span>
                    <router-link to="/register">Create an account</router-link>
                </div>

                <div v-else-if="!profile">
                    <p>
                        Link a leaderboard identity before submitting records.
                    </p>
                    <router-link to="/profile">Go to your profile</router-link>
                </div>

                <div v-else>
                    <p>
                        Submitting as:
                        <strong>{{ profile.leaderboard_name }}</strong>
                    </p>

                    <hr>

                    <label for="record-type">Record type</label>
                    <select id="record-type" v-model="type">
                        <option value="completion">Completion</option>
                        <option value="verification">Verification</option>
                        <option value="progression">Progression</option>
                    </select>

                    <form @submit.prevent="submitRecord">
                        <template v-if="type === 'completion'">
                            <h2>Completion record</h2>

                            <label for="completion-level">Level</label>
                            <select
                                id="completion-level"
                                v-model="completion.levelFile"
                                required
                            >
                                <option value="" disabled>Select a level</option>
                                <option
                                    v-for="level in levels"
                                    :key="level.path"
                                    :value="level.path"
                                >
                                    {{ level.name }}
                                </option>
                            </select>

                            <label for="completion-link">Proof URL</label>
                            <input
                                id="completion-link"
                                v-model.trim="completion.link"
                                type="url"
                                placeholder="https://..."
                                required
                            >

                            <label for="completion-percent">Percentage</label>
                            <input
                                id="completion-percent"
                                v-model.number="completion.percent"
                                type="number"
                                min="1"
                                max="100"
                                required
                            >

                            <label for="completion-hz">Refresh rate (Hz)</label>
                            <input
                                id="completion-hz"
                                v-model.number="completion.hz"
                                type="number"
                                min="1"
                                max="1000"
                                required
                            >
                        </template>

                        <template v-else-if="type === 'verification'">
                            <h2>Level verification</h2>

                            <label for="verify-name">Level name</label>
                            <input
                                id="verify-name"
                                v-model.trim="verification.name"
                                maxlength="100"
                                required
                            >

                            <label for="verify-author">Level author</label>
                            <input
                                id="verify-author"
                                v-model.trim="verification.author"
                                maxlength="100"
                                required
                            >

                            <label for="verify-creators">
                                Creators (comma-separated)
                            </label>
                            <input
                                id="verify-creators"
                                v-model.trim="verification.creators"
                                placeholder="Creator1, Creator2"
                                required
                            >

                            <label for="verify-id">Level ID</label>
                            <input
                                id="verify-id"
                                v-model.trim="verification.id"
                                maxlength="100"
                                required
                            >

                            <label for="verify-file">Level filename</label>
                            <input
                                id="verify-file"
                                v-model.trim="verification.fileName"
                                placeholder="MyLevel"
                                maxlength="100"
                                required
                            >

                            <label for="verify-proof">Verification proof URL</label>
                            <input
                                id="verify-proof"
                                v-model.trim="verification.verification"
                                type="url"
                                placeholder="https://..."
                                required
                            >

                            <label for="verify-percent">
                                Percentage required to qualify
                            </label>
                            <input
                                id="verify-percent"
                                v-model.number="verification.percentToQualify"
                                type="number"
                                min="1"
                                max="100"
                                required
                            >

                            <label for="verify-password">Level password</label>
                            <input
                                id="verify-password"
                                v-model.trim="verification.password"
                                maxlength="100"
                                required
                            >

                            <label for="verify-position">Proposed list position</label>
                            <input
                                id="verify-position"
                                v-model.number="verification.position"
                                type="number"
                                min="1"
                                :max="levels.length + 1"
                                required
                            >
                        </template>

                        <template v-else>
                            <h2>Progression record</h2>

                            <p>
                                Submit your progress on an existing level.
                                Progression support is being connected to
                                the review backend, so this form isn't
                                available for submission yet.
                            </p>

                            <label for="progress-level">Level</label>
                            <select
                                id="progress-level"
                                v-model="progression.levelFile"
                            >
                                <option value="" disabled>Select a level</option>
                                <option
                                    v-for="level in levels"
                                    :key="level.path"
                                    :value="level.path"
                                >
                                    {{ level.name }}
                                </option>
                            </select>

                            <label for="progress-percent">Best progress (%)</label>
                            <input
                                id="progress-percent"
                                v-model.number="progression.percent"
                                type="number"
                                min="1"
                                max="99"
                            >

                            <label for="progress-link">Proof URL</label>
                            <input
                                id="progress-link"
                                v-model.trim="progression.link"
                                type="url"
                                placeholder="https://..."
                            >
                        </template>

                        <button
                            v-if="type !== 'progression'"
                            type="submit"
                            :disabled="sending"
                        >
                            {{ sending ? 'Submitting...' : 'Submit for review' }}
                        </button>
                    </form>

                    <p v-if="message" role="status">{{ message }}</p>

                    <hr>

                    <h2>My submissions</h2>

                    <button
                        type="button"
                        @click="loadSubmissions"
                        :disabled="historyLoading"
                    >
                        {{ historyLoading ? 'Refreshing...' : 'Refresh history' }}
                    </button>

                    <p v-if="historyLoading">Loading submissions...</p>

                    <p v-else-if="submissions.length === 0">
                        You haven't submitted any records yet.
                    </p>

                    <article
                        v-for="item in submissions"
                        :key="item.id"
                        class="submission-item"
                    >
                        <h3>{{ item.type }}</h3>
                        <p>Status: <strong>{{ item.status }}</strong></p>
                        <p>Submitted: {{ item.created_at }}</p>
                        <p v-if="item.error_message">
                            {{ item.error_message }}
                        </p>
                    </article>
                </div>
            </section>
        </main>
    `,

    data() {
        return {
            loading: true,
            user: null,
            profile: null,
            levels: [],
            type: 'completion',
            sending: false,
            message: '',
            historyLoading: false,
            submissions: [],
            completion: {
                levelFile: '',
                link: '',
                percent: 100,
                hz: 360
            },
            verification: {
                name: '',
                fileName: '',
                id: '',
                author: '',
                creators: '',
                verification: '',
                percentToQualify: 100,
                password: 'Not Copyable',
                position: 1
            },
            progression: {
                levelFile: '',
                link: '',
                percent: 50
            }
        };
    },

    async mounted() {
        try {
            const [authResponse, profileResponse, list] = await Promise.all([
                fetch('/api/auth/me', {
                    credentials: 'same-origin',
                    cache: 'no-store'
                }),
                fetch('/api/leaderboard/profile', {
                    credentials: 'same-origin',
                    cache: 'no-store'
                }),
                fetchList()
            ]);

            if (!authResponse.ok || !profileResponse.ok || !list) {
                throw new Error('Could not load submission page data.');
            }

            const auth = await authResponse.json();
            const profile = await profileResponse.json();

            this.user = auth.user || null;
            this.profile = profile.profile || null;

            this.levels = list
                .filter(([level]) => level)
                .map(([level]) => level)
                .filter(level => level.path && level.name);

            this.verification.position = this.levels.length + 1;

            if (this.user && this.profile) {
                await this.loadSubmissions();
            }
        } catch (error) {
            console.error('Could not initialize submissions:', error);
            this.message = 'Could not load the page. Please refresh and try again.';
        } finally {
            this.loading = false;
        }
    },

    methods: {
        async loadSubmissions() {
            this.historyLoading = true;

            try {
                const response = await fetch('/api/submissions/mine', {
                    credentials: 'same-origin',
                    cache: 'no-store'
                });

                const result = await response.json();

                if (!response.ok) {
                    throw new Error(result.error || 'Could not load submissions.');
                }

                this.submissions = result.submissions || [];
            } catch {
                this.message = 'Could not load submission history.';
            } finally {
                this.historyLoading = false;
            }
        },

        async submitRecord() {
            this.sending = true;
            this.message = '';

            let payload;

            if (this.type === 'completion') {
                payload = { ...this.completion };
            } else if (this.type === 'verification') {
                payload = {
                    ...this.verification,
                    creators: this.verification.creators
                        .split(',')
                        .map(name => name.trim())
                        .filter(Boolean)
                };
            } else {
                return;
            }

            try {
                const response = await fetch('/api/submissions', {
                    method: 'POST',
                    credentials: 'same-origin',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        type: this.type,
                        payload
                    })
                });

                const result = await response.json();

                if (!response.ok) {
                    throw new Error(result.error || 'Submission failed.');
                }

                this.message = 'Record submitted for review!';
                await this.loadSubmissions();
            } catch (error) {
                this.message = error.message || 'Could not submit the record.';
            } finally {
                this.sending = false;
            }
        }
    }
};

