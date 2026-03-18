import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '@fuse/environments/environment';

export interface AnnouncementDto {
    id: number;
    code?: string | null;

    title: string;
    message?: string | null;

    thumbnail?: string | null;
    publishDate?: string | null;

    sendPushNotification?: boolean | null;

    isDeleted?: boolean | null;
    createdOn?: string | null;
    updatedOn?: string | null;

    createdByBoUserId?: number | null;
    createdByFullName?: string | null;
    createdByImage?: string | null;

    /** 0 = Pending, 1 = Published */
    status?: number | null;
}

export interface CreateAnnouncementRequest {
    title: string;
    message: string;
    thumbnail: string;
    createdByBoUserId?: number | null;
}

export interface UpdateAnnouncementRequest {
    title: string;
    code: string;
    message?: string | null;
    thumbnail?: string | null;
    publishDate?: string | null;
    sendPushNotification?: boolean | null;
    /** 0 = Pending, 1 = Published */
    status?: number | null;
    // PUT body matches Announcement entity properties
}

@Injectable({ providedIn: 'root' })
export class AnnouncementsService {
    private readonly base = `${environment.apiUrl}/announcement`;

    constructor(private http: HttpClient) { }

    getAll(): Observable<AnnouncementDto[]> {
        return this.http.get<AnnouncementDto[]>(`${this.base}/all`);
    }

    getById(id: number): Observable<AnnouncementDto> {
        return this.http.get<AnnouncementDto>(`${this.base}/${id}`);
    }

    create(payload: CreateAnnouncementRequest): Observable<AnnouncementDto> {
        return this.http.post<AnnouncementDto>(`${this.base}/new-announcement`, payload);
    }

    update(id: number, payload: UpdateAnnouncementRequest): Observable<AnnouncementDto> {
        return this.http.put<AnnouncementDto>(`${this.base}/${id}`, payload);
    }

    delete(id: number): Observable<void> {
        return this.http.delete<void>(`${this.base}/${id}`);
    }
}