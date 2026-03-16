import { Component, OnDestroy, OnInit, ViewEncapsulation } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { ActivatedRoute, Router, RouterOutlet } from '@angular/router';
import { FuseFullscreenComponent } from '@fuse/components/fullscreen';
import { FuseLoadingBarComponent } from '@fuse/components/loading-bar';
import {
    FuseNavigationService,
    FuseVerticalNavigationComponent,
} from '@fuse/components/navigation';
import { FuseMediaWatcherService } from '@fuse/services/media-watcher';
import { User } from '@fuse/services/users/users.service';
import { AuthService } from 'app/core/auth/auth.service';
import { BOHubService } from 'app/core/signalr/bo-hub.service';
import { ChatService } from 'app/modules/admin/apps/chat/chat.service';
import { BOToastComponent } from 'app/layout/common/bo-toast/bo-toast.component';
import { NavigationService } from 'app/core/navigation/navigation.service';
import { Navigation } from 'app/core/navigation/navigation.types';
import { UserService } from 'app/core/user/user.service';
import { NotificationsService } from 'app/layout/common/notifications/notifications.service';
import { Notification as AppNotification } from 'app/layout/common/notifications/notifications.types';

import { LanguagesComponent } from 'app/layout/common/languages/languages.component';
import { MessagesComponent } from 'app/layout/common/messages/messages.component';
import { NotificationsComponent } from 'app/layout/common/notifications/notifications.component';
import { QuickChatComponent } from 'app/layout/common/quick-chat/quick-chat.component';
import { SearchComponent } from 'app/layout/common/search/search.component';
import { ShortcutsComponent } from 'app/layout/common/shortcuts/shortcuts.component';
import { UserComponent } from 'app/layout/common/user/user.component';
import { Subject, takeUntil } from 'rxjs';

@Component({
    selector: 'classy-layout',
    templateUrl: './classy.component.html',
    encapsulation: ViewEncapsulation.None,
    standalone: true,
    imports: [
        FuseLoadingBarComponent,
        FuseVerticalNavigationComponent,
        NotificationsComponent,
        UserComponent,
        MatIconModule,
        MatButtonModule,
        LanguagesComponent,
        FuseFullscreenComponent,
        SearchComponent,
        ShortcutsComponent,
        MessagesComponent,
        RouterOutlet,
        QuickChatComponent,
        BOToastComponent,
    ],
})
export class ClassyLayoutComponent implements OnInit, OnDestroy {
    isScreenSmall: boolean;
    navigation: Navigation;
    user: User;
    unreadMessages: number = 0;
    unreadNotifications: number = 0;
    notifDropdownOpen = false;
    unreadNotifSnapshot: AppNotification[] = [];
    private _allNotifications: AppNotification[] = [];
    private _unsubscribeAll: Subject<any> = new Subject<any>();

    /**
     * Constructor
     */
    constructor(
        private _activatedRoute: ActivatedRoute,
        private _router: Router,
        private _navigationService: NavigationService,
        private _userService: UserService,
        private _fuseMediaWatcherService: FuseMediaWatcherService,
        private _fuseNavigationService: FuseNavigationService,
        private _authService: AuthService,
        private _boHub: BOHubService,
        private _chatService: ChatService,
        private _notificationsService: NotificationsService,
    ) { }

    // -----------------------------------------------------------------------------------------------------
    // @ Accessors
    // -----------------------------------------------------------------------------------------------------

    /**
     * Getter for current year
     */
    get currentYear(): number {
        return new Date().getFullYear();
    }

    // -----------------------------------------------------------------------------------------------------
    // @ Lifecycle hooks
    // -----------------------------------------------------------------------------------------------------

