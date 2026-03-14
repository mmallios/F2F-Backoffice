import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import {
    BOAdminContact,
    BOChatDetail,
    BOChatSummary,
    BOGroupChatDetail,
    BOGroupChatSummary,
    ChatListItem,
} from 'app/modules/admin/apps/chat/chat.types';
import {
    BehaviorSubject,
    Observable,
    Subject,
    forkJoin,
    map,
    tap,
} from 'rxjs';
import { environment } from '@fuse/environments/environment';
import { AuthService } from 'app/core/auth/auth.service';

@Injectable({ providedIn: 'root' })
export class ChatService {
    private readonly _api = environment.apiUrl;

    private _chats = new BehaviorSubject<ChatListItem[]>([]);
    private _activeChat = new BehaviorSubject<BOChatDetail | null>(null);
    private _activeGroupChat = new BehaviorSubject<BOGroupChatDetail | null>(null);
    private _adminContacts = new BehaviorSubject<BOAdminContact[]>([]);
    private _openQuickChat = new Subject<number>();

    constructor(
        private _http: HttpClient,
        private _auth: AuthService,
    ) { }

    //  Getters 

    get chats$(): Observable<ChatListItem[]> { return this._chats.asObservable(); }
    get activeChat$(): Observable<BOChatDetail | null> { return this._activeChat.asObservable(); }
    get activeGroupChat$(): Observable<BOGroupChatDetail | null> { return this._activeGroupChat.asObservable(); }
    get adminContacts$(): Observable<BOAdminContact[]> { return this._adminContacts.asObservable(); }
    get openQuickChat$(): Observable<number> { return this._openQuickChat.asObservable(); }

    requestOpenQuickChat(chatId: number): void {
        this._openQuickChat.next(chatId);
    }

    get myBoUserId(): number {
        return this._auth.currentUser?.boUserId ?? 0;
    }

    //  Load all chats 

    loadAll(): Observable<ChatListItem[]> {
        const uid = this.myBoUserId;
        return forkJoin([
            this._http.get<BOChatSummary[]>(`${this._api}/BOChats?boUserId=${uid}`),
            this._http.get<BOGroupChatSummary[]>(`${this._api}/BOGroupChats?boUserId=${uid}`),
        ]).pipe(
            map(([privates, groups]) => {
                const grouped = groups.map(g => ({ ...g, isGroupChat: true as const }));
                const all: ChatListItem[] = [
                    ...privates,
                    ...grouped,
                ].sort((a, b) => {
                    const da = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : new Date(a.createdOn).getTime();
                    const db = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : new Date(b.createdOn).getTime();
                    return db - da;
                });
                this._chats.next(all);
                return all;
            })
        );
    }

    //  Private chat 

    loadChatById(id: number): Observable<BOChatDetail> {
        return this._http
            .get<BOChatDetail>(`${this._api}/BOChats/${id}?boUserId=${this.myBoUserId}`)
            .pipe(tap(chat => this._activeChat.next(chat)));
    }

    openOrCreateChat(otherBoUserId: number): Observable<{ id: number }> {
        return this._http.post<{ id: number }>(`${this._api}/BOChats/open`, {
            myBoUserId: this.myBoUserId,
            otherBoUserId,
        });
    }

    sendMessage(chatId: number, body: string): Observable<any> {
        return this._http.post(`${this._api}/BOChats/${chatId}/messages`, {
            senderBoUserId: this.myBoUserId,
            body,
        }).pipe(
            tap((msg: any) => {
                const current = this._activeChat.getValue();
                if (current && current.id === chatId) {
                    this._activeChat.next({
                        ...current,
                        messages: [...current.messages, msg],
                        lastMessage: msg.body,
                        lastMessageAt: msg.createdOn,
                    });
                }
                this._refreshChatInList(chatId, false, msg);
            })
        );
    }

    updateChatSettings(chatId: number, settings: { muted?: boolean; pinned?: boolean; archived?: boolean }): Observable<void> {
        return this._http.patch<void>(`${this._api}/BOChats/${chatId}/settings`, {
            boUserId: this.myBoUserId,
            ...settings,
        }).pipe(
            tap(() => {
                const chats = this._chats.getValue();
                this._chats.next(chats.map(c =>
                    c.id === chatId && !c.isGroupChat ? { ...c, ...settings } : c
                ));
                const active = this._activeChat.getValue();
                if (active?.id === chatId) {
                    this._activeChat.next({ ...active, ...settings });
                }
            })
        );
    }

    markChatRead(chatId: number): Observable<void> {
        // Optimistically clear badge immediately
        this._chats.next(this._chats.getValue().map(c =>
            c.id === chatId && !c.isGroupChat ? { ...c, unreadCount: 0 } : c
        ));
        return this._http.post<void>(`${this._api}/BOChats/${chatId}/mark-read?boUserId=${this.myBoUserId}`, {});
    }

    //  Group chat 

