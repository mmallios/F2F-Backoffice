import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '@fuse/environments/environment';

// ─── DTOs ────────────────────────────────────────────────────────────────────

export interface BORecipientDto {
    boUserId: number;
    fullName: string;
    image?: string | null;
    email?: string | null;
    hasRead: boolean;
}

export interface BOReadDto {
    boUserId: number;
    fullName: string;
    image?: string | null;
    readAt: string;
}

export interface BOAnnouncementListItem {
    id: number;
    title: string;
    content?: string | null;
    imageUrl?: string | null;
    publishDate?: string | null;
    autoDeleteAt?: string | null;
    sendEmailNotification: boolean;
    createdByBoUserId: number;
    createdByFullName?: string | null;
    createdByImage?: string | null;
    createdOn: string;
    recipientCount: number;
    readCount: number;
    isRead: boolean;
    isDeleted: boolean;
    isDeletedOn?: string | null;
}

export interface BOAnnouncementDetail extends BOAnnouncementListItem {
    recipients: BORecipientDto[];
    reads: BOReadDto[];
}

export interface CreateBOAnnouncementRequest {
    title: string;
    content?: string | null;
    imageUrl?: string | null;
    publishDate?: string | null;
    autoDeleteAt?: string | null;
    sendEmailNotification: boolean;
    createdByBoUserId: number;
    recipientBoUserIds: number[];
}

export interface BOAnnouncementNotifDto {
    id: number;
    title: string;
    imageUrl?: string | null;
    createdOn: string;
    createdByFullName?: string | null;
}

export interface BOAnnouncementReadNotifDto {
    announcementId: number;
    boUserId: number;
    fullName?: string | null;
    image?: string | null;
    readAt: string;
}

// ─── Service ─────────────────────────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class BOAnnouncementsService {
    private readonly base = `${environment.apiUrl}/BOAnnouncements`;

    constructor(private _http: HttpClient) { }

    getAll(boUserId: number): Observable<BOAnnouncementListItem[]> {
        return this._http.get<BOAnnouncementListItem[]>(this.base, { params: { boUserId } });
    }

    getById(id: number, boUserId: number): Observable<BOAnnouncementDetail> {
        return this._http.get<BOAnnouncementDetail>(`${this.base}/${id}`, { params: { boUserId } });
    }

    create(payload: CreateBOAnnouncementRequest): Observable<BOAnnouncementListItem> {
        return this._http.post<BOAnnouncementListItem>(this.base, payload);
    }

    delete(id: number): Observable<void> {
        return this._http.delete<void>(`${this.base}/${id}`);
    }
}
