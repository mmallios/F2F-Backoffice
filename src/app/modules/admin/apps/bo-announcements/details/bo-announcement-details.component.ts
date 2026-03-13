import { CommonModule, DatePipe } from '@angular/common';
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
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';

import { FuseConfirmationService } from '@fuse/services/confirmation';
import { AuthService } from 'app/core/auth/auth.service';
import { BOHubService } from 'app/core/signalr/bo-hub.service';
import {
    BOAnnouncementsService,
    BOAnnouncementDetail,
} from '@fuse/services/announcements/bo-announcements.service';

@Component({
    selector: 'bo-announcement-details',
    templateUrl: './bo-announcement-details.component.html',
    encapsulation: ViewEncapsulation.None,
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: true,
    imports: [
        CommonModule,
        DatePipe,
        RouterModule,
        MatButtonModule,
        MatIconModule,
        MatSnackBarModule,
        MatTabsModule,
        MatTooltipModule,
    ],
})
export class BOAnnouncementDetailsComponent implements OnInit, OnDestroy {
    loading = true;
    deleting = false;
    item: BOAnnouncementDetail | null = null;
    countdownLabel = '';

    private _unsubscribeAll = new Subject<void>();
    private _countdownInterval: ReturnType<typeof setInterval> | null = null;

    constructor(
        private _api: BOAnnouncementsService,
        private _auth: AuthService,
        private _hub: BOHubService,
        private _confirm: FuseConfirmationService,
        private _route: ActivatedRoute,
        private _router: Router,
        private _snack: MatSnackBar,
        private _cdr: ChangeDetectorRef
    ) { }

    private get _boUserId(): number {
        return this._auth.currentUser?.boUserId ?? 0;
    }

    ngOnInit(): void {
        const id = Number(this._route.snapshot.paramMap.get('id'));

        // Join the per-announcement SignalR group for live read updates
        this._hub.joinAnnouncementGroup(id);

        // Subscribe to real-time read events
        this._hub.boAnnouncementRead$
            .pipe(takeUntil(this._unsubscribeAll))
            .subscribe((evt) => {
                if (!this.item || evt.announcementId !== this.item.id) return;

                // Avoid duplicates
                const alreadyInReads = this.item.reads.some((r) => r.boUserId === evt.boUserId);
                if (!alreadyInReads) {
                    this.item = {
                        ...this.item,
                        readCount: this.item.readCount + 1,
                        reads: [
                            ...this.item.reads,
                            { boUserId: evt.boUserId, fullName: evt.fullName ?? null, image: evt.image ?? null, readAt: evt.readAt },
                        ],
                        recipients: this.item.recipients.map((r) =>
                            r.boUserId === evt.boUserId ? { ...r, hasRead: true } : r
                        ),
                    };
                    this._cdr.markForCheck();
                }
            });

        this._api.getById(id, this._boUserId).subscribe({
            next: (data) => {
                this.item = data;
                this.loading = false;
                if (data.autoDeleteAt) this._startCountdown(data.autoDeleteAt);
                this._cdr.markForCheck();
            },
            error: () => {
                this.loading = false;
                this._snack.open('Σφάλμα κατά τη φόρτωση.', 'OK', { duration: 3000 });
                this._cdr.markForCheck();
            },
        });
    }

    ngOnDestroy(): void {
        this._stopCountdown();
        this._unsubscribeAll.next();
        this._unsubscribeAll.complete();
    }

    private _startCountdown(isoDate: string): void {
        this._stopCountdown();
        const target = new Date(isoDate).getTime();
        const tick = () => {
            const diff = target - Date.now();
            this.countdownLabel = diff <= 0 ? 'Σύντομα' : this._formatCountdown(diff);
            this._cdr.markForCheck();
        };
        tick();
        this._countdownInterval = setInterval(tick, 1000);
    }

    private _stopCountdown(): void {
        if (this._countdownInterval !== null) {
            clearInterval(this._countdownInterval);
            this._countdownInterval = null;
        }
    }

    private _formatCountdown(ms: number): string {
        const total = Math.floor(ms / 1000);
        const d = Math.floor(total / 86400);
        const h = Math.floor((total % 86400) / 3600);
        const m = Math.floor((total % 3600) / 60);
        const s = total % 60;
        if (d > 0) return `${d}μ ${h}ω ${m}λ`;
        if (h > 0) return `${h}ω ${m}λ ${s}δ`;
        return `${m}λ ${s}δ`;
    }

    get readPercentage(): number {
        if (!this.item || this.item.recipientCount === 0) return 0;
        return this.item.readCount / this.item.recipientCount;
    }

    get canDelete(): boolean {
        return this.item?.createdByBoUserId === this._boUserId;
    }

    delete(): void {
        if (!this.item) return;

        const dialogRef = this._confirm.open({
            title: 'Διαγραφή Ανακοίνωσης',
            message: `Είσαι σίγουρος ότι θέλεις να διαγράψεις την ανακοίνωση <strong>"${this.item.title}"</strong>;<br>Αυτή η ενέργεια δεν μπορεί να αναιρεθεί.`,
            icon: {
                show: true,
                name: 'heroicons_outline:exclamation-triangle',
                color: 'warn',
            },
            actions: {
                confirm: { label: 'Διαγραφή', color: 'warn' },
                cancel: { label: 'Ακύρωση' },
            },
        });

        dialogRef.afterClosed().subscribe((result) => {
            if (result !== 'confirmed' || !this.item) return;

            this.deleting = true;
            this._cdr.markForCheck();

            this._api.delete(this.item.id).subscribe({
                next: () => {
                    this._snack.open('Η ανακοίνωση διαγράφηκε.', 'OK', { duration: 3000 });
                    this._router.navigate(['/apps/bo-announcements']);
                },
                error: () => {
                    this.deleting = false;
                    this._snack.open('Σφάλμα κατά τη διαγραφή.', 'OK', { duration: 3000 });
                    this._cdr.markForCheck();
                },
            });
        });
    }

    back(): void {
        this._router.navigate(['/apps/bo-announcements']);
    }
}