    /**
     * On init
     */
    ngOnInit(): void {
        // Subscribe to navigation data
        this._navigationService.navigation$
            .pipe(takeUntil(this._unsubscribeAll))
            .subscribe((navigation: Navigation) => {
                this.navigation = navigation;
            });

        // Subscribe to the user service
        this._userService.user$
            .pipe(takeUntil(this._unsubscribeAll))
            .subscribe((user: User) => {
                this.user = user;
            });

        // Subscribe to media changes
        this._fuseMediaWatcherService.onMediaChange$
            .pipe(takeUntil(this._unsubscribeAll))
            .subscribe(({ matchingAliases }) => {
                this.isScreenSmall = !matchingAliases.includes('md');
            });

        // Wire SignalR chat events → ChatService
        this._boHub.boChatMessage$
            .pipe(takeUntil(this._unsubscribeAll))
            .subscribe(dto => this._chatService.onNewPrivateMessage(dto.chatId, dto.message));

        this._boHub.boGroupChatMessage$
            .pipe(takeUntil(this._unsubscribeAll))
            .subscribe(dto => this._chatService.onNewGroupMessage(dto.groupChatId, dto.message));

        this._boHub.boNewGroupChat$
            .pipe(takeUntil(this._unsubscribeAll))
            .subscribe(() => this._chatService.onNewGroupChatInvite());

        // Update chat nav badge with total unread count
        this._chatService.totalUnread$
            .pipe(takeUntil(this._unsubscribeAll))
            .subscribe(count => {
                this.unreadMessages = count;
                const navComponent = this._fuseNavigationService.getComponent<FuseVerticalNavigationComponent>('mainNavigation');
                if (!navComponent) return;
                const item = this._fuseNavigationService.getItem('apps.chat', navComponent.navigation);
                if (!item) return;
                if (count > 0) {
                    item.badge = { title: count.toString(), classes: 'bg-primary text-white text-xs font-medium rounded-full' };
                } else {
                    item.badge = null;
                }
                navComponent.refresh();
            });

        // Track unread notifications count
        this._notificationsService.notifications$
            .pipe(takeUntil(this._unsubscribeAll))
            .subscribe(notifications => {
                this._allNotifications = notifications;
                this.unreadNotifications = notifications.filter(n => !n.read).length;
                this._updateNavBadges(notifications);
            });
    }

    /**
     * On destroy
     */
    ngOnDestroy(): void {
        // Unsubscribe from all subscriptions
        this._unsubscribeAll.next(null);
        this._unsubscribeAll.complete();
    }

    // -----------------------------------------------------------------------------------------------------
    // @ Public methods
    // -----------------------------------------------------------------------------------------------------

    /**
     * Toggle navigation
     *
     * @param name
     */
    toggleNavigation(name: string): void {
        // Get the navigation
        const navigation =
            this._fuseNavigationService.getComponent<FuseVerticalNavigationComponent>(
                name
            );

        if (navigation) {
            // Toggle the opened status
            navigation.toggle();
        }
    }

    toggleNotifDropdown(): void {
        if (!this.notifDropdownOpen) {
            this.unreadNotifSnapshot = this._allNotifications.filter(n => !n.read);
            if (this.unreadNotifSnapshot.length > 0) {
                this._notificationsService.markAllAsRead().subscribe();
            }
        }
        this.notifDropdownOpen = !this.notifDropdownOpen;
    }

    private _updateNavBadges(notifications: AppNotification[]): void {
        const navComponent = this._fuseNavigationService.getComponent<FuseVerticalNavigationComponent>('mainNavigation');
        if (!navComponent) return;

        const supportCount = notifications.filter(n => !n.read && (n.type === 1 || n.type === 2)).length;
        const ordersCount = notifications.filter(n => !n.read && n.type === 3).length;
        const regCount = notifications.filter(n => !n.read && n.type === 4).length;

        this._setNavBadge('apps.support.tickets', supportCount, navComponent);
        this._setNavBadge('apps.orders', ordersCount, navComponent);
        this._setNavBadge('apps.registration-requests', regCount, navComponent);

        navComponent.refresh();
    }

    private _setNavBadge(id: string, count: number, navComponent: FuseVerticalNavigationComponent): void {
        const item = this._fuseNavigationService.getItem(id, navComponent.navigation);
        if (!item) return;
        item.badge = count > 0
            ? { title: `(${count})`, classes: 'text-red-500 font-semibold text-sm' }
            : null;
    }

    signOut(): void {
        this._boHub.disconnect();
        this._authService.signOut().subscribe(() => {
            this._router.navigate(['/sign-in']);
        });
    }
}
