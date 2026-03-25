/* eslint-disable */
import { FuseNavigationItem } from '@fuse/components/navigation';

export const defaultNavigation: FuseNavigationItem[] = [
    {
        id: 'dashboards',
        title: 'FAN2FAN Backoffice',
        subtitle: '',
        type: 'group',
        icon: 'heroicons_outline:home',
        children: [

            // ── Dashboard ────────────────────────────────────────
            {
                id: 'dashboards.project',
                title: 'Αρχική Σελίδα',
                type: 'basic',
                icon: 'heroicons_outline:home',
                link: '/dashboards/project',
                meta: { domain: 'DASHBOARD' },
            },

            // ── Κοινότητα ────────────────────────────────────────
            {
                id: 'community',
                title: 'Κοινότητα',
                type: 'collapsable',
                icon: 'heroicons_outline:users',
                children: [
                    {
                        id: 'apps.contacts',
                        title: 'Χρήστες',
                        type: 'basic',
                        icon: 'heroicons_outline:user',
                        link: '/apps/contacts',
                        meta: { domain: 'USERS' },
                    },
                    {
                        id: 'apps.registration-requests',
                        title: 'Αιτήματα Εγγραφής',
                        type: 'basic',
                        icon: 'heroicons_outline:user-plus',
                        link: '/apps/registration-requests',
                        meta: { domain: 'REGISTRATION_REQUESTS' },
                    },
                    {
                        id: 'apps.groupchats',
                        title: 'Ομαδικές Συνομιλίες',
                        type: 'basic',
                        icon: 'heroicons_outline:chat-bubble-left-right',
                        link: '/apps/groupchats',
                        meta: { domain: 'GROUP_CHATS' },
                    },
                ],
            },

            // ── Περιεχόμενο ──────────────────────────────────────
            {
                id: 'content',
                title: 'Περιεχόμενο',
                type: 'collapsable',
                icon: 'heroicons_outline:newspaper',
                children: [
                    {
                        id: 'headquarters.announcements',
                        title: 'Ανακοινώσεις F2F',
                        type: 'basic',
                        icon: 'heroicons_outline:megaphone',
                        link: '/apps/announcements',
                        meta: { domain: 'ANNOUNCEMENTS' },
                    },
                    {
                        id: 'apps.events',
                        title: 'Αγώνες',
                        type: 'basic',
                        icon: 'heroicons_outline:calendar-days',
                        link: '/apps/events',
                        meta: { domain: 'EVENTS' },
                    },
                    {
                        id: 'apps.teams',
                        title: 'Ομάδες',
                        type: 'basic',
                        icon: 'heroicons_outline:user-group',
                        link: '/apps/teams',
                        meta: { domain: 'TEAMS' },
                    },
                    {
                        id: 'apps.competitions',
                        title: 'Διοργανώσεις',
                        type: 'basic',
                        icon: 'heroicons_outline:trophy',
                        link: '/apps/competitions',
                        meta: { domain: 'COMPETITIONS' },
                    },
                    {
                        id: 'apps.tvchannels',
                        title: 'Κανάλια',
                        type: 'basic',
                        icon: 'heroicons_outline:tv',
                        link: '/apps/tvchannels',
                        meta: { domain: 'TV_CHANNELS' },
                    },
                    {
                        id: 'apps.fan-cards',
                        title: 'Κάρτες Φιλάθλου',
                        type: 'basic',
                        icon: 'heroicons_outline:identification',
                        link: '/apps/fan-cards',
                        meta: { domain: 'FAN_CARDS' },
                    },
                    {
                        id: 'apps.fan-card-reports',
                        title: 'Αναφορές Καρτών',
                        type: 'basic',
                        icon: 'heroicons_outline:flag',
                        link: '/apps/fan-cards/reports',
                        meta: { domain: 'FAN_CARD_REPORTS' },
                    },
                    {
                        id: 'apps.news',
                        title: 'Νέα',
                        type: 'basic',
                        icon: 'heroicons_outline:newspaper',
                        link: '/apps/news',
                        meta: { domain: 'NEWS' },
                    },
                    {
                        id: 'apps.contests',
                        title: 'Διαγωνισμοί',
                        type: 'basic',
                        icon: 'heroicons_outline:gift',
                        link: '/apps/contests',
                        meta: { domain: 'CONTESTS' },
                    },
                    {
                        id: 'apps.offers',
                        title: 'Προσφορές',
                        type: 'basic',
                        icon: 'heroicons_outline:tag',
                        link: '/apps/offers',
                        meta: { domain: 'OFFERS' },
                    },
                    {
                        id: 'apps.offers.categories',
                        title: 'Κατηγορίες Προσφορών',
                        type: 'basic',
                        icon: 'heroicons_outline:squares-2x2',
                        link: '/apps/offers/categories',
                        meta: { domain: 'OFFER_CATEGORIES' },
                    },
                    {
                        id: 'apps.away-trips',
                        title: 'Εκτος Εδρας Εκδρομές',
                        type: 'basic',
                        icon: 'heroicons_outline:paper-airplane',
                        link: '/apps/away-trips',
                        meta: { domain: 'AWAY_TRIPS' },
                    },
                    {
                        id: 'apps.tickers',
                        title: 'Ticker Bar',
                        type: 'basic',
                        icon: 'heroicons_outline:megaphone',
                        link: '/apps/tickers',
                        meta: { domain: 'TICKERS' },
                    },
                ],
            },

            // ── Ηλεκτρονικό Κατάστημα ────────────────────────────
            {
                id: 'eshop',
                title: 'Ηλεκτρονικό Κατάστημα',
                type: 'collapsable',
                icon: 'heroicons_outline:shopping-bag',
                children: [
                    {
                        id: 'apps.orders',
                        title: 'Παραγγελίες',
                        type: 'basic',
                        icon: 'heroicons_outline:shopping-cart',
                        link: '/apps/orders',
                        meta: { domain: 'ORDERS' },
                    },
                    {
                        id: 'apps.products',
                        title: 'Προϊόντα',
                        type: 'basic',
                        icon: 'heroicons_outline:cube',
                        link: '/apps/products',
                        meta: { domain: 'PRODUCTS' },
                    },
                    {
                        id: 'apps.product-categories',
                        title: 'Κατηγορίες',
                        type: 'basic',
                        icon: 'heroicons_outline:tag',
                        link: '/apps/products/categories',
                        meta: { domain: 'PRODUCT_CATEGORIES' },
                    },
                ],
            },

            // ── Υποστήριξη ───────────────────────────────────────
            {
                id: 'apps.support',
                title: 'Υποστήριξη',
                type: 'collapsable',
                icon: 'heroicons_outline:lifebuoy',
                children: [
                    {
                        id: 'apps.support.tickets',
                        title: 'Αιτήματα Υποστήριξης',
                        type: 'basic',
                        icon: 'heroicons_outline:ticket',
                        link: '/apps/support/tickets',
                        meta: { domain: 'SUPPORT_TICKETS' },
                    },
                    {
                        id: 'apps.support.stats',
                        title: 'Στατιστικά Υποστήριξης',
                        type: 'basic',
                        icon: 'heroicons_outline:chart-bar',
                        link: '/apps/support/stats',
                        meta: { domain: 'SUPPORT_STATS' },
                    },
                ],
            },

            // ── Ρυθμίσεις ────────────────────────────────────────
            {
                id: 'settings',
                title: 'Ρυθμίσεις',
                type: 'collapsable',
                icon: 'heroicons_outline:cog-6-tooth',
                children: [
                    {
                        id: 'apps.roles',
                        title: 'Ρόλοι Διαχειριστών',
                        type: 'basic',
                        icon: 'heroicons_outline:shield-check',
                        link: '/apps/settings/roles',
                        // meta: { domain: 'ROLES' },
                    },

                    {
                        id: 'apps.admin-activity',
                        title: 'Στατιστικά Διαχειριστών',
                        type: 'basic',
                        icon: 'heroicons_outline:chart-bar-square',
                        link: '/apps/settings/admin-activity',
                        meta: { domain: 'ADMIN_ACTIVITY' },
                    },
                ],
            },

        ],
    },

    // ── HEADQUARTERS F2F ─────────────────────────────────────────
    {
        id: 'headquarters',
        title: 'HEADQUARTERS F2F',
        type: 'group',
        children: [
            {
                id: 'headquarters.chat',
                title: 'Συνομιλίες HQ',
                type: 'basic',
                icon: 'heroicons_outline:chat-bubble-left-right',
                link: '/apps/chat',
                meta: { domain: 'HQ_CHAT' },
            },
            {
                id: 'apps.bo-announcements',
                title: 'Ανακοινώσεις HQ',
                type: 'basic',
                icon: 'heroicons_outline:megaphone',
                link: '/apps/bo-announcements',
                meta: { domain: 'HQ_ANNOUNCEMENTS' },
            },

            {
                id: 'apps.fan2fan-stats',
                title: 'Στατιστικά FAN2FAN',
                type: 'basic',
                icon: 'heroicons_outline:chart-pie',
                link: '/apps/fan2fan-stats',
                meta: { domain: 'FAN2FAN_STATS' },
            },
        ],
    },
]


