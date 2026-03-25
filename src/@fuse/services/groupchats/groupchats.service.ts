import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '@fuse/environments/environment';

export interface GroupChat {
    id: number;
    createdOn: string;
    updatedOn?: string | null;

    code: string;
    name: string;
    description?: string | null;

    eventId?: number | null;
    isMain: boolean;
    messages?: string | null;

    image?: string | null;
    isActive: boolean;
    isPaused: boolean;
}

export interface CreateGroupChatDto {
    code: string;
    name: string;
    description?: string | null;

    eventId?: number | null;
    isMain: boolean;

    image?: string | null;
    isActive: boolean;
}

export interface ChatMessage {
    id: string;
    userId: number;
    value: string;              // mapped from body
    createdAt: Date;            // mapped from sentAtUtc
    isMine: boolean;

    readAt?: Date | null;
    isDeleted: boolean;

    replyTo?: ReplyPreviewDto | null;
    reactions?: ReactionDto[] | null;

    // optional UI helpers
    senderName?: string;
    senderAvatar?: string;
}


export interface GroupMessageDto {
    id: string;
    senderUserId: number;
    body: string;
    sentAtUtc: string;
    readAtUtc?: string | null;
    isDeleted: boolean;
    replyTo?: ReplyPreviewDto | null;
    reactions?: ReactionDto[] | null;
    images?: { url: string; fileName?: string }[];
    audios?: { url: string }[];
}

export interface ReplyPreviewDto {
    messageId: string;
    senderUserId: number;
    body: string;
}

export interface ReactionDto {
    emoji: string;
    count: number;
    reactedByUserIds?: number[];
}

export interface UpdateGroupChatDto {
    name?: string | null;
    description?: string | null;
    eventId?: number | null;
    isMain?: boolean | null;
    image?: string | null;
    isActive?: boolean | null;
}



@Injectable({ providedIn: 'root' })
export class GroupChatsService {
    private readonly baseUrl = environment.apiUrl;

    constructor(private http: HttpClient) { }

    // GET /groupchats/all
    // groupchats.service.ts (FIXED)
    getAll(isFromBackoffice = false): Observable<GroupChat[]> {
        const params = isFromBackoffice ? '?isFromBackoffice=true' : '';
        return this.http.get<any[]>(`${this.baseUrl}/groupchat/all${params}`).pipe(
            map((rows) => (rows ?? []).map((x) => this.mapGroupChat(x)))
        );
    }



    // POST /groupchats  (adjust to your backend)
    create(dto: CreateGroupChatDto): Observable<any> {
        return this.http.post(`${this.baseUrl}/groupchat`, dto);
    }

    getByCode(code: string): Observable<GroupChat> {
        return this.http.get<GroupChat>(`${this.baseUrl}/groupchat/by-code/${code}`);
    }

    // -------- mapper --------
    private mapGroupChat(x: any): GroupChat {
        return {
            id: Number(x.id ?? x.Id ?? 0),
            createdOn: String(x.createdOn ?? x.CreatedOn ?? ''),
            updatedOn: x.updatedOn ?? x.UpdatedOn ?? null,

            code: String(x.code ?? x.Code ?? ''),
            name: String(x.name ?? x.Name ?? ''),
            description: (x.description ?? x.Description ?? null),

            eventId: (x.eventId ?? x.EventId ?? null) == null ? null : Number(x.eventId ?? x.EventId),
            isMain: Boolean(x.isMain ?? x.IsMain ?? false),
            messages: (x.messages ?? x.Messages ?? null),

            image: (x.image ?? x.Image ?? null),
            isActive: Boolean(x.isActive ?? x.IsActive ?? false),
            isPaused: Boolean(x.isPaused ?? x.IsPaused ?? false),
        };
    }

    private mapMessage(x: any): GroupMessageDto {
        return {
            id: String(x.id ?? x.Id),
            senderUserId: Number(x.senderUserId ?? x.SenderUserId),
            body: String(x.body ?? x.Body ?? ''),
            sentAtUtc: String(x.sentAtUtc ?? x.SentAtUtc),
            readAtUtc: x.readAtUtc ?? x.ReadAtUtc ?? null,
            isDeleted: Boolean(x.isDeleted ?? x.IsDeleted ?? false),
            replyTo: x.replyTo ?? x.ReplyTo ?? null,
            reactions: x.reactions ?? x.Reactions ?? [],
            images: (x.images ?? x.Images ?? []).map((img: any) => ({
                url: String(img.url ?? img.Url ?? img),
                fileName: img.fileName ?? img.FileName ?? undefined,
            })),
            audios: (x.audios ?? x.Audios ?? []).map((aud: any) => ({
                url: String(aud.url ?? aud.Url ?? aud),
            })),
        };
    }


    mapGroupMessageToChat(
        m: GroupMessageDto,
        currentUserId: number
    ): ChatMessage {
        return {
            id: m.id,
            userId: m.senderUserId,
            value: m.isDeleted ? '<i>Message deleted</i>' : m.body,
            createdAt: new Date(m.sentAtUtc),
            isMine: m.senderUserId === currentUserId,

            readAt: m.readAtUtc ? new Date(m.readAtUtc) : null,
            isDeleted: m.isDeleted,

            replyTo: m.replyTo ?? null,
            reactions: m.reactions ?? [],
        };
    }

    getMessages(groupId: number, take?: number, sinceUtc?: Date | string | null): Observable<GroupMessageDto[]> {
        let params = new HttpParams();
        if (take != null) params = params.set('take', String(take));

        if (sinceUtc) {
            const iso = typeof sinceUtc === 'string' ? sinceUtc : sinceUtc.toISOString();
            params = params.set('sinceUtc', iso);
        }

        return this.http
            .get<any[]>(`${this.baseUrl}/groupchat/${groupId}/messages`, { params })
            .pipe(map(rows => (rows ?? []).map(r => this.mapMessage(r))));
    }

    updateGroupChat(id: number, dto: UpdateGroupChatDto): Observable<any> {
        return this.http.put(`${this.baseUrl}/groupchat/${id}`, dto);
    }

    addMessage(groupId: number, dto: { senderUserId: number; body: string; replyToMessageId?: string | null; images?: string[]; audios?: string[] }) {
        return this.http.post<GroupMessageDto>(`${this.baseUrl}/groupchat/${groupId}/messages`, dto);
    }

    getMembers(groupId: number): Observable<{ userId: number; isAdmin: boolean }[]> {
        return this.http.get<any[]>(`${this.baseUrl}/groupchat/${groupId}/users`).pipe(
            map(rows => (rows ?? []).map(x => ({
                userId: Number(x.userId ?? x.UserId),
                isAdmin: Boolean(x.isAdmin ?? x.IsAdmin ?? false)
            })))
        );
    }

    joinGroup(groupId: number, userId: number): Observable<void> {
        return this.http.post<void>(`${this.baseUrl}/groupchat/${groupId}/join`, { userId });
    }

    pauseGroupChat(groupId: number, userId: number): Observable<any> {
        return this.http.post(`${this.baseUrl}/groupchat/${groupId}/pause`, { userId });
    }

    unpauseGroupChat(groupId: number, userId: number): Observable<any> {
        return this.http.post(`${this.baseUrl}/groupchat/${groupId}/unpause`, { userId });
    }

    deleteGroupChat(groupId: number): Observable<void> {
        return this.http.delete<void>(`${this.baseUrl}/BOGroupChats/${groupId}`);
    }
}
