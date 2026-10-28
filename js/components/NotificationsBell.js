export default {
    name: 'NotificationsBell',
    data() {
        return {
            open: false,
            loading: false,
            visible: true,
            notifications: [],
            unreadCount: 0,
            error: '',
            timer: null
        };
    },
    template: `
        <div v-if="visible" class="competition-notice-wrap">
            <button type="button" class="competition-notice-button"
                @click="toggle" :aria-expanded="open ? 'true' : 'false'"
                aria-label="Notifications" title="Notifications">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" /></svg>
                <span v-if="unreadCount" class="competition-notice-count">{{ unreadCount > 99 ? '99+' : unreadCount }}</span>
            </button>
            <section v-if="open" class="competition-notice-panel" aria-label="Your notifications">
                <header class="competition-notice-heading">
                    <div><strong>Notifications</strong><small>{{ unreadCount }} unread</small></div>
                    <button type="button" @click="markAllRead" :disabled="!unreadCount || loading">Mark all read</button>
                </header>
                <p v-if="loading && !notifications.length" class="competition-notice-empty">Loading notifications…</p>
                <p v-else-if="error" class="competition-notice-error" role="alert">{{ error }}</p>
                <p v-else-if="!notifications.length" class="competition-notice-empty">You're all caught up.</p>
                <div v-else class="competition-notice-list">
                    <button v-for="item in notifications" :key="item.id" type="button"
                        class="competition-notice-item" :class="{ 'is-unread': !item.read_at }"
                        @click="openNotification(item)">
                        <span class="competition-notice-dot" :class="'is-' + item.category"></span>
                        <span class="competition-notice-copy"><strong>{{ item.title }}</strong><span>{{ item.body }}</span><small>{{ formatDate(item.created_at) }}</small></span>
                    </button>
                </div>
                <footer v-if="notifications.length" class="competition-notice-footer">
                    <button type="button" @click="load" :disabled="loading">{{ loading ? 'Refreshing…' : 'Refresh' }}</button>
                </footer>
            </section>
        </div>
    `,
    mounted() {
        this.load();
        this.timer = setInterval(() => this.load(), 60000);
        this.outsideClick = event => {
            if (this.open && !this.$el.contains(event.target)) this.open = false;
        };
        document.addEventListener('click', this.outsideClick);
    },
    beforeUnmount() {
        if (this.timer) clearInterval(this.timer);
        if (this.outsideClick) document.removeEventListener('click', this.outsideClick);
    },
    methods: {
        async toggle() {
            this.open = !this.open;
            if (this.open) await this.load();
        },
        async load() {
            if (this.loading) return;
            this.loading = true;
            try {
                const response = await fetch('/api/competition/notifications?limit=30', {
                    credentials: 'same-origin', cache: 'no-store'
                });
                if (response.status === 401 || response.status === 403) {
                    this.visible = false;
                    return;
                }
                const result = await response.json();
                if (!response.ok) throw new Error(result.error || 'Could not load notifications.');
                this.visible = true;
                this.notifications = result.notifications || [];
                this.unreadCount = Number(result.unreadCount) || 0;
                this.error = '';
            } catch (error) {
                this.error = error.message || 'Could not load notifications.';
            } finally {
                this.loading = false;
            }
        },
        async markRead(item) {
            if (!item || item.read_at) return;
            try {
                const response = await fetch('/api/competition/notifications/read', {
                    method: 'POST', credentials: 'same-origin',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ ids: [item.id] })
                });
                if (!response.ok) return;
                item.read_at = new Date().toISOString();
                this.unreadCount = Math.max(0, this.unreadCount - 1);
            } catch { /* Keep the notification visible if the network is offline. */ }
        },
        async openNotification(item) {
            await this.markRead(item);
            this.open = false;
            const href = typeof item.href === 'string' && item.href.startsWith('/') && !item.href.startsWith('//')
                ? item.href : '/profile';
            if (this.$router) this.$router.push(href);
        },
        async markAllRead() {
            if (!this.unreadCount) return;
            this.loading = true;
            try {
                const response = await fetch('/api/competition/notifications/read', {
                    method: 'POST', credentials: 'same-origin',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ all: true })
                });
                const result = await response.json();
                if (!response.ok) throw new Error(result.error || 'Could not mark notifications read.');
                this.unreadCount = Number(result.unreadCount) || 0;
                this.notifications.forEach(item => { if (!item.read_at) item.read_at = new Date().toISOString(); });
            } catch (error) {
                this.error = error.message || 'Could not mark notifications read.';
            } finally {
                this.loading = false;
            }
        },
        formatDate(value) {
            if (!value) return '';
            const date = new Date(value.includes('Z') ? value : value.replace(' ', 'T') + 'Z');
            return Number.isNaN(date.getTime()) ? value : date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
        }
    }
};
