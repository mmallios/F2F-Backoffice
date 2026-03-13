import {
    ChangeDetectionStrategy,
    ChangeDetectorRef,
    Component,
    Inject,
    OnInit,
    ViewEncapsulation,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatDividerModule } from '@angular/material/divider';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { AllReportItem, FanCardUsageDetail, FanCardsAdminService } from '@fuse/services/fan-cards/fan-cards-admin.service';
import { AuthService } from 'app/core/auth/auth.service';
import {
    FanCardAllRequestsDialogComponent,
    FanCardAllRequestsDialogData,
} from '../fan-card-all-requests-dialog/fan-card-all-requests-dialog.component';

export interface FanCardReportResolveDialogData {
    report: AllReportItem;
    /** 'resolve' = action mode (pending → resolved); 'view' = read-only of resolved info */
    mode: 'resolve' | 'view';
}

@Component({
    selector: 'fan-card-report-resolve-dialog',
    templateUrl: './fan-card-report-resolve-dialog.component.html',
    encapsulation: ViewEncapsulation.None,
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: true,
    imports: [
        CommonModule,
        FormsModule,
        MatButtonModule,
        MatDialogModule,
        MatDividerModule,
        MatFormFieldModule,
        MatIconModule,
        MatInputModule,
        MatProgressBarModule,
        MatProgressSpinnerModule,
        MatTooltipModule,
    ],
})
export class FanCardReportResolveDialogComponent implements OnInit {

    comment: string;
    saving = false;

    loadingRequests = true;
    last3Requests: FanCardUsageDetail[] = [];

    readonly currentAdminName: string;
    readonly currentAdminImage: string | null;

    constructor(
        @Inject(MAT_DIALOG_DATA) public data: FanCardReportResolveDialogData,
        private _dialogRef: MatDialogRef<FanCardReportResolveDialogComponent>,
        private _service: FanCardsAdminService,
        private _dialog: MatDialog,
        private _auth: AuthService,
        private _cdr: ChangeDetectorRef,
    ) {
        this.comment = data.report.adminComment ?? '';
        const u = this._auth.currentUser;
        this.currentAdminName = u
            ? `${u.firstname ?? ''} ${u.lastname ?? ''}`.trim()
            : 'Άγνωστος admin';
        this.currentAdminImage = u?.image ?? null;
    }

    ngOnInit(): void {
        this._service.getRequests(this.data.report.fanCardId).subscribe({
            next: (items) => {
                this.last3Requests = items
                    .slice()
                    .sort((a, b) => new Date(b.usedAt).getTime() - new Date(a.usedAt).getTime())
                    .slice(0, 3);
                this.loadingRequests = false;
                this._cdr.markForCheck();
            },
            error: () => {
                this.loadingRequests = false;
                this._cdr.markForCheck();
            },
        });
    }

    openAllRequests(): void {
        this._dialog.open<FanCardAllRequestsDialogComponent, FanCardAllRequestsDialogData>(
            FanCardAllRequestsDialogComponent,
            {
                data: { fanCardId: this.data.report.fanCardId, cardCode: this.data.report.cardCode },
                width: '860px',
                maxWidth: '95vw',
            }
        );
    }

    get isResolveMode(): boolean {
        return this.data.mode === 'resolve';
    }

    resolve(): void {
        if (this.saving) return;
        this.saving = true;
        this._cdr.markForCheck();

        const adminId = this._auth.currentUserId;
        this._service.resolveReport(this.data.report.id, this.comment || null, adminId).subscribe({
            next: () => {
                this._dialogRef.close({
                    resolved: true,
                    comment: this.comment,
                    resolvedByBoUserFullName: this.currentAdminName,
                    resolvedByBoUserImage: this.currentAdminImage,
                    resolvedAt: new Date().toISOString(),
                });
            },
            error: () => {
                this.saving = false;
                this._cdr.markForCheck();
            },
        });
    }

    close(): void {
        this._dialogRef.close(null);
    }
}
