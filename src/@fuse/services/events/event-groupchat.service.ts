import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '@fuse/environments/environment';

export interface EventGroupChatMessageDto {
    id: string;
    senderUserId: number;
    senderName: string | null;
    senderAvatar: string | null;
    body: string;
    sentAtUtc: string;
    hasImages: boolean;
    hasAudio: boolean;
}

export interface EventGroupChatDto {
    exists: boolean;
    id: number | null;
    eventId: number;
    name: string | null;
    isActive: boolean;
    isPaused: boolean;
    isEventChat: boolean;
    activatesAt: string | null;
    deactivatesAt: string | null;
    totalMessages: number;
    messages: EventGroupChatMessageDto[];
}

export interface UpdateEventGroupChatDto {
    name?: string;
    description?: string;
    activatesAt?: string;
    deactivatesAt?: string;
}

@Injectable({ providedIn: 'root' })
export class EventGroupChatService {

    private readonly base = environment.apiUrl;

    constructor(private http: HttpClient) { }

    /** GET /api/BOEventGroupChat/{eventId} */
    getForEvent(eventId: number): Observable<EventGroupChatDto> {
        return this.http.get<EventGroupChatDto>(`${this.base}/BOEventGroupChat/${eventId}`);
    }

    /** PATCH /api/BOEventGroupChat/{eventId} */
    update(eventId: number, dto: UpdateEventGroupChatDto): Observable<void> {
        return this.http.patch<void>(`${this.base}/BOEventGroupChat/${eventId}`, dto);
    }

    /** POST /api/BOEventGroupChat/{eventId}/activate */
    activate(eventId: number): Observable<void> {
        return this.http.post<void>(`${this.base}/BOEventGroupChat/${eventId}/activate`, {});
    }

    /** POST /api/BOEventGroupChat/{eventId}/deactivate */
    deactivate(eventId: number): Observable<void> {
        return this.http.post<void>(`${this.base}/BOEventGroupChat/${eventId}/deactivate`, {});
    }
}
