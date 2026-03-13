import { Injectable } from '@angular/core';
import * as signalR from '@microsoft/signalr';
import { environment } from '@fuse/environments/environment';
import { Subject } from 'rxjs';
import { BOAnnouncementNotifDto, BOAnnouncementReadNotifDto } from '@fuse/services/announcements/bo-announcements.service';

export interface BOHubNotificationDto {
    id: number;
    type: number;
    title: string;
    description?: string;
    referenceId?: number | null;
    createdOn: string;
    isRead: boolean;
}

export interface BOChatMessageSignalRDto {
    chatId: number;
    message: any;
}

export interface BOGroupChatMessageSignalRDto {
    groupChatId: number;
    message: any;
}

@Injectable({ providedIn: 'root' })
export class BOHubService {
    private _connection: signalR.HubConnection | null = null;

    /** Emits every real-time notification pushed by the server. */
    readonly notification$ = new Subject<BOHubNotificationDto>();

    /** Emits when the server pushes a new BO announcement. */
    readonly boAnnouncement$ = new Subject<BOAnnouncementNotifDto>();

    /** Emits when a recipient reads a BO announcement (real-time update for details page). */
    readonly boAnnouncementRead$ = new Subject<BOAnnouncementReadNotifDto>();

    /** Emits when a new private BO chat message arrives via SignalR. */
    readonly boChatMessage$ = new Subject<BOChatMessageSignalRDto>();

    /** Emits when a new group chat message arrives via SignalR. */
    readonly boGroupChatMessage$ = new Subject<BOGroupChatMessageSignalRDto>();

    /** Emits when the user is added to a new BO group chat. */
    readonly boNewGroupChat$ = new Subject<void>();

    /**
     * Start the SignalR connection to /api/hubs/bo-notifications.
     * Safe to call multiple times — connects only once.
     * @param boUserId Current admin's BOUser.Id — used to join the personal group.
     */
    connect(boUserId?: number): void {
        if (this._connection) {
            // If already connected but boUserId supplied, join personal group
            if (boUserId) {
                this._connection
                    .invoke('JoinPersonalGroup', boUserId)
                    .catch((err) => console.error('[BOHub] JoinPersonalGroup failed:', err));
            }
            return;
        }

        // Derive the hub URL from the API URL (strip the trailing /api segment)
        const hubUrl =
            environment.apiUrl.replace(/\/api$/, '') + '/api/hubs/bo-notifications';

        this._connection = new signalR.HubConnectionBuilder()
            .withUrl(hubUrl)
            .withAutomaticReconnect()
            .configureLogging(signalR.LogLevel.Warning)
            .build();

        this._connection.on('NewBONotification', (dto: BOHubNotificationDto) => {
            this.notification$.next(dto);
        });

        this._connection.on('NewBOAnnouncement', (dto: BOAnnouncementNotifDto) => {
            this.boAnnouncement$.next(dto);
        });

        this._connection.on('BOAnnouncementRead', (dto: BOAnnouncementReadNotifDto) => {
            this.boAnnouncementRead$.next(dto);
        });

        this._connection.on('NewBOChatMessage', (dto: BOChatMessageSignalRDto) => {
            this.boChatMessage$.next(dto);
        });

        this._connection.on('NewBOGroupChatMessage', (dto: BOGroupChatMessageSignalRDto) => {
            this.boGroupChatMessage$.next(dto);
        });

        this._connection.on('NewBOGroupChat', () => {
            this.boNewGroupChat$.next();
        });

        this._connection
            .start()
            .then(() => {
                if (boUserId) {
                    this._connection!
                        .invoke('JoinPersonalGroup', boUserId)
                        .catch((err) => console.error('[BOHub] JoinPersonalGroup failed:', err));
                }
            })
            .catch((err) => console.error('[BOHub] Connection failed:', err));
    }

    /** Stop the connection (call on sign-out). */
    disconnect(): void {
        if (this._connection) {
            this._connection.off('NewBONotification');
            this._connection.off('NewBOAnnouncement');
            this._connection.off('BOAnnouncementRead');
            this._connection.off('NewBOChatMessage');
            this._connection.off('NewBOGroupChatMessage');
            this._connection.off('NewBOGroupChat');
            this._connection.stop();
            this._connection = null;
        }
    }

    /** Join the per-announcement SignalR group to receive live read updates. */
    joinAnnouncementGroup(announcementId: number): void {
        if (!this._connection || announcementId <= 0) return;
        this._connection
            .invoke('JoinAnnouncementGroup', announcementId)
            .catch((err) => console.error('[BOHub] JoinAnnouncementGroup failed:', err));
    }
}
