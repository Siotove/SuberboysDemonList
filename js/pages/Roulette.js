
import { fetchList } from '../content.js';
import {
    getThumbnailFromId,
    getYoutubeIdFromUrl,
    shuffle,
} from '../util.js';

import Spinner from '../components/Spinner.js';
import Btn from '../components/Btn.js';

const SAVE_KEY = 'games.roulette.save.v1';

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
        <main v-if="loading">
            <Spinner></Spinner>
        </main>

        <main v-else class="page-roulette">
            <div class="sidebar">
                <h1>Roulette</h1>

                <p class="type-label-md" style="color:#aaa">
                    Spin for a random demon and reach the required percentage
                    to continue.
                </p>

                <section v-if="!hasRun" class="options">
                    <h2>Run settings</h2>

                    <div class="check">
                        <input
                            id="main"
                            type="checkbox"
                            v-model="settings.useMainList"
                        >
                        <label for="main">Main List (top 75)</label>
                    </div>

                    <div class="check">
                        <input
                            id="extended"
                            type="checkbox"
                            v-model="settings.useExtendedList"
                        >
                        <label for="extended">Extended List (76–150)</label>
                    </div>

                    <label for="startingTarget">Starting target (%)</label>
                    <input
                        id="startingTarget"
                        type="number"
                        min="1"
                        max="100"
                        step="1"
                        v-model.number="settings.startingTarget"
                    >

                    <label for="increment">Increase per round (%)</label>
                    <input
                        id="increment"
                        type="number"
                        min="1"
                        max="100"
                        step="1"
                        v-model.number="settings.increment"
                    >

                    <p class="type-label-md" style="color:#aaa">
                        Targets: {{ settings.startingTarget }}%,
                        {{ Math.min(100, settings.startingTarget + settings.increment) }}%,
                        {{ Math.min(100, settings.startingTarget + settings.increment * 2) }}%...
                    </p>

                    <Btn @click.native.prevent="onStart">
                        Start Roulette
                    </Btn>

                    <Btn
                        v-if="hasSavedRun"
                        @click.native.prevent="resumeSaved"
                    >
                        Resume saved run
                    </Btn>

                    <p style="margin-top:16px">Manual Load/Save</p>
                    <div class="btns">
                        <Btn @click.native.prevent="onImport">Import</Btn>
                        <Btn
                            :disabled="!hasSavedRun"
                            @click.native.prevent="onExport"
                        >
                            Export
                        </Btn>
                    </div>
                </section>

                <section v-else class="options">
                    <p>Round: {{ progression.length + (hasCompleted ? 0 : 1) }}</p>
                    <p>Target: {{ requiredPercentage }}%</p>
                    <p>Completed rounds: {{ progression.length }}</p>

                    <Btn
                        v-if="!givenUp && !hasCompleted"
                        @click.native.prevent="onGiveUp"
                        style="background-color:#e91e63"
                    >
                        Give Up
                    </Btn>

                    <Btn @click.native.prevent="onExport">
                        Export Save
                    </Btn>

                    <Btn
                        v-if="givenUp || hasCompleted"
                        @click.native.prevent="backToSettings"
                    >
                        New Run
                    </Btn>
                </section>
            </div>

            <section class="levels-container">
                <div class="levels">
                    <div
                        v-if="!hasRun"
                        class="results"
                    >
                        <h2>Ready to play?</h2>
                        <p>Configure your rules, then start your run.</p>
                        <p>Your saved progress is kept separately from other games.</p>
                    </div>

                    <template v-if="hasRun">
                        <div
                            class="level"
                            :class="medalClass(level.rank)"
                            v-for="(level, i) in selectedLevels"
                            :key="'completed-' + i"
                        >
                            <a
                                :href="level.video"
                                class="video"
                                target="_blank"
                                rel="noopener noreferrer"
                            >
                                <img
                                    :src="getThumbnailFromId(getYoutubeIdFromUrl(level.video))"
                                    alt=""
                                >
                            </a>

                            <div class="meta">
                                <p>#{{ level.rank }}</p>
                                <h2>{{ level.name }}</h2>
                                <p style="color:#00b54b;font-weight:700">
                                    {{ progression[i] }}%
                                </p>
                            </div>
                        </div>

                        <div
                            class="level"
                            v-if="!givenUp && !hasCompleted && currentLevel"
                        >
                            <a
                                :href="currentLevel.video"
                                class="video"
                                target="_blank"
                                rel="noopener noreferrer"
                            >
                                <img
                                    :src="getThumbnailFromId(getYoutubeIdFromUrl(currentLevel.video))"
                                    alt=""
                                >
                            </a>

                            <div class="meta">
                                <p>#{{ currentLevel.rank }}</p>
                                <h2>{{ currentLevel.name }}</h2>
                                <p>{{ currentLevel.id }}</p>
                                <p>
                                    Required progress:
                                    <strong>{{ requiredPercentage }}%</strong>
                                </p>
                            </div>

                            <form class="actions" @submit.prevent="onDone">
                                <input
                                    type="number"
                                    min="1"
                                    max="100"
                                    step="1"
                                    v-model.number="percentage"
                                    :placeholder="'At least ' + requiredPercentage + '%'"
                                >
                                <Btn @click.native.prevent="onDone">Done</Btn>
                            </form>
                        </div>

                        <div
                            v-if="givenUp || hasCompleted"
                            class="results"
                        >
                            <h1>{{ hasCompleted ? 'Challenge completed!' : 'Results' }}</h1>
                            <p>Completed rounds: {{ progression.length }}</p>
                            <p>
                                Highest percentage:
                                {{ highestPercentage }}%
                            </p>
                            <p v-if="hasCompleted">
                                Congratulations on completing the challenge!
                            </p>
                            <Btn @click.native.prevent="backToSettings">
                                Back to Settings
                            </Btn>
                        </div>
                    </template>
                </div>
            </section>

            <div class="toasts-container">
                <div class="toasts">
                    <div v-for="(toast, i) in toasts" :key="i" class="toast">
                        <p>{{ toast }}</p>
                    </div>
                </div>
            </div>
        </main>
    `,

    data: () => ({
        loading: false,
        hasRun: false,
        pool: [],
        selectedLevels: [],
        progression: [],
        percentage: undefined,
        givenUp: false,
        toasts: [],
        fileInput: null,

        settings: {
            useMainList: true,
            useExtendedList: true,
            startingTarget: 1,
            increment: 1,
        },
    }),

    mounted() {
        this.fileInput = document.createElement('input');
        this.fileInput.type = 'file';
        this.fileInput.accept = '.json,application/json';
        this.fileInput.addEventListener('change', this.onImportUpload);

        const saved = readSave();

        if (saved && Array.isArray(saved.pool)) {
            this.applySave(saved);
        } else {
            // Preserve access to an older save, if one exists.
            try {
                const old = JSON.parse(localStorage.getItem('roulette'));

                if (
                    old &&
                    Array.isArray(old.levels) &&
                    Array.isArray(old.progression)
                ) {
                    this.pool = old.levels;
                    this.selectedLevels = old.levels.slice(
                        0,
                        old.progression.length,
                    );
                    this.progression = old.progression;
                    this.hasRun = true;
                    this.save();
                }
            } catch {
                // Ignore invalid legacy save data.
            }
        }
    },

    computed: {
        currentLevel() {
            if (!this.hasRun || this.hasCompleted || this.givenUp) {
                return null;
            }

            if (this.selectedLevels.length > this.progression.length) {
                return this.selectedLevels[this.progression.length];
            }

            return null;
        },

        requiredPercentage() {
            const target =
                this.settings.startingTarget +
                this.settings.increment * this.progression.length;

            return Math.min(100, target);
        },

        highestPercentage() {
            return this.progression.length
                ? Math.max(...this.progression)
                : 0;
        },

        hasCompleted() {
            return (
                this.progression.some(value => value >= 100) ||
                (
                    this.hasRun &&
                    this.progression.length > 0 &&
                    !this.currentLevel &&
                    !this.givenUp
                )
            );
        },

        hasSavedRun() {
            return !!readSave();
        },
    },

    methods: {
        shuffle,
        getThumbnailFromId,
        getYoutubeIdFromUrl,

        medalClass(rank) {
            if (rank === 1) return 'medal-gold';
            if (rank === 2) return 'medal-silver';
            if (rank === 3) return 'medal-bronze';
            return '';
        },

        async onStart() {
            if (!this.settings.useMainList && !this.settings.useExtendedList) {
                this.showToast('Select at least one list.');
                return;
            }

            const start = Number(this.settings.startingTarget);
            const increment = Number(this.settings.increment);

            if (
                !Number.isInteger(start) ||
                start < 1 ||
                start > 100 ||
                !Number.isInteger(increment) ||
                increment < 1 ||
                increment > 100
            ) {
                this.showToast('Targets and increments must be whole numbers from 1 to 100.');
                return;
            }

            if (
                this.hasRun &&
                !this.givenUp &&
                !this.hasCompleted &&
                !window.confirm('Start a new run? Your current run will be replaced.')
            ) {
                return;
            }

            this.loading = true;

            try {
                const fullList = await fetchList();

                if (!Array.isArray(fullList) || fullList.some(([, err]) => err)) {
                    this.showToast('The list is currently unavailable. Try again later.');
                    return;
                }

                const mapped = fullList.map(([level], i) => ({
                    rank: i + 1,
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

                if (!available.length) {
                    this.showToast('No levels were found in the selected lists.');
                    return;
                }

                this.pool = shuffle(available);
                this.selectedLevels = [];
                this.progression = [];
                this.percentage = undefined;
                this.givenUp = false;
                this.hasRun = true;

                this.pickNextLevel();
                this.save();
            } catch (error) {
                this.showToast('Could not load the list. Please try again.');
            } finally {
                this.loading = false;
            }
        },

        pickNextLevel() {
            if (!this.pool.length) return;

            const previous = this.selectedLevels[this.selectedLevels.length - 1];
            const choices = this.pool.filter(level => !previous || level.id !== previous.id);
            const candidates = choices.length ? choices : this.pool;

            this.selectedLevels.push(
                candidates[Math.floor(Math.random() * candidates.length)],
            );
        },

        onDone() {
            if (!this.currentLevel) {
                this.showToast('There is no active level.');
                return;
            }

            const value = Number(this.percentage);

            if (
                this.percentage === undefined ||
                this.percentage === '' ||
                !Number.isInteger(value) ||
                value < this.requiredPercentage ||
                value > 100
            ) {
                this.showToast(
                    'Reach at least ' + this.requiredPercentage + '% to continue.',
                );
                return;
            }

            this.progression.push(value);
            this.percentage = undefined;

            if (value >= 100) {
                this.givenUp = false;
                this.save();
                return;
            }

            this.pickNextLevel();
            this.save();
        },

        onGiveUp() {
            this.givenUp = true;
            this.save();
        },

        save() {
            const data = {
                version: 1,
                pool: this.pool,
                selectedLevels: this.selectedLevels,
                progression: this.progression,
                givenUp: this.givenUp,
                hasRun: this.hasRun,
                settings: this.settings,
            };

            localStorage.setItem(SAVE_KEY, JSON.stringify(data));
        },

        applySave(data) {
            if (!Array.isArray(data.pool) ||
                !Array.isArray(data.selectedLevels) ||
                !Array.isArray(data.progression)) {
                this.showToast('This save file is invalid.');
                return;
            }

            this.pool = data.pool;
            this.selectedLevels = data.selectedLevels;
            this.progression = data.progression;
            this.givenUp = !!data.givenUp;
            this.hasRun = !!data.hasRun;

            if (data.settings) {
                this.settings = {
                    ...this.settings,
                    ...data.settings,
                };
            }

            this.percentage = undefined;
        },

        resumeSaved() {
            const data = readSave();

            if (!data) {
                this.showToast('No saved run was found.');
                return;
            }

            this.applySave(data);
        },

        backToSettings() {
            this.hasRun = false;
            this.givenUp = false;
            this.percentage = undefined;
        },

        onImport() {
            if (
                this.hasRun &&
                !this.givenUp &&
                !this.hasCompleted &&
                !window.confirm('Importing will replace your current run. Continue?')
            ) {
                return;
            }

            this.fileInput.value = '';
            this.fileInput.click();
        },

        async onImportUpload() {
            const file = this.fileInput.files[0];
            if (!file) return;

            try {
                const data = JSON.parse(await file.text());

                if (Array.isArray(data.pool)) {
                    this.applySave(data);
                } else if (
                    Array.isArray(data.levels) &&
                    Array.isArray(data.progression)
                ) {
                    // Support older exported Roulette saves.
                    this.pool = data.levels;
                    this.selectedLevels = data.levels.slice(
                        0,
                        data.progression.length,
                    );
                    this.progression = data.progression;
                    this.givenUp = false;
                    this.hasRun = true;
                } else {
                    this.showToast('Invalid Roulette save file.');
                    return;
                }

                this.save();
                this.showToast('Save imported.');
            } catch {
                this.showToast('Could not read that save file.');
            }
        },

        onExport() {
            const data = {
                version: 1,
                pool: this.pool,
                selectedLevels: this.selectedLevels,
                progression: this.progression,
                givenUp: this.givenUp,
                hasRun: this.hasRun,
                settings: this.settings,
            };

            const file = new Blob(
                [JSON.stringify(data, null, 2)],
                { type: 'application/json' },
            );

            const url = URL.createObjectURL(file);
            const link = document.createElement('a');
            link.href = url;
            link.download = 'roulette-save.json';
            link.click();
            URL.revokeObjectURL(url);
        },

        showToast(message) {
            this.toasts.push(message);

            setTimeout(() => {
                this.toasts.shift();
            }, 3000);
        },
    },
};
