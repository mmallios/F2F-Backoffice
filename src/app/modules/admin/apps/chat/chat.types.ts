export interface BOChatMessage {
    id: number;
    senderBoUserId: number;
    senderName?: string;
    senderAvatar?: string;
    body: string;
    isDeleted: boolean;
    isMine: boolean;
    createdOn: string;
}

export interface BOChatSummary {
    id: number;
    contactBoUserId: number;
    contactName: string;
    contactAvatar?: string;
    contactEmail?: string;
    muted: boolean;
    pinned: boolean;
    archived: boolean;
    unreadCount: number;
    lastMessage?: string;
    lastMessageAt?: string;
    createdOn: string;
    isGroupChat?: false;
}

export interface BOChatDetail extends BOChatSummary {
    messages: BOChatMessage[];
}

export interface BOGroupChatMessage {
    id: number;
    senderBoUserId: number;
    senderName?: string;
    senderAvatar?: string;
    body: string;
    isDeleted: boolean;
    isMine: boolean;
    createdOn: string;
}

export interface BOGroupMember {
    boUserId: number;
    fullName: string;
    avatar?: string;
    isAdmin: boolean;
}

export interface BOGroupChatSummary {
    id: number;
    name: string;
    description?: string;
    imageUrl?: string;
    isGroupChat: true;
    memberCount: number;
    muted: boolean;
    pinned: boolean;
    archived: boolean;
    unreadCount: number;
    lastMessage?: string;
    lastMessageAt?: string;
    createdOn: string;
}

export interface BOGroupChatDetail extends BOGroupChatSummary {
    isAdmin: boolean;
    members: BOGroupMember[];
    messages: BOGroupChatMessage[];
}

export type ChatListItem = BOChatSummary | BOGroupChatSummary;

export interface BOAdminContact {
    boUserId: number;
    fullName: string;
    email?: string;
    avatar?: string;
}