export const compactNavigation: FuseNavigationItem[] = [
    {
        id: 'dashboards',
        title: 'Dashboards',
        tooltip: 'Dashboards',
        type: 'aside',
        icon: 'heroicons_outline:home',
        children: [], // This will be filled from defaultNavigation so we don't have to manage multiple sets of the same navigation
    },
    {
        id: 'apps',
        title: 'Apps',
        tooltip: 'Apps',
        type: 'aside',
        icon: 'heroicons_outline:squares-2x2',
        children: [], // This will be filled from defaultNavigation so we don't have to manage multiple sets of the same navigation
    },
    {
        id: 'pages',
        title: 'Pages',
        tooltip: 'Pages',
        type: 'aside',
        icon: 'heroicons_outline:document-duplicate',
        children: [], // This will be filled from defaultNavigation so we don't have to manage multiple sets of the same navigation
    },
    {
        id: 'user-interface',
        title: 'UI',
        tooltip: 'UI',
        type: 'aside',
        icon: 'heroicons_outline:rectangle-stack',
        children: [], // This will be filled from defaultNavigation so we don't have to manage multiple sets of the same navigation
    },
    {
        id: 'navigation-features',
        title: 'Navigation',
        tooltip: 'Navigation',
        type: 'aside',
        icon: 'heroicons_outline:bars-3',
        children: [], // This will be filled from defaultNavigation so we don't have to manage multiple sets of the same navigation
    },
];
export const futuristicNavigation: FuseNavigationItem[] = [
    {
        id: 'dashboards',
        title: 'DASHBOARDS',
        type: 'group',
        children: [], // This will be filled from defaultNavigation so we don't have to manage multiple sets of the same navigation
    },
    {
        id: 'apps',
        title: 'APPS',
        type: 'group',
        children: [], // This will be filled from defaultNavigation so we don't have to manage multiple sets of the same navigation
    },
    {
        id: 'others',
        title: 'OTHERS',
        type: 'group',
    },
    {
        id: 'pages',
        title: 'Pages',
        type: 'aside',
        icon: 'heroicons_outline:document-duplicate',
        children: [], // This will be filled from defaultNavigation so we don't have to manage multiple sets of the same navigation
    },
    {
        id: 'user-interface',
        title: 'User Interface',
        type: 'aside',
        icon: 'heroicons_outline:rectangle-stack',
        children: [], // This will be filled from defaultNavigation so we don't have to manage multiple sets of the same navigation
    },
    {
        id: 'navigation-features',
        title: 'Navigation Features',
        type: 'aside',
        icon: 'heroicons_outline:bars-3',
        children: [], // This will be filled from defaultNavigation so we don't have to manage multiple sets of the same navigation
    },
];
export const horizontalNavigation: FuseNavigationItem[] = [
    {
        id: 'dashboards',
        title: 'Dashboards',
        type: 'group',
        icon: 'heroicons_outline:home',
        children: [], // This will be filled from defaultNavigation so we don't have to manage multiple sets of the same navigation
    },
    {
        id: 'apps',
        title: 'Apps',
        type: 'group',
        icon: 'heroicons_outline:squares-2x2',
        children: [], // This will be filled from defaultNavigation so we don't have to manage multiple sets of the same navigation
    },
    {
        id: 'pages',
        title: 'Pages',
        type: 'group',
        icon: 'heroicons_outline:document-duplicate',
        children: [], // This will be filled from defaultNavigation so we don't have to manage multiple sets of the same navigation
    },
    {
        id: 'user-interface',
        title: 'UI',
        type: 'group',
        icon: 'heroicons_outline:rectangle-stack',
        children: [], // This will be filled from defaultNavigation so we don't have to manage multiple sets of the same navigation
    },
    {
        id: 'navigation-features',
        title: 'Misc',
        type: 'group',
        icon: 'heroicons_outline:bars-3',
        children: [], // This will be filled from defaultNavigation so we don't have to manage multiple sets of the same navigation
    },
];
