import { ScrollStrategy, ScrollStrategyOptions } from '@angular/cdk/overlay';
import { TextFieldModule } from '@angular/cdk/text-field';
import { DOCUMENT, DatePipe, NgClass, NgTemplateOutlet } from '@angular/common';
import {
    AfterViewInit,
    ChangeDetectionStrategy,
    ChangeDetectorRef,
    Component,
    ElementRef,
    HostBinding,
    HostListener,
    Inject,
    NgZone,
    OnDestroy,
    OnInit,
    Renderer2,
    ViewChild,
    ViewEncapsulation,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { FuseScrollbarDirective } from '@fuse/directives/scrollbar';
import { ChatService } from 'app/modules/admin/apps/chat/chat.service';
import {
    BOChatDetail,
    BOChatSummary,
    BOGroupChatDetail,
    BOGroupChatSummary,
    ChatListItem,
} from 'app/modules/admin/apps/chat/chat.types';
import { Subject, takeUntil } from 'rxjs';

@Component({
    selector: 'quick-chat',
    templateUrl: './quick-chat.component.html',
    styleUrls: ['./quick-chat.component.scss'],
    encapsulation: ViewEncapsulation.None,
    changeDetection: ChangeDetectionStrategy.OnPush,
    exportAs: 'quickChat',
    standalone: true,
    imports: [
        NgClass,
        NgTemplateOutlet,
        MatIconModule,
        MatButtonModule,
        FuseScrollbarDirective,
        MatFormFieldModule,
        MatInputModule,
        TextFieldModule,
        FormsModule,
        DatePipe,
    ],
})
export class QuickChatComponent implements OnInit, AfterViewInit, OnDestroy {
    @ViewChild('messageInput') messageInput: ElementRef;

    chats: ChatListItem[] = [];
    activeChat: BOChatDetail | null = null;
    activeGroupChat: BOGroupChatDetail | null = null;
    opened = false;
    conversationVisible = false;
    messageText = '';
    sending = false;

    private _mutationObserver: MutationObserver;
    private _scrollStrategy: ScrollStrategy;
    private _overlay: HTMLElement;
    private _unsubscribeAll = new Subject<void>();

    constructor(
        @Inject(DOCUMENT) private _document: Document,
        private _elementRef: ElementRef,
        private _renderer2: Renderer2,
        private _ngZone: NgZone,
        private _chatService: ChatService,
        private _changeDetectorRef: ChangeDetectorRef,
        private _scrollStrategyOptions: ScrollStrategyOptions,
    ) {
        this._scrollStrategy = this._scrollStrategyOptions.block();
    }

    @HostBinding('class') get classList(): any {
        return { 'quick-chat-opened': this.opened };
    }

    @HostListener('input')
    @HostListener('ngModelChange')
    _resizeMessageInput(): void {
        this._ngZone.runOutsideAngular(() => {
            setTimeout(() => {
                if (!this.messageInput) return;
                this.messageInput.nativeElement.style.height = 'auto';
                this.messageInput.nativeElement.style.height = `${this.messageInput.nativeElement.scrollHeight}px`;
            });
        });
    }

    ngOnInit(): void {
        this._chatService.chats$
            .pipe(takeUntil(this._unsubscribeAll))
            .subscribe(chats => {
                this.chats = chats;
                this._changeDetectorRef.markForCheck();
            });

        this._chatService.activeChat$
            .pipe(takeUntil(this._unsubscribeAll))
            .subscribe(chat => {
                this.activeChat = chat;
                if (chat) this.activeGroupChat = null;
                this._changeDetectorRef.markForCheck();
            });

        this._chatService.activeGroupChat$
            .pipe(takeUntil(this._unsubscribeAll))
            .subscribe(chat => {
                this.activeGroupChat = chat;
                if (chat) this.activeChat = null;
                this._changeDetectorRef.markForCheck();
            });

        this._chatService.openQuickChat$
            .pipe(takeUntil(this._unsubscribeAll))
            .subscribe(chatId => {
                this._chatService.loadChatById(chatId).subscribe({
                    next: () => {
                        this.conversationVisible = true;
                        this._toggleOpened(true);
                        this._changeDetectorRef.markForCheck();
                    },
                });
            });
    }

    ngAfterViewInit(): void {
        this._mutationObserver = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                const mutationTarget = mutation.target as HTMLElement;
                if (mutation.attributeName === 'class') {
                    if (mutationTarget.classList.contains('cdk-global-scrollblock')) {
                        const top = parseInt(mutationTarget.style.top, 10);
                        this._renderer2.setStyle(this._elementRef.nativeElement, 'margin-top', `${Math.abs(top)}px`);
                    } else {
                        this._renderer2.setStyle(this._elementRef.nativeElement, 'margin-top', null);
                    }
                }
            });
        });
        this._mutationObserver.observe(this._document.documentElement, {
            attributes: true,
            attributeFilter: ['class'],
        });
    }

    ngOnDestroy(): void {
        this._mutationObserver.disconnect();
        this._unsubscribeAll.next();
        this._unsubscribeAll.complete();
    }

    open(): void {
        if (this.opened) return;
        this._toggleOpened(true);
    }

    close(): void {
        if (!this.opened) return;
        this.conversationVisible = false;
        this._toggleOpened(false);
    }

    toggle(): void {
        if (this.opened) this.close();
        else this.open();
    }

    selectChat(item: ChatListItem): void {
        this.conversationVisible = true;
        this._toggleOpened(true);
        // Optimistically clear badge immediately (markChatRead/markGroupRead update _chats synchronously)
        if (item.unreadCount > 0) {
            if (item.isGroupChat) {
                this._chatService.markGroupRead(item.id).subscribe();
            } else {
                this._chatService.markChatRead(item.id).subscribe();
            }
        }
        if (item.isGroupChat) {
            this._chatService.loadGroupChatById(item.id).subscribe({
                next: () => { },
            });
        } else {
            this._chatService.loadChatById(item.id).subscribe({
                next: () => { },
            });
        }
    }

    get selectedName(): string {
        if (this.activeChat) return this.activeChat.contactName ?? '';
        if (this.activeGroupChat) return this.activeGroupChat.name ?? '';
        return '';
    }

    get selectedAvatar(): string | null {
        if (this.activeChat) return this.activeChat.contactAvatar ?? null;
        if (this.activeGroupChat) return this.activeGroupChat.imageUrl ?? null;
        return null;
    }

    get isGroupSelected(): boolean {
        return !!this.activeGroupChat;
    }

    get messages(): any[] {
        return this.activeChat?.messages ?? this.activeGroupChat?.messages ?? [];
    }

    get hasActiveConversation(): boolean {
        return this.conversationVisible && !!(this.activeChat || this.activeGroupChat);
    }

    get totalPrivateUnread(): number {
        return this.chats
            .filter(c => !c.isGroupChat)
            .reduce((sum, c) => sum + (c.unreadCount ?? 0), 0);
    }

    getChatName(c: ChatListItem): string {
        return c.isGroupChat
            ? (c as BOGroupChatSummary).name
            : (c as BOChatSummary).contactName ?? '';
    }

    getChatAvatar(c: ChatListItem): string | null {
        return c.isGroupChat
            ? (c as BOGroupChatSummary).imageUrl ?? null
            : (c as BOChatSummary).contactAvatar ?? null;
    }

    isSelected(c: ChatListItem): boolean {
        if (!this.conversationVisible) return false;
        if (this.activeChat) return !c.isGroupChat && c.id === this.activeChat.id;
        if (this.activeGroupChat) return !!c.isGroupChat && c.id === this.activeGroupChat.id;
        return false;
    }

    sendMessage(): void {
        const text = this.messageText.trim();
        if (!text || this.sending) return;
        this.sending = true;
        this.messageText = '';
        if (this.activeChat) {
            this._chatService.sendMessage(this.activeChat.id, text).subscribe({
                next: () => { this.sending = false; this._changeDetectorRef.markForCheck(); },
                error: () => { this.sending = false; this._changeDetectorRef.markForCheck(); },
            });
        } else if (this.activeGroupChat) {
            this._chatService.sendGroupMessage(this.activeGroupChat.id, text).subscribe({
                next: () => { this.sending = false; this._changeDetectorRef.markForCheck(); },
                error: () => { this.sending = false; this._changeDetectorRef.markForCheck(); },
            });
        }
    }

    onEnterKey(event: KeyboardEvent): void {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            this.sendMessage();
        }
    }

    isSameDay(a: string, b: string): boolean {
        return new Date(a).toDateString() === new Date(b).toDateString();
    }

    trackByFn(index: number, item: any): any {
        return item.id || index;
    }

    private _showOverlay(): void {
        this._hideOverlay();
        this._overlay = this._renderer2.createElement('div');
        if (!this._overlay) return;
        this._overlay.classList.add('quick-chat-overlay');
        this._renderer2.appendChild(this._elementRef.nativeElement.parentElement, this._overlay);
        this._scrollStrategy.enable();
        this._overlay.addEventListener('click', () => {
            this._ngZone.run(() => this.close());
        });
    }

    private _hideOverlay(): void {
        if (!this._overlay) return;
        this._overlay.parentNode.removeChild(this._overlay);
        this._overlay = null;
        this._scrollStrategy.disable();
    }

    private _toggleOpened(open: boolean): void {
        this.opened = open;
        this._changeDetectorRef.markForCheck();
        if (open) this._showOverlay();
        else this._hideOverlay();
    }
}
