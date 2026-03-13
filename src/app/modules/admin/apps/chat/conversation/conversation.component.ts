import { TextFieldModule } from '@angular/cdk/text-field';
import { DatePipe, NgClass, NgTemplateOutlet } from '@angular/common';
import {
    ChangeDetectionStrategy,
    ChangeDetectorRef,
    Component,
    ElementRef,
    HostListener,
    NgZone,
    OnDestroy,
    OnInit,
    ViewChild,
    ViewEncapsulation,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatMenuModule } from '@angular/material/menu';
import { MatSidenavModule } from '@angular/material/sidenav';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FuseMediaWatcherService } from '@fuse/services/media-watcher';
import { ChatService } from 'app/modules/admin/apps/chat/chat.service';
import { ContactInfoComponent } from 'app/modules/admin/apps/chat/contact-info/contact-info.component';
import {
    BOChatDetail,
    BOGroupChatDetail,
    BOChatMessage,
    BOGroupChatMessage,
} from 'app/modules/admin/apps/chat/chat.types';
import { Subject, takeUntil } from 'rxjs';

@Component({
    selector: 'chat-conversation',
    templateUrl: './conversation.component.html',
    encapsulation: ViewEncapsulation.None,
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: true,
    imports: [
        MatSidenavModule,
        ContactInfoComponent,
        MatButtonModule,
        RouterLink,
        MatIconModule,
        MatMenuModule,
        NgClass,
        MatFormFieldModule,
        MatInputModule,
        TextFieldModule,
        FormsModule,
        DatePipe,
        NgTemplateOutlet,
    ],
})
export class ConversationComponent implements OnInit, OnDestroy {
    @ViewChild('messageInput') messageInput: ElementRef;
    @ViewChild('messagesContainer') messagesContainer: ElementRef;

    chat: BOChatDetail | null = null;
    groupChat: BOGroupChatDetail | null = null;
    isGroup = false;

    messageText = '';
    sending = false;

    drawerMode: 'over' | 'side' = 'side';
    drawerOpened = false;

    private _unsubscribeAll = new Subject<void>();

    constructor(
        private _changeDetectorRef: ChangeDetectorRef,
        private _chatService: ChatService,
        private _fuseMediaWatcherService: FuseMediaWatcherService,
        private _ngZone: NgZone,
        private _activatedRoute: ActivatedRoute,
        private _router: Router,
    ) { }

    @HostListener('input')
    @HostListener('ngModelChange')
    _resizeMessageInput(): void {
        this._ngZone.runOutsideAngular(() => {
            setTimeout(() => {
                if (!this.messageInput?.nativeElement) return;
                this.messageInput.nativeElement.style.height = 'auto';
                this._changeDetectorRef.detectChanges();
                this.messageInput.nativeElement.style.height =
                    `${this.messageInput.nativeElement.scrollHeight}px`;
                this._changeDetectorRef.detectChanges();
            });
        });
    }

    ngOnInit(): void {
        this._activatedRoute.data
            .pipe(takeUntil(this._unsubscribeAll))
            .subscribe(data => {
                this.isGroup = data['type'] === 'group';
                this._changeDetectorRef.markForCheck();
            });

        this._chatService.activeChat$
            .pipe(takeUntil(this._unsubscribeAll))
            .subscribe(chat => {
                this.chat = chat;
                this._changeDetectorRef.markForCheck();
                this._scrollToBottom();
                // Mark as read when conversation opens with unread messages
                if (chat && chat.unreadCount > 0) {
                    this._chatService.markChatRead(chat.id).subscribe();
                }
            });

        this._chatService.activeGroupChat$
            .pipe(takeUntil(this._unsubscribeAll))
            .subscribe(chat => {
                this.groupChat = chat;
                this._changeDetectorRef.markForCheck();
                this._scrollToBottom();
                // Mark as read when conversation opens with unread messages
                if (chat && chat.unreadCount > 0) {
                    this._chatService.markGroupRead(chat.id).subscribe();
                }
            });

        this._fuseMediaWatcherService.onMediaChange$
            .pipe(takeUntil(this._unsubscribeAll))
            .subscribe(({ matchingAliases }) => {
                this.drawerMode = matchingAliases.includes('lg') ? 'side' : 'over';
                this._changeDetectorRef.markForCheck();
            });
    }

    ngOnDestroy(): void {
        this._unsubscribeAll.next();
        this._unsubscribeAll.complete();
    }

    get currentChat(): BOChatDetail | BOGroupChatDetail | null {
        return this.isGroup ? this.groupChat : this.chat;
    }

    get messages(): (BOChatMessage | BOGroupChatMessage)[] {
        return this.currentChat?.messages ?? [];
    }

    get chatTitle(): string {
        if (!this.currentChat) return '';
        if (this.isGroup) return (this.currentChat as BOGroupChatDetail).name;
        return (this.currentChat as BOChatDetail).contactName ?? '';
    }

    get chatAvatar(): string | undefined {
        if (!this.currentChat) return undefined;
        if (this.isGroup) return (this.currentChat as BOGroupChatDetail).imageUrl ?? undefined;
        return (this.currentChat as BOChatDetail).contactAvatar ?? undefined;
    }

    get isMuted(): boolean { return this.currentChat?.muted ?? false; }
    get isPinned(): boolean { return this.currentChat?.pinned ?? false; }

    sendMessage(): void {
        const body = this.messageText.trim();
        if (!body || this.sending || !this.currentChat) return;

        this.sending = true;
        const id = this.currentChat.id;
        const obs = this.isGroup
            ? this._chatService.sendGroupMessage(id, body)
            : this._chatService.sendMessage(id, body);

        obs.subscribe({
            next: () => {
                this.messageText = '';
                this.sending = false;
                if (this.messageInput?.nativeElement) {
                    this.messageInput.nativeElement.style.height = 'auto';
                }
                this._changeDetectorRef.markForCheck();
                this._scrollToBottom();
            },
            error: () => { this.sending = false; this._changeDetectorRef.markForCheck(); }
        });
    }

    onEnterKey(event: KeyboardEvent): void {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            this.sendMessage();
        }
    }

    toggleMute(): void {
        if (!this.currentChat) return;
        const muted = !this.currentChat.muted;
        const id = this.currentChat.id;
        (this.isGroup
            ? this._chatService.updateGroupSettings(id, { muted })
            : this._chatService.updateChatSettings(id, { muted })
        ).subscribe();
    }

    togglePin(): void {
        if (!this.currentChat) return;
        const pinned = !this.currentChat.pinned;
        const id = this.currentChat.id;
        (this.isGroup
            ? this._chatService.updateGroupSettings(id, { pinned })
            : this._chatService.updateChatSettings(id, { pinned })
        ).subscribe();
    }

    openContactInfo(): void {
        this.drawerOpened = true;
        this._changeDetectorRef.markForCheck();
    }

    resetChat(): void {
        this._chatService.resetActiveChat();
        this.drawerOpened = false;
        this._changeDetectorRef.markForCheck();
    }

    trackByFn(index: number, item: any): any {
        return item.id || index;
    }

    isSameDay(a: string, b: string): boolean {
        return new Date(a).toDateString() === new Date(b).toDateString();
    }

    private _scrollToBottom(): void {
        this._ngZone.runOutsideAngular(() => {
            setTimeout(() => {
                if (this.messagesContainer?.nativeElement) {
                    this.messagesContainer.nativeElement.scrollTop =
                        this.messagesContainer.nativeElement.scrollHeight;
                }
            }, 50);
        });
    }
}
