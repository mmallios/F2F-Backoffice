import {
    ChangeDetectionStrategy,
    ChangeDetectorRef,
    Component,
    Inject,
    OnInit,
    ViewEncapsulation,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTooltipModule } from '@angular/material/tooltip';
import {
    FanCardListItem,
    FanCardReportDetail,
    FanCardUsageDetail,
    FanCardsAdminService,
} from '@fuse/services/fan-cards/fan-cards-admin.service';

@Component({
    selector: 'fan-card-details-dialog',
    templateUrl: './fan-card-details-dialog.component.html',
    encapsulation: ViewEncapsulation.None,
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: true,
    imports: [
        CommonModule,
        MatButtonModule,
        MatDialogModule,
        MatIconModule,
        MatProgressBarModule,
        MatTabsModule,
        MatTooltipModule,
    ],
})
export class FanCardDetailsDialogComponent implements OnInit {

    loadingUsages = true;
    loadingRequests = true;
    loadingReports = true;

    usages: FanCardUsageDetail[] = [];
    requests: FanCardUsageDetail[] = [];
    reports: FanCardReportDetail[] = [];

    readonly PAGE_SIZE = 8;
    usagesPage = 0;
    requestsPage = 0;
    reportsPage = 0;

    get pagedUsages() { return this.usages.slice(this.usagesPage * this.PAGE_SIZE, (this.usagesPage + 1) * this.PAGE_SIZE); }
    get usagesTotalPages() { return Math.ceil(this.usages.length / this.PAGE_SIZE); }
    get pagedRequests() { return this.requests.slice(this.requestsPage * this.PAGE_SIZE, (this.requestsPage + 1) * this.PAGE_SIZE); }
    get requestsTotalPages() { return Math.ceil(this.requests.length / this.PAGE_SIZE); }
    get pagedReports() { return this.reports.slice(this.reportsPage * this.PAGE_SIZE, (this.reportsPage + 1) * this.PAGE_SIZE); }
    get reportsTotalPages() { return Math.ceil(this.reports.length / this.PAGE_SIZE); }

    constructor(
        public dialogRef: MatDialogRef<FanCardDetailsDialogComponent>,
        @Inject(MAT_DIALOG_DATA) public card: FanCardListItem,
        private _service: FanCardsAdminService,
        private _cdr: ChangeDetectorRef,
    ) { }

    ngOnInit(): void {
        this._service.getUsages(this.card.id).subscribe({
            next: (data) => {
                this.usages = data;
                this.loadingUsages = false;
                this._cdr.markForCheck();
            },
            error: () => {
                this.loadingUsages = false;
                this._cdr.markForCheck();
            },
        });

        this._service.getRequests(this.card.id).subscribe({
            next: (data) => {
                this.requests = data;
                this.loadingRequests = false;
                this._cdr.markForCheck();
            },
            error: () => {
                this.loadingRequests = false;
                this._cdr.markForCheck();
            },
        });

        this._service.getReports(this.card.id).subscribe({
            next: (data) => {
                this.reports = data;
                this.loadingReports = false;
                this._cdr.markForCheck();
            },
            error: () => {
                this.loadingReports = false;
                this._cdr.markForCheck();
            },
        });
    }

    reportStatusLabel(status: number): string {
        return status === 2 ? 'Επιλύθηκε' : 'Εκκρεμεί';
    }

    close(): void {
        this.dialogRef.close();
    }
}
