
import { store } from "../main.js";
import { embed } from "../util.js";
import { score } from "../score.js";
import { fetchEditors, fetchList } from "../content.js";

import Spinner from "../components/Spinner.js";
import LevelAuthors from "../components/List/LevelAuthors.js";

const roleIconMap = {
    owner: "crown",
    admin: "user-gear",
    helper: "user-shield",
    dev: "code",
    trial: "user-lock",
};

const ARCHIVE_START_DATE = "2026-08-19";

export default {
    components: { Spinner, LevelAuthors },

    template: `
        <main v-if="loading">
            <Spinner></Spinner>
        </main>

        <main v-else class="page-list">
            <div class="list-container">

                <div class="historical-controls">
                    <label for="history-date">View list from a past date:</label>

                    <select
                        id="history-date"
                        v-model="selectedDate"
                        @change="loadHistorical(selectedDate)"
                    >
                        <option value="">Current list</option>
                        <option
                            v-for="snapshot in snapshotDates"
                            :key="snapshot.date"
                            :value="snapshot.date.slice(0, 10)"
                        >
                            {{ formatDate(snapshot.date) }}
                        </option>
                    </select>

                    <button
                        v-if="historical"
                        @click="showCurrentList"
                    >
                        Back to Current List
                    </button>

                    <p v-if="historical" class="history-label">
                        Historical View — {{ formatDate(selectedDate) }}
                    </p>
                </div>

                <table class="list" v-if="list">
                    <tr v-for="([level, err], i) in list" :key="i">
                        <td class="rank">
                            <p
                                v-if="i + 1 <= 150"
                                class="type-label-lg"
                                :class="{
                                    'rank-gold': i === 0,
                                    'rank-silver': i === 1,
                                    'rank-bronze': i === 2
                                }"
                            >#{{ i + 1 }}</p>
                            <p v-else class="type-label-lg">Legacy</p>
                        </td>

                        <td
                            class="level"
                            :class="{
                                'active': selected == i,
                                'error': !level,
                                'rank-gold': i === 0,
                                'rank-silver': i === 1,
                                'rank-bronze': i === 2
                            }"
                        >
                            <button @click="selected = i">
                                <span class="type-label-lg">
    {{ level?.name || ('Unavailable (' + err + ')') }}
</span>
<span
    v-if="level && rankChange(level)"
    class="rank-change"
    :class="rankChange(level).type"
>
    {{ rankChange(level).label }}
</span>
                            </button>
                        </td>
                    </tr>
                </table>

                <p v-else>
                    Failed to load the list.
                </p>
            </div>

            <div class="level-container">
                <div class="level" v-if="level">
                    <h1>{{ level.name }}</h1>

                    <LevelAuthors
                        :author="level.author"
                        :creators="level.creators"
                        :verifier="level.verifier"
                    ></LevelAuthors>

                    <iframe
                        v-if="video"
                        class="video"
                        id="videoframe"
                        :src="video"
                        frameborder="0"
                    ></iframe>

                    <ul class="stats">
                        <li>
                            <div class="type-title-sm">Points when completed</div>
                            <p>{{ score(selected + 1, 100, level.percentToQualify) }}</p>
                        </li>
                        <li>
                            <div class="type-title-sm">ID</div>
                            <p>{{ level.id }}</p>
                        </li>
                        <li>
                            <div class="type-title-sm">Password</div>
                            <p>{{ level.password || 'Free to Copy' }}</p>
                        </li>
                    </ul>

                    <h2>Records</h2>

                    <p v-if="selected + 1 <= 150">
                        <strong>{{ level.percentToQualify }}%</strong> or better to qualify
                    </p>
                    <p v-else>
                        This level does not accept new records.
                    </p>

                    <table class="records">
                        <tr
                            v-for="(record, index) in level.records"
                            :key="index"
                            class="record"
                        >
                            <td class="percent">
                                <p>{{ record.percent }}%</p>
                            </td>
                            <td class="user">
                                <a
                                    :href="record.link"
                                    target="_blank"
                                    class="type-label-lg"
                                >{{ record.user }}</a>
                            </td>
                            <td class="mobile">
                                <img
                                    v-if="record.mobile"
                                    :src="\`/assets/phone-landscape\${store.dark ? '-dark' : ''}.svg\`"
                                    alt="Mobile"
                                >
                            </td>
                            <td class="hz">
                                <p>{{ record.hz }}Hz</p>
                            </td>
                        </tr>
                    </table>
                </div>

                <div
                    v-else
                    class="level"
                    style="height: 100%; justify-content: center; align-items: center;"
                >
                    <p>
                        {{ selectedError || '(ノಠ益ಠ)ノ彡┻━┻' }}
                    </p>
                </div>
            </div>

            <div class="meta-container">
                <div class="meta">
                    <div class="errors" v-show="errors.length > 0">
                        <p class="error" v-for="error of errors" :key="error">
                            {{ error }}
                        </p>
                    </div>

                    <div class="og">
                        <p class="type-label-md">
                            Website layout made by
                            <a href="https://tsl.pages.dev/" target="_blank">
                                TheShittyList
                            </a>
                        </p>
                    </div>

                    <template v-if="editors">
                        <h3>List Editors</h3>
                        <ol class="editors">
                            <li v-for="editor in editors" :key="editor.name">
                                <img
                                    :src="\`/assets/\${roleIconMap[editor.role]}\${store.dark ? '-dark' : ''}.svg\`"
                                    :alt="editor.role"
                                >
                                <a
                                    v-if="editor.link"
                                    class="type-label-lg link"
                                    target="_blank"
                                    :href="editor.link"
                                >{{ editor.name }}</a>
                                <p v-else>{{ editor.name }}</p>
                            </li>
                        </ol>
                    </template>

                    <h3>Submission Requirements</h3>
                    <p>Achieved the record without using hacks (FPS bypass is allowed, up to 360fps).</p>
                    <p>Achieved the record on the level that is listed on the site. Please check the level ID before submitting a record.</p>
                    <p>Have either source audio or clicks/taps in the video. Edited audio only does not count.</p>
                    <p>The recording must show a previous attempt and the entire death animation before completion, unless the completion is on the first attempt. Everyplay records are exempt from this.</p>
                    <p>The recording must also show the player hit the endwall, or the completion will be invalidated.</p>
                    <p>Do not use secret routes or bug routes.</p>
                    <p>The level must be published by the following accounts: Suberman2, JJGamingGMD, Suberman, JJM03512, Zaynem12, Gamaker, Banrutus.</p>
                    <p>Once a level falls onto the Legacy List, records are accepted for 24 hours after it falls off. After that, new records are not accepted.</p>
                </div>
            </div>
        </main>
    `,

    data: () => ({
        list: [],
        currentList: [],
        editors: [],
        loading: true,
        selected: 0,
        errors: [],
        roleIconMap,
        store,
        rankChanges: {},
        snapshotDates: [],
        selectedDate: "",
        historical: false,
        selectedError: "",
    }),

    computed: {
        level() {
            return this.list?.[this.selected]?.[0] ?? null;
        },

        video() {
            if (!this.level) return "";

            return embed(
                this.level.showcase || this.level.verification
            );
        },
    },

    async mounted() {
        this.currentList = await fetchList();
        this.list = this.currentList;
        this.editors = await fetchEditors();

        if (!this.currentList) {
            this.errors = [
                "Failed to load list. Retry in a few minutes or notify list staff.",
            ];
        } else {
            this.errors.push(
                ...this.currentList
                    .filter(([_, err]) => err)
                    .map(([_, err]) => `Failed to load level. (${err}.json)`)
            );

            if (!this.editors) {
                this.errors.push("Failed to load list editors.");
            }
        }

        await this.loadSnapshotDates();
await this.updateRankChanges();
this.loading = false;
    },

    
    methods: {
        embed,
        score,

        formatDate(date) {
            const [year, month, day] = date.slice(0, 10).split("-").map(Number);

            return new Date(year, month - 1, day).toLocaleDateString("en-GB", {
                day: "numeric",
                month: "long",
                year: "numeric",
            });
        },

        async updateRankChanges() {
            this.rankChanges = {};

            if (!this.snapshotDates.length) return;

            const selectedIndex = this.historical
                ? this.snapshotDates.findIndex(
                    item => item.date.slice(0, 10) === this.selectedDate
                )
                : -1;

            const selectedSnapshot = selectedIndex >= 0
                ? this.snapshotDates[selectedIndex]
                : null;

            const comparisonSnapshot = this.historical
                ? this.snapshotDates[selectedIndex + 1]
                : this.snapshotDates[0];

            let currentOrder;
            let previousOrder = [];

            try {
                if (this.historical) {
                    if (!selectedSnapshot) return;

                    const response = await fetch(
                        "/archive/" + selectedSnapshot.file
                    );
                    if (!response.ok) throw new Error("Snapshot unavailable");

                    currentOrder = await response.json();
                } else {
                    currentOrder = (this.currentList || [])
                        .map(([level]) => level?.path || level?.name)
                        .filter(Boolean);
                }

                if (comparisonSnapshot) {
                    const response = await fetch(
                        "/archive/" + comparisonSnapshot.file
                    );
                    if (!response.ok) throw new Error("Comparison snapshot unavailable");

                    previousOrder = await response.json();
                }
            } catch (error) {
                console.error("Failed to calculate rank changes:", error);
                return;
            }

            const canonical = value => {
                const level = (this.currentList || [])
                    .map(([item]) => item)
                    .find(item =>
                        item && (item.path === value || item.name === value)
                    );

                return level?.path || value;
            };

            const previousRanks = new Map(
                previousOrder.map((value, index) => [
                    canonical(value),
                    index + 1,
                ])
            );

            currentOrder.forEach((value, index) => {
                const key = canonical(value);
                const rank = index + 1;
                const oldRank = previousRanks.get(key);

                let change;

                if (oldRank === undefined) {
                    change = { type: "new", label: "NEW" };
                } else if (oldRank > rank) {
                    change = {
                        type: "up",
                        label: "↑ " + (oldRank - rank),
                    };
                } else if (oldRank < rank) {
                    change = {
                        type: "down",
                        label: "↓ " + (rank - oldRank),
                    };
                } else {
                    change = { type: "same", label: "—" };
                }

                this.rankChanges[key] = change;
            });
        },

        rankChange(level) {
            if (!level) return null;

            return this.rankChanges[level.path]
                || this.rankChanges[level.name]
                || null;
        },

        async loadSnapshotDates() {
            try {
                const response = await fetch("/archive/index.json");
                if (!response.ok) throw new Error("Archive index unavailable");

                const index = await response.json();
                const latestByDate = new Map();

                for (const snapshot of index) {
                    const date = snapshot.date.slice(0, 10);

                    if (date < ARCHIVE_START_DATE) continue;

                    const previous = latestByDate.get(date);

                    if (
                        !previous ||
                        new Date(snapshot.date) > new Date(previous.date)
                    ) {
                        latestByDate.set(date, snapshot);
                    }
                }

                this.snapshotDates = [...latestByDate.values()].sort(
                    (a, b) => b.date.localeCompare(a.date)
                );
            } catch (error) {
                console.error("Failed to load archive dates:", error);
                this.errors.push(
                    "Could not load historical dates. The current list still works."
                );
            }
        },

        async loadHistorical(date) {
            if (!date) {
                await this.showCurrentList();
                return;
            }

            const snapshot = this.snapshotDates.find(
                item => item.date.slice(0, 10) === date
            );

            if (!snapshot) return;

            this.loading = true;
            this.selectedError = "";

            try {
                const response = await fetch("/archive/" + snapshot.file);

                if (!response.ok) {
                    throw new Error("Could not fetch snapshot");
                }

                const historicalPaths = await response.json();
                const currentByPath = new Map();
                const currentByName = new Map();

                for (const [level] of this.currentList || []) {
                    if (!level) continue;

                    currentByPath.set(level.path, [level, null]);
                    currentByName.set(level.name, [level, null]);
                }

                this.list = historicalPaths.map(path => {
                    return currentByPath.get(path)
                        || currentByName.get(path)
                        || [null, path];
                });

                this.historical = true;
                this.selected = 0;

                await this.updateRankChanges();

                if (!this.list.length) {
                    this.selectedError = "This snapshot contains no levels.";
                }
            } catch (error) {
                console.error("Failed to load historical list:", error);
                this.errors.push(
                    "Failed to load the selected historical snapshot."
                );

                await this.showCurrentList();
            } finally {
                this.loading = false;
            }
        },

        async showCurrentList() {
            this.list = this.currentList || [];
            this.selectedDate = "";
            this.historical = false;
            this.selected = 0;
            this.selectedError = "";

            await this.updateRankChanges();
        },
    },
};
