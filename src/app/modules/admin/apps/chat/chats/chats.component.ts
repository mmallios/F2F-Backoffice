import { DatePipe, NgClass } from '@angular/common';
import {
    ChangeDetectionStrategy,
    ChangeDetectorRef,
    Component,
    OnDestroy,
    OnInit,
    ViewEncapsulation,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatMenuModule } from '@angular/material/menu';
import { MatSidenavModule } from '@angular/material/sidenav';
import { RouterLink, RouterOutlet } from '@angular/router';
import { AuthService } from 'app/core/auth/auth.service';
import {
    BOChatSummary,
    BOGroupChatSummary,
    ChatListItem,
} from 'app/modules/admin/apps/chat/chat.types';
import { ChatService } from 'app/modules/admin/apps/chat/chat.service';
import { NewChatComponent } from 'app/modules/admin/apps/chat/new-chat/new-chat.component';
import { ProfileComponent } from 'app/modules/admin/apps/chat/profile/profile.component';
import { NewGroupChatDialogComponent } from 'app/modules/admin/apps/chat/new-group-chat-dialog/new-group-chat-dialog.component';
import { Subject, takeUntil } from 'rxjs';

@Component({
    selector: 'chat-chats',
    templateUrl: './chats.component.html',
    encapsulation: ViewEncapsulation.None,
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: true,
    imports: [
        MatSidenavModule,
        NewChatComponent,
        ProfileComponent,
        MatButtonModule,
        MatIconModule,
        MatMenuModule,
        MatFormFieldModule,
        MatInputModule,
        MatDialogModule,
        NgClass,
        DatePipe,
        RouterLink,
        RouterOutlet,
    ],
})
export class ChatsComponent implements OnInit, OnDestroy {
    chats: ChatListItem[] = [];
    filteredChats: ChatListItem[] = [];
    activeTab: 'all' | 'group' | 'private' = 'all';
    selectedChatId: number | null = null;
    selectedIsGroup: boolean = false;
    drawerComponent: 'profile' | 'new-chat';
    drawerOpened: boolean = false;

    private _lastSearch = '';
    private _unsubscribeAll = new Subject<void>();

    constructor(
        private _chatService: ChatService,
        private _auth: AuthService,
        private _changeDetectorRef: ChangeDetectorRef,
        private _dialog: MatDialog,
    ) { }

    get myProfile() {
        return this._auth.currentUser;
    }

    get totalUnread(): number {
        return this.chats.reduce((sum, c) => sum + (c.unreadCount || 0), 0);
    }

    ngOnInit(): void {
        this._chatService.chats$
            .pipe(takeUntil(this._unsubscribeAll))
            .subscribe(chats => {
                this.chats = chats;
                this._applyFilter(this._lastSearch);
                this._changeDetectorRef.markForCheck();
            });

        this._chatService.activeChat$
            .pipe(takeUntil(this._unsubscribeAll))
            .subscribe(chat => {
                if (chat) {
                    this.selectedChatId = chat.id;
                    this.selectedIsGroup = false;
                }
                this._changeDetectorRef.markForCheck();
            });

        this._chatService.activeGroupChat$
            .pipe(takeUntil(this._unsubscribeAll))
            .subscribe(chat => {
                if (chat) {
                    this.selectedChatId = chat.id;
                    this.selectedIsGroup = true;
                }
                this._changeDetectorRef.markForCheck();
            });
    }

    ngOnDestroy(): void {
        this._unsubscribeAll.next();
        this._unsubscribeAll.complete();
        this._chatService.resetActiveChat();
    }

    setTab(tab: 'all' | 'group' | 'private'): void {
        this.activeTab = tab;
        this._applyFilter(this._lastSearch);
        this._changeDetectorRef.markForCheck();
    }

    filterChats(query: string): void {
        this._lastSearch = query;
        this._applyFilter(query);
    }

    private _applyFilter(query: string): void {
        let result = this.chats;
        if (this.activeTab === 'group') {
            result = result.filter(c => !!c.isGroupChat);
        } else if (this.activeTab === 'private') {
            result = result.filter(c => !c.isGroupChat);
        }
        if (query) {
            const q = query.toLowerCase();
            result = result.filter(c => {
                const name = c.isGroupChat
                    ? (c as BOGroupChatSummary).name
                    : (c as BOChatSummary).contactName;
                return name?.toLowerCase().includes(q);
            });
        }
        this.filteredChats = result;
        this._changeDetectorRef.markForCheck();
    }

    getChatName(c: ChatListItem): string {
        return c.isGroupChat
            ? (c as BOGroupChatSummary).name
            : (c as BOChatSummary).contactName ?? '';
    }

    getChatAvatar(c: ChatListItem): string | undefined {
        return c.isGroupChat
            ? (c as BOGroupChatSummary).imageUrl ?? undefined
            : (c as BOChatSummary).contactAvatar ?? undefined;
    }

    getChatInitial(c: ChatListItem): string {
        return this.getChatName(c).charAt(0).toUpperCase();
    }

    getRouterLink(c: ChatListItem): string[] {
        return c.isGroupChat ? ['group', c.id.toString()] : ['chat', c.id.toString()];
    }

    isSelected(c: ChatListItem): boolean {
        return this.selectedChatId === c.id && !!c.isGroupChat === this.selectedIsGroup;
    }

    openNewChat(): void {
        this.drawerComponent = 'new-chat';
        this.drawerOpened = true;
        this._changeDetectorRef.markForCheck();
    }

    openNewGroup(): void {
        const dialogRef = this._dialog.open(NewGroupChatDialogComponent, {
            width: '500px',
            data: { myBoUserId: this.myProfile?.boUserId },
        });
        dialogRef.afterClosed().subscribe((created: boolean) => {
            if (created) {
                this._chatService.loadAll().subscribe();
            }
        });
    }

    openProfile(): void {
        this.drawerComponent = 'profile';
        this.drawerOpened = true;
        this._changeDetectorRef.markForCheck();
    }

    trackByFn(index: number, item: any): any {
        return item.id || index;
    }
}
