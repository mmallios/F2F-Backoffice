import { Injectable } from '@angular/core';
import * as signalR from '@microsoft/signalr';
import { environment } from '@fuse/environments/environment';
import { Subject } from 'rxjs';

export interface BOHubNotificationDto {
    id: number;
    type: number;
    title: string;
    description?: string;
    referenceId?: number | null;
    createdOn: string;
    isRead: boolean;
}

@Injectable({ providedIn: 'root' })
export class BOHubService {
    private _connection: signalR.HubConnection | null = null;

    /** Emits every real-time notification pushed by the server. */
    readonly notification$ = new Subject<BOHubNotificationDto>();

    /**
     * Start the SignalR connection to /api/hubs/bo-notifications.
     * Safe to call multiple times — connects only once.
     */
    connect(): void {
        if (this._connection) return;

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

        this._connection
            .start()
            .catch((err) => console.error('[BOHub] Connection failed:', err));
    }

    /** Stop the connection (call on sign-out). */
    disconnect(): void {
        if (this._connection) {
            this._connection.off('NewBONotification');
            this._connection.stop();
            this._connection = null;
        }
    }
}
