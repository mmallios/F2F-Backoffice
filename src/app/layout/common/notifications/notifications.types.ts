export interface Notification {
    id: string;
    icon?: string;
    image?: string;
    title?: string;
    description?: string;
    time: string;
    link?: string;
    useRouter?: boolean;
    read: boolean;
    // BO-specific
    type?: number;       // 1=SupportTicket, 2=SupportReply, 3=Order, 4=Registration
    referenceId?: number | null;
}

export const BONotifType = {
    NewSupportTicket: 1,
    SupportReply: 2,
    NewOrder: 3,
    NewRegistrationRequest: 4,
    NewBOAnnouncement: 5,
} as const;

export const BONotifIcon: Record<number, string> = {
    1: 'heroicons_outline:ticket',
    2: 'heroicons_outline:chat-bubble-left-right',
    3: 'heroicons_outline:shopping-bag',
    4: 'heroicons_outline:user-plus',
    5: 'heroicons_outline:megaphone',
};

export const BONotifLabel: Record<number, string> = {
    1: 'Αίτημα Υποστήριξης',
    2: 'Απάντηση σε Αίτημα',
    3: 'Νέα Παραγγελία',
    4: 'Αίτημα Εγγραφής',
    5: 'Νέα Ανακοίνωση',
};

export const BONotifLink: Record<number, (refId?: number | null) => string | null> = {
    1: (id) => id ? `apps/support/tickets` : null,
    2: (id) => id ? `apps/support/tickets` : null,
    3: () => `apps/orders`,
    4: () => `registration-requests`,
    5: (id) => id ? `apps/bo-announcements/${id}` : `apps/bo-announcements`,
};
