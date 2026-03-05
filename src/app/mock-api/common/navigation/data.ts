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
            // {
            //     id: 'dashboards.project',
            //     title: 'Πίνακας Ελέγχου',
            //     type: 'basic',
            //     icon: 'heroicons_outline:squares-2x2', // dashboard grid
            //     link: '/dashboards/project',
            // },
            {
                id: 'apps.chat',
                title: 'Συνομιλίες',
                type: 'basic',
                icon: 'heroicons_outline:chat-bubble-bottom-center-text',
                link: '/apps/chat',
            },
            {
                id: 'apps.contacts',
                title: 'Χρήστες',
                type: 'basic',
                icon: 'heroicons_outline:users',
                link: '/apps/contacts',
            },
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
                icon: 'heroicons_outline:trophy', // competitions
                link: '/apps/competitions',
            },
            {
                id: 'apps.groupchats',
                title: 'Ομαδικές Συνομιλίες',
                type: 'basic',
                icon: 'heroicons_outline:chat-bubble-left-right', // group chat
                link: '/apps/groupchats',
            },
            {
                id: 'apps.tvchannels',
                title: 'Κανάλια',
                type: 'basic',
                icon: 'heroicons_outline:tv', // tv channels
                link: '/apps/tvchannels',
            },
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
                id: 'apps.announcements',
                title: 'Ανακοινώσεις F2F',
                type: 'basic',
                icon: 'heroicons_outline:megaphone',
                link: '/apps/announcements',
            },
            {
                id: 'apps.support',
                title: 'Ticketing System',
                type: 'basic',
                icon: 'heroicons_outline:lifebuoy',
                link: '/apps/support/tickets',
            },
            {
                id: 'apps.roles',
                title: 'Ρολοι Διαχειριστων',
                type: 'basic',
                icon: 'heroicons_outline:lifebuoy',
                link: '/apps/settings/roles',
            }




            // {
            //     id: 'dashboards.analytics',
            //     title: 'Analytics',
            //     type: 'basic',
            //     icon: 'heroicons_outline:chart-pie',
            //     link: '/dashboards/analytics',
            // },
            // {
            //     id: 'dashboards.finance',
            //     title: 'Finance',
            //     type: 'basic',
            //     icon: 'heroicons_outline:banknotes',
            //     link: '/dashboards/finance',
            // },
            // {
            //     id: 'dashboards.crypto',
            //     title: 'Crypto',
            //     type: 'basic',
            //     icon: 'heroicons_outline:currency-dollar',
            //     link: '/dashboards/crypto',
            // },
        ]
    }
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