    loadGroupChatById(id: number): Observable<BOGroupChatDetail> {
        return this._http
            .get<BOGroupChatDetail>(`${this._api}/BOGroupChats/${id}?boUserId=${this.myBoUserId}`)
            .pipe(tap(chat => this._activeGroupChat.next(chat)));
    }

    createGroupChat(name: string, description: string | null, memberBoUserIds: number[], imageUrl?: string | null): Observable<{ id: number }> {
        return this._http.post<{ id: number }>(`${this._api}/BOGroupChats`, {
            name,
            description,
            createdByBoUserId: this.myBoUserId,
            memberBoUserIds,
            ...(imageUrl ? { imageUrl } : {}),
        });
    }

    sendGroupMessage(groupId: number, body: string): Observable<any> {
        return this._http.post(`${this._api}/BOGroupChats/${groupId}/messages`, {
            senderBoUserId: this.myBoUserId,
            body,
        }).pipe(
            tap((msg: any) => {
                const current = this._activeGroupChat.getValue();
                if (current && current.id === groupId) {
                    this._activeGroupChat.next({
                        ...current,
                        messages: [...current.messages, msg],
                        lastMessage: `${msg.senderName}: ${msg.body}`,
                        lastMessageAt: msg.createdOn,
                    });
                }
                this._refreshChatInList(groupId, true, msg);
            })
        );
    }

    updateGroupSettings(groupId: number, settings: { muted?: boolean; pinned?: boolean; archived?: boolean }): Observable<void> {
        return this._http.patch<void>(`${this._api}/BOGroupChats/${groupId}/settings`, {
            boUserId: this.myBoUserId,
            ...settings,
        }).pipe(
            tap(() => {
                const chats = this._chats.getValue();
                this._chats.next(chats.map(c =>
                    c.id === groupId && c.isGroupChat ? { ...c, ...settings } : c
                ));
                const active = this._activeGroupChat.getValue();
                if (active?.id === groupId) {
                    this._activeGroupChat.next({ ...active, ...settings });
                }
            })
        );
    }

    markGroupRead(groupId: number): Observable<void> {
        // Optimistically clear badge immediately
        this._chats.next(this._chats.getValue().map(c =>
            c.id === groupId && c.isGroupChat ? { ...c, unreadCount: 0 } : c
        ));
        return this._http.post<void>(`${this._api}/BOGroupChats/${groupId}/mark-read?boUserId=${this.myBoUserId}`, {});
    }

    //  Admin contacts 

    loadAdminContacts(): Observable<BOAdminContact[]> {
        return this._http
            .get<BOAdminContact[]>(`${this._api}/BOGroupChats/admins?boUserId=${this.myBoUserId}`)
            .pipe(tap(contacts => this._adminContacts.next(contacts)));
    }

    //  Realtime helpers 

    onNewPrivateMessage(chatId: number, msg: any): void {
        const enriched = { ...msg, isMine: msg.senderBoUserId === this.myBoUserId };
        const current = this._activeChat.getValue();
        if (current && current.id === chatId) {
            this._activeChat.next({ ...current, messages: [...current.messages, enriched] });
            // Conversation is open — auto mark as read
            this.markChatRead(chatId).subscribe();
        }
        this._refreshChatInList(chatId, false, enriched);
    }

    onNewGroupMessage(groupId: number, msg: any): void {
        const enriched = { ...msg, isMine: msg.senderBoUserId === this.myBoUserId };
        const current = this._activeGroupChat.getValue();
        if (current && current.id === groupId) {
            this._activeGroupChat.next({ ...current, messages: [...current.messages, enriched] });
            // Conversation is open — auto mark as read
            this.markGroupRead(groupId).subscribe();
        }
        this._refreshChatInList(groupId, true, enriched);
    }

    onNewGroupChatInvite(): void {
        this.loadAll().subscribe();
    }

    resetActiveChat(): void {
        this._activeChat.next(null);
        this._activeGroupChat.next(null);
    }

    private _refreshChatInList(id: number, isGroup: boolean, msg: any): void {
        const chats = this._chats.getValue();
        const idx = chats.findIndex(c => c.id === id && !!c.isGroupChat === isGroup);
        if (idx === -1) {
            this.loadAll().subscribe();
            return;
        }
        // Increment unread only for incoming messages (not mine) when conversation is not open
        const isConversationActive = isGroup
            ? this._activeGroupChat.getValue()?.id === id
            : this._activeChat.getValue()?.id === id;
        const shouldIncrementUnread = msg.isMine === false && !isConversationActive;
        const updated = {
            ...chats[idx],
            lastMessage: isGroup ? `${msg.senderName}: ${msg.body}` : msg.body,
            lastMessageAt: msg.createdOn,
            unreadCount: shouldIncrementUnread
                ? (chats[idx].unreadCount ?? 0) + 1
                : chats[idx].unreadCount,
        };
        const copy = [...chats];
        copy.splice(idx, 1);
        copy.unshift(updated);
        this._chats.next(copy);
    }

    get totalUnread$(): Observable<number> {
        return this._chats.pipe(
            map(list => list.reduce((sum, c) => sum + (c.unreadCount ?? 0), 0))
        );
    }
}
