import { CommonModule } from '@angular/common';
import {
    ChangeDetectionStrategy,
    ChangeDetectorRef,
    Component,
    OnDestroy,
    OnInit,
    ViewEncapsulation,
    inject,
} from '@angular/core';
import { FormControl, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Router } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';

import { AuthService } from 'app/core/auth/auth.service';
import { BOHubService } from 'app/core/signalr/bo-hub.service';
import {
    BOAnnouncementsService,
    BOAnnouncementListItem,
} from '@fuse/services/announcements/bo-announcements.service';
import { BOAnnouncementWizardDialogComponent } from './wizard/bo-announcement-wizard-dialog.component';
import { ClaimsService } from '@fuse/services/claims/claims.service';
import { BoPermissionDirective } from '@fuse/directives/permission/bo-permission.directive';

@Component({
    selector: 'bo-announcements-list',
    templateUrl: './bo-announcements-list.component.html',
    encapsulation: ViewEncapsulation.None,
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: true,
    imports: [
        CommonModule,
        FormsModule,
        ReactiveFormsModule,
        MatButtonModule,
        MatDialogModule,
        MatFormFieldModule,
        MatIconModule,
        MatInputModule,
        MatProgressSpinnerModule,
        MatTooltipModule,
        BoPermissionDirective,
    ],
})
export class BOAnnouncementsListComponent implements OnInit, OnDestroy {
    readonly claimsService = inject(ClaimsService);

    loading = true;
    announcements: BOAnnouncementListItem[] = [];
    filtered: BOAnnouncementListItem[] = [];
    searchCtrl = new FormControl('');

    private _unsubscribeAll = new Subject<void>();

    constructor(
        private _api: BOAnnouncementsService,
        private _auth: AuthService,
        private _hub: BOHubService,
        private _dialog: MatDialog,
        private _router: Router,
        private _cdr: ChangeDetectorRef
    ) { }

    private get _boUserId(): number {
        return this._auth.currentUser?.boUserId ?? 0;
    }

    get boUserId(): number {
        return this._boUserId;
    }

    ngOnInit(): void {
        this.load();

        this._hub.boAnnouncement$
            .pipe(takeUntil(this._unsubscribeAll))
            .subscribe(() => this.load());

        this.searchCtrl.valueChanges
            .pipe(takeUntil(this._unsubscribeAll))
            .subscribe(() => this._applyFilter());
    }

    ngOnDestroy(): void {
        this._unsubscribeAll.next();
        this._unsubscribeAll.complete();
    }

    load(): void {
        const boUserId = this._boUserId;
        if (!boUserId) return;
        this.loading = true;
        this._cdr.markForCheck();

        this._api.getAll(boUserId).subscribe({
            next: (items) => {
                this.announcements = items ?? [];
                this._applyFilter();
            },
            error: () => {
                this.loading = false;
                this._cdr.markForCheck();
            },
            complete: () => {
                this.loading = false;
                this._cdr.markForCheck();
            },
        });
    }

    private _applyFilter(): void {
        const q = (this.searchCtrl.value ?? '').trim().toLowerCase();
        this.filtered = q
            ? this.announcements.filter(
                (a) =>
                    a.title?.toLowerCase().includes(q) ||
                    a.content?.toLowerCase().includes(q) ||
                    a.createdByFullName?.toLowerCase().includes(q)
            )
            : [...this.announcements];
        this.loading = false;
        this._cdr.markForCheck();
    }

    get unreadCount(): number {
        return this.announcements.filter((a) => !a.isRead).length;
    }

    openWizard(): void {
        const ref = this._dialog.open(BOAnnouncementWizardDialogComponent, {
            width: '960px',
            maxWidth: '95vw',
            maxHeight: '90vh',
            disableClose: true,
        });

        ref.afterClosed().subscribe((newId: number | null) => {
            if (newId) {
                this._router.navigate(['/apps/bo-announcements', newId]);
            }
        });
    }

    viewDetails(a: BOAnnouncementListItem): void {
        this._router.navigate(['/apps/bo-announcements', a.id]);
    }

    trackById = (_: number, a: BOAnnouncementListItem) => a.id;
}
