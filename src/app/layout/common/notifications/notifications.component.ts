import { animate, style, transition, trigger } from '@angular/animations';
import { DatePipe, NgClass, NgTemplateOutlet } from '@angular/common';
import {
    ChangeDetectionStrategy,
    ChangeDetectorRef,
    Component,
    OnDestroy,
    OnInit,
    ViewEncapsulation,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RouterLink, Router } from '@angular/router';
import { NotificationsService } from 'app/layout/common/notifications/notifications.service';
import { BONotifIcon, BONotifLabel, BONotifType, Notification } from 'app/layout/common/notifications/notifications.types';
import { Subject, takeUntil } from 'rxjs';

@Component({
    selector: 'notifications',
    templateUrl: './notifications.component.html',
    styleUrls: ['./notifications.component.scss'],
    encapsulation: ViewEncapsulation.None,
    changeDetection: ChangeDetectionStrategy.OnPush,
    exportAs: 'notifications',
    standalone: true,
    imports: [
        MatButtonModule,
        MatIconModule,
        MatTooltipModule,
        NgClass,
        NgTemplateOutlet,
        RouterLink,
        DatePipe,
    ],
    animations: [
        trigger('slideInRight', [
            transition(':enter', [
                style({ transform: 'translateX(100%)' }),
                animate('280ms cubic-bezier(0.4, 0, 0.2, 1)', style({ transform: 'translateX(0)' })),
            ]),
            transition(':leave', [
                animate('240ms cubic-bezier(0.4, 0, 0.2, 1)', style({ transform: 'translateX(100%)' })),
            ]),
        ]),
        trigger('fadeIn', [
            transition(':enter', [
                style({ opacity: 0 }),
                animate('200ms ease-out', style({ opacity: 1 })),
            ]),
            transition(':leave', [
                animate('200ms ease-in', style({ opacity: 0 })),
            ]),
        ]),
    ],
})
export class NotificationsComponent implements OnInit, OnDestroy {

    notifications: Notification[] = [];
    unreadCount: number = 0;
    panelOpen: boolean = false;
    selectedNotification: Notification | null = null;
    detailModalOpen: boolean = false;
    readonly BONotifIcon = BONotifIcon;
    readonly BONotifLabel = BONotifLabel;
    readonly BONotifType = BONotifType;

    private _unsubscribeAll: Subject<any> = new Subject<any>();

    constructor(
        private _changeDetectorRef: ChangeDetectorRef,
        private _notificationsService: NotificationsService,
        private _router: Router,
    ) { }

    // ─── Lifecycle ────────────────────────────────────────────────────────────

    ngOnInit(): void {
        this._notificationsService.notifications$
            .pipe(takeUntil(this._unsubscribeAll))
            .subscribe((notifications: Notification[]) => {
                this.notifications = notifications;
                this._calculateUnreadCount();
                this._changeDetectorRef.markForCheck();
            });
    }

    ngOnDestroy(): void {
        this._unsubscribeAll.next(null);
        this._unsubscribeAll.complete();
    }

    // ─── Panel ────────────────────────────────────────────────────────────────

    openPanel(): void {
        this.panelOpen = true;
        this._changeDetectorRef.markForCheck();
    }

    closePanel(): void {
        this.panelOpen = false;
        this._changeDetectorRef.markForCheck();
    }

    // ─── Actions ─────────────────────────────────────────────────────────────

    markAllAsRead(): void {
        this._notificationsService.markAllAsRead().subscribe();
    }

    openDetail(notification: Notification): void {
        this.selectedNotification = notification;
        this.detailModalOpen = true;
        this._changeDetectorRef.markForCheck();
        if (!notification.read) {
            notification.read = true;
            this._notificationsService.update(notification.id, notification).subscribe();
        }
    }

    closeDetail(): void {
        this.detailModalOpen = false;
        this.selectedNotification = null;
        this._changeDetectorRef.markForCheck();
    }

    goToRegistrationRequests(): void {
        this.closeDetail();
        this.closePanel();
        this._router.navigateByUrl('/apps/registration-requests');
    }

    goToSupportTicket(): void {
        const id = this.selectedNotification?.referenceId;
        if (!id) return;
        this.closeDetail();
        this.closePanel();
        this._router.navigate(['/apps/support/tickets', id]);
    }

    goToOrder(): void {
        const code = this.selectedNotification?.referenceCode;
        if (!code) return;
        this.closeDetail();
        this.closePanel();
        this._router.navigate(['/apps/orders', code]);
    }

    toggleRead(notification: Notification): void {
        notification.read = !notification.read;
        this._notificationsService.update(notification.id, notification).subscribe();
    }

    delete(notification: Notification): void {
        this._notificationsService.delete(notification.id).subscribe();
    }

    trackByFn(index: number, item: any): any {
        return item.id || index;
    }

    // ─── Private ─────────────────────────────────────────────────────────────

    private _calculateUnreadCount(): void {
        this.unreadCount = this.notifications
            ? this.notifications.filter((n) => !n.read).length
            : 0;
    }
}
