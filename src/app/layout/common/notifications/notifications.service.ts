import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { AuthService } from 'app/core/auth/auth.service';
import { BONotifIcon, BONotifLink, Notification } from 'app/layout/common/notifications/notifications.types';
import { environment } from '@fuse/environments/environment';
import { map, Observable, of, ReplaySubject, tap } from 'rxjs';
import { BOHubService } from 'app/core/signalr/bo-hub.service';

interface BONotificationDto {
    id: number;
    type: number;
    title: string;
    description?: string;
    referenceId?: number | null;
    createdOn: string;
    isRead: boolean;
}

@Injectable({ providedIn: 'root' })
export class NotificationsService {
    private _notifications: ReplaySubject<Notification[]> = new ReplaySubject<Notification[]>(1);
    /** Local cache so we can prepend/update without re-fetching. */
    private _current: Notification[] = [];

    constructor(
        private _httpClient: HttpClient,
        private _authService: AuthService,
        private _boHub: BOHubService
    ) {
        // Push real-time notifications to the top of the list as they arrive.
        this._boHub.notification$.subscribe((dto) => {
            const notif = this._mapDto(dto);
            this._current = [notif, ...this._current];
            this._notifications.next(this._current);
        });
    }

    get notifications$(): Observable<Notification[]> {
        return this._notifications.asObservable();
    }

    private get _boUserId(): number | null {
        return this._authService.currentUser?.boUserId ?? null;
    }

    private _mapDto(dto: BONotificationDto): Notification {
        const linkFn = BONotifLink[dto.type];
        const link = linkFn ? linkFn(dto.referenceId) : null;
        return {
            id: String(dto.id),
            type: dto.type,
            title: dto.title,
            description: dto.description,
            time: dto.createdOn,
            icon: BONotifIcon[dto.type] ?? 'heroicons_outline:bell',
            referenceId: dto.referenceId,
            read: dto.isRead,
            ...(link ? { link, useRouter: true } : {}),
        };
    }

    getAll(): Observable<Notification[]> {
        const boUserId = this._boUserId;
        if (!boUserId) {
            this._notifications.next([]);
            return of([]);
        }

        // Start the SignalR connection (idempotent — only connects once).
        this._boHub.connect();

        return this._httpClient
            .get<BONotificationDto[]>(`${environment.apiUrl}/BONotifications`, { params: { boUserId: String(boUserId) } })
            .pipe(
                map((dtos) => dtos.map((d) => this._mapDto(d))),
                tap((notifications) => {
                    this._current = notifications;
                    this._notifications.next(notifications);
                })
            );
    }

    update(id: string, notification: Notification): Observable<Notification> {
        const boUserId = this._boUserId;
        if (!notification.read || !boUserId) return of(notification);
        return this._httpClient
            .post<void>(`${environment.apiUrl}/BONotifications/${id}/mark-read`, null, { params: { boUserId: String(boUserId) } })
            .pipe(
                map(() => notification),
                tap(() => {
                    const idx = this._current.findIndex((n) => n.id === id);
                    if (idx > -1) {
                        this._current[idx] = notification;
                        this._notifications.next([...this._current]);
                    }
                })
            );
    }

    delete(id: string): Observable<boolean> {
        return this._httpClient
            .delete<void>(`${environment.apiUrl}/BONotifications/${id}`)
            .pipe(
                map(() => true),
                tap(() => {
                    this._current = this._current.filter((n) => n.id !== id);
                    this._notifications.next([...this._current]);
                })
            );
    }

    markAllAsRead(): Observable<boolean> {
        const boUserId = this._boUserId;
        if (!boUserId) return of(false);
        return this._httpClient
            .post<void>(`${environment.apiUrl}/BONotifications/mark-all-read`, null, { params: { boUserId: String(boUserId) } })
            .pipe(
                map(() => true),
                tap(() => {
                    this._current = this._current.map((n) => ({ ...n, read: true }));
                    this._notifications.next([...this._current]);
                })
            );
    }

    create(notification: Notification): Observable<Notification> {
        return of(notification);
    }
}
