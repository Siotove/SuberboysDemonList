
import { fetchList } from '../content.js';
import {
    getThumbnailFromId,
    getYoutubeIdFromUrl,
    shuffle,
} from '../util.js';

import Spinner from '../components/Spinner.js';
import Btn from '../components/Btn.js';

const SAVE_KEY = 'games.higher-lower.save.v1';

function readSave() {
    try {
        return JSON.parse(localStorage.getItem(SAVE_KEY));
    } catch {
        return null;
    }
}

export default {
    components: { Spinner, Btn },

    template: `
        <main v-if="loading" class="page-higher-lower">
            <Spinner></Spinner>
        </main>

        <main v-else class="page-higher-lower">
            <header class="hl-header">
                <h1>Higher or Lower</h1>
                <p>
                    Which demon is harder? Choose the demon with the
                    lower list number.
                </p>
            </header>

            <section v-if="!hasStarted" class="hl-settings">
                <h2>Game settings</h2>

                <div class="check">
                    <input id="hl-main" type="checkbox"
                        v-model="settings.useMainList">
                    <label for="hl-main">Main List (top 75)</label>
                </div>

                <div class="check">
                    <input id="hl-extended" type="checkbox"
                        v-model="settings.useExtendedList">
                    <label for="hl-extended">Extended List (76–150)</label>
                </div>

                <p class="hl-muted">
                    A lower number means a harder demon. Each correct
                    answer adds one point to your streak.
                </p>

                <Btn @click.native.prevent="startGame">
                    Start Game
                </Btn>

                <Btn
                    v-if="hasSavedRun"
                    @click.native.prevent="resumeGame"
                >
                    Resume Saved Game
                </Btn>
            </section>

            <template v-else>
                <section class="hl-scoreboard">
                    <div>
                        <span>Current streak</span>
                        <strong>{{ score }}</strong>
                    </div>
                    <div>
                        <span>Best streak</span>
                        <strong>{{ bestScore }}</strong>
                    </div>
                </section>

                <section v-if="!gameOver" class="hl-matchup">
                    <p class="hl-instruction">
                        Which demon is harder?
                    </p>

                    <div class="hl-cards">
                        <button
                            class="hl-card"
                            :disabled="answering"
                            @click="chooseLevel(leftLevel)"
                        >
                            <img
                                :src="thumbnail(leftLevel)"
                                :alt="leftLevel.name"
                            >
                            <span class="hl-rank">#{{ leftLevel.rank }}</span>
                            <strong>{{ leftLevel.name }}</strong>
                            <span class="hl-choice">Choose this demon</span>
                        </button>

                        <div class="hl-versus">OR</div>

                        <button
                            class="hl-card"
                            :disabled="answering"
                            @click="chooseLevel(rightLevel)"
                        >
                            <img
                                :src="thumbnail(rightLevel)"
                                :alt="rightLevel.name"
                            >
                            <span class="hl-rank">#{{ rightLevel.rank }}</span>
                            <strong>{{ rightLevel.name }}</strong>
                            <span class="hl-choice">Choose this demon</span>
                        </button>
                    </div>

                    <p v-if="feedback" class="hl-feedback">
                        {{ feedback }}
                    </p>
                </section>

                <section v-else class="hl-results">
                    <h2>Game over!</h2>
                    <p>Your streak: <strong>{{ score }}</strong></p>
                    <p>Best streak: <strong>{{ bestScore }}</strong></p>
                    <p v-if="lastCorrectLevel">
                        The harder demon was
                        <strong>{{ lastCorrectLevel.name }}</strong>
                        (#{{ lastCorrectLevel.rank }}).
                    </p>
                    <Btn @click.native.prevent="startGame">
                        Play Again
                    </Btn>
                    <Btn @click.native.prevent="backToSettings">
                        Settings
                    </Btn>
                </section>

                <div class="hl-footer">
                    <Btn @click.native.prevent="exportSave">
                        Export Save
                    </Btn>
                    <Btn @click.native.prevent="backToSettings">
                        Back to Settings
                    </Btn>
                </div>
            </template>

            <p v-if="message" class="hl-message">{{ message }}</p>
        </main>
    `,

    data: () => ({
        loading: false,
        hasStarted: false,
        gameOver: false,
        answering: false,
        levels: [],
        leftLevel: null,
        rightLevel: null,
        score: 0,
        bestScore: 0,
        feedback: '',
        message: '',
        lastCorrectLevel: null,

        settings: {
            useMainList: true,
            useExtendedList: true,
        },
    }),

    computed: {
        hasSavedRun() {
            return !!readSave();
        },
    },

    mounted() {
        const saved = readSave();

        if (saved && saved.hasStarted && Array.isArray(saved.levels)) {
            this.applySave(saved);
        } else if (saved && Number.isInteger(saved.bestScore)) {
            this.bestScore = saved.bestScore;
        }
    },

    methods: {
        thumbnail(level) {
            const id = getYoutubeIdFromUrl(level?.video || '');
            return id ? getThumbnailFromId(id) : '';
        },

        async startGame() {
            if (!this.settings.useMainList && !this.settings.useExtendedList) {
                this.message = 'Select at least one list.';
                return;
            }

            this.loading = true;
            this.message = '';

            try {
                const fullList = await fetchList();

                if (!Array.isArray(fullList) ||
                    fullList.some(([, error]) => error)) {
                    this.message = 'The list is unavailable. Please try again.';
                    return;
                }

                const mapped = fullList.map(([level], index) => ({
                    rank: index + 1,
                    id: level.id,
                    name: level.name,
                    video: level.verification,
                }));

                const available = [];

                if (this.settings.useMainList) {
                    available.push(...mapped.slice(0, 75));
                }

                if (this.settings.useExtendedList) {
                    available.push(...mapped.slice(75, 150));
                }

                if (available.length < 2) {
                    this.message = 'At least two demons are needed to play.';
                    return;
                }

                this.levels = shuffle(available);
                this.score = 0;
                this.lastCorrectLevel = null;
                this.feedback = '';
                this.gameOver = false;
                this.answering = false;
                this.hasStarted = true;

                this.nextMatchup();
                this.saveGame();
            } catch {
                this.message = 'Could not load the list. Please try again.';
            } finally {
                this.loading = false;
            }
        },

        nextMatchup() {
            if (this.levels.length < 2) {
                this.gameOver = true;
                this.saveGame();
                return;
            }

            const previousIds = [
                this.leftLevel?.id,
                this.rightLevel?.id,
            ];

            const leftIndex = Math.floor(Math.random() * this.levels.length);
            this.leftLevel = this.levels[leftIndex];

            const candidates = this.levels.filter(level =>
                level.id !== this.leftLevel.id &&
                !(level.id === previousIds[0] || level.id === previousIds[1])
            );

            // If the pool is small, allow any different demon as a fallback.
            const fallback = this.levels.filter(
                level => level.id !== this.leftLevel.id
            );

            const rightChoices = candidates.length ? candidates : fallback;
            this.rightLevel = rightChoices[
                Math.floor(Math.random() * rightChoices.length)
            ];

            this.feedback = '';
            this.answering = false;
        },

        chooseLevel(chosen) {
            if (this.answering || this.gameOver) return;

            this.answering = true;

            const harder = this.leftLevel.rank < this.rightLevel.rank
                ? this.leftLevel
                : this.rightLevel;

            if (chosen.id === harder.id) {
                this.score += 1;
                this.bestScore = Math.max(this.bestScore, this.score);
                this.lastCorrectLevel = harder;
                this.feedback = 'Correct! ' + harder.name +
                    ' (#' + harder.rank + ') is harder.';

                this.saveGame();

                // Briefly show the feedback before loading the next matchup.
                setTimeout(() => {
                    if (!this.hasStarted || this.gameOver) return;
                    this.nextMatchup();
                    this.saveGame();
                }, 900);
            } else {
                this.feedback = 'Not quite! ' + harder.name +
                    ' (#' + harder.rank + ') is harder.';
                this.lastCorrectLevel = harder;
                this.gameOver = true;
                this.saveGame();
            }
        },

        saveGame() {
            try {
                localStorage.setItem(SAVE_KEY, JSON.stringify({
                    version: 1,
                    hasStarted: this.hasStarted,
                    gameOver: this.gameOver,
                    levels: this.levels,
                    leftLevel: this.leftLevel,
                    rightLevel: this.rightLevel,
                    score: this.score,
                    bestScore: this.bestScore,
                    settings: this.settings,
                    lastCorrectLevel: this.lastCorrectLevel,
                }));
            } catch {
                this.message = 'Could not save the game on this device.';
            }
        },

        applySave(data) {
            this.levels = data.levels || [];
            this.leftLevel = data.leftLevel || null;
            this.rightLevel = data.rightLevel || null;
            this.score = Number.isInteger(data.score) ? data.score : 0;
            this.bestScore = Number.isInteger(data.bestScore)
                ? data.bestScore
                : 0;
            this.settings = {
                ...this.settings,
                ...(data.settings || {}),
            };
            this.lastCorrectLevel = data.lastCorrectLevel || null;
            this.gameOver = !!data.gameOver;
            this.hasStarted = !!data.hasStarted &&
                !!this.leftLevel && !!this.rightLevel;
            this.feedback = '';
            this.answering = false;
        },

        resumeGame() {
            const saved = readSave();

            if (!saved) {
                this.message = 'No saved game was found.';
                return;
            }

            this.applySave(saved);
        },

        backToSettings() {
            this.hasStarted = false;
            this.gameOver = false;
            this.answering = false;
            this.feedback = '';
            this.message = '';
        },

        exportSave() {
            const data = readSave();

            if (!data) {
                this.message = 'No save is available to export.';
                return;
            }

            const blob = new Blob(
                [JSON.stringify(data, null, 2)],
                { type: 'application/json' },
            );
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = 'higher-lower-save.json';
            link.click();
            URL.revokeObjectURL(url);
        },
    },
};
