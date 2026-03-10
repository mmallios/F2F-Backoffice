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
                    },
                    {
                        id: 'apps.chat',
                        title: 'Συνομιλίες',
                        type: 'basic',
                        icon: 'heroicons_outline:chat-bubble-bottom-center-text',
                        link: '/apps/chat',
                    },
                    {
                        id: 'apps.groupchats',
                        title: 'Ομαδικές Συνομιλίες',
                        type: 'basic',
                        icon: 'heroicons_outline:chat-bubble-left-right',
                        link: '/apps/groupchats',
                    },
                    {
                        id: 'apps.announcements',
                        title: 'Ανακοινώσεις',
                        type: 'basic',
                        icon: 'heroicons_outline:megaphone',
                        link: '/apps/announcements',
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
                        id: 'apps.events',
                        title: 'Αγώνες',
                        type: 'basic',
                        icon: 'heroicons_outline:calendar-days',
                        link: '/apps/events',
                    },
                    {
                        id: 'apps.teams',
                        title: 'Ομάδες',
                        type: 'basic',
                        icon: 'heroicons_outline:user-group',
                        link: '/apps/teams',
                    },
                    {
                        id: 'apps.competitions',
                        title: 'Διοργανώσεις',
                        type: 'basic',
                        icon: 'heroicons_outline:trophy',
                        link: '/apps/competitions',
                    },
                    {
                        id: 'apps.tvchannels',
                        title: 'Κανάλια',
                        type: 'basic',
                        icon: 'heroicons_outline:tv',
                        link: '/apps/tvchannels',
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
                    },
                    {
                        id: 'apps.products',
                        title: 'Προϊόντα',
                        type: 'basic',
                        icon: 'heroicons_outline:cube',
                        link: '/apps/products',
                    },
                    {
                        id: 'apps.product-categories',
                        title: 'Κατηγορίες',
                        type: 'basic',
                        icon: 'heroicons_outline:tag',
                        link: '/apps/products/categories',
                    },
                ],
            },

            // ── Υποστήριξη ───────────────────────────────────────
            {
                id: 'apps.support',
                title: 'Υποστήριξη',
                type: 'basic',
                icon: 'heroicons_outline:lifebuoy',
                link: '/apps/support/tickets',
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
                    },
                ],
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
