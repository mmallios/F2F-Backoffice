import {
    ChangeDetectionStrategy,
    ChangeDetectorRef,
    Component,
    Input,
    OnDestroy,
    OnInit,
    ViewEncapsulation,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDrawer } from '@angular/material/sidenav';
import { Router } from '@angular/router';
import { ChatService } from 'app/modules/admin/apps/chat/chat.service';
import { BOAdminContact } from 'app/modules/admin/apps/chat/chat.types';
import { Subject, takeUntil } from 'rxjs';

@Component({
    selector: 'chat-new-chat',
    templateUrl: './new-chat.component.html',
    encapsulation: ViewEncapsulation.None,
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: true,
    imports: [MatButtonModule, MatIconModule, MatProgressSpinnerModule],
})
export class NewChatComponent implements OnInit, OnDestroy {
    @Input() drawer: MatDrawer;
    contacts: BOAdminContact[] = [];
    loading = false;
    private _unsubscribeAll = new Subject<void>();

    constructor(
        private _chatService: ChatService,
        private _router: Router,
        private _cdr: ChangeDetectorRef,
    ) { }

    ngOnInit(): void {
        this._chatService.adminContacts$
            .pipe(takeUntil(this._unsubscribeAll))
            .subscribe(contacts => {
                this.contacts = contacts;
                this._cdr.markForCheck();
            });
    }

    ngOnDestroy(): void {
        this._unsubscribeAll.next();
        this._unsubscribeAll.complete();
    }

    openChat(contact: BOAdminContact): void {
        this.loading = true;
        this._chatService.openOrCreateChat(contact.boUserId).subscribe({
            next: (res) => {
                this.loading = false;
                this.drawer.close();
                this._router.navigate(['/apps/chat/chat', res.id]);
                this._cdr.markForCheck();
            },
            error: () => { this.loading = false; this._cdr.markForCheck(); }
        });
    }

    trackByFn(index: number, item: any): any {
        return item.boUserId || index;
    }
}
