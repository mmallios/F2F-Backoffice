import {
    ChangeDetectionStrategy,
    ChangeDetectorRef,
    Component,
    Inject,
    OnInit,
    ViewEncapsulation,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';
import { debounceTime, distinctUntilChanged, merge } from 'rxjs';
import { FanCardUsageDetail, FanCardsAdminService } from '@fuse/services/fan-cards/fan-cards-admin.service';

export interface FanCardAllRequestsDialogData {
    fanCardId: number;
    cardCode?: string | null;
}

@Component({
    selector: 'fan-card-all-requests-dialog',
    templateUrl: './fan-card-all-requests-dialog.component.html',
    encapsulation: ViewEncapsulation.None,
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: true,
    imports: [
        CommonModule,
        ReactiveFormsModule,
        MatButtonModule,
        MatDialogModule,
        MatFormFieldModule,
        MatIconModule,
        MatInputModule,
        MatProgressBarModule,
        MatSelectModule,
        MatTooltipModule,
    ],
})
export class FanCardAllRequestsDialogComponent implements OnInit {

    loading = true;
    allItems: FanCardUsageDetail[] = [];
    filtered: FanCardUsageDetail[] = [];

    searchCtrl = new FormControl<string>('');
    statusCtrl = new FormControl<boolean | null>(null);

    constructor(
        @Inject(MAT_DIALOG_DATA) public data: FanCardAllRequestsDialogData,
        private _dialogRef: MatDialogRef<FanCardAllRequestsDialogComponent>,
        private _service: FanCardsAdminService,
        private _cdr: ChangeDetectorRef,
    ) { }

    ngOnInit(): void {
        this._service.getRequests(this.data.fanCardId).subscribe({
            next: (items) => {
                this.allItems = items.slice().sort(
                    (a, b) => new Date(b.usedAt).getTime() - new Date(a.usedAt).getTime()
                );
                this._applyFilters();
                this.loading = false;
                this._cdr.markForCheck();
            },
            error: () => {
                this.loading = false;
                this._cdr.markForCheck();
            },
        });

        merge(
            this.searchCtrl.valueChanges.pipe(debounceTime(200), distinctUntilChanged()),
            this.statusCtrl.valueChanges,
        ).subscribe(() => {
            this._applyFilters();
            this._cdr.markForCheck();
        });
    }

    private _applyFilters(): void {
        const q = (this.searchCtrl.value ?? '').trim().toLowerCase();
        const statusFilter = this.statusCtrl.value;

        this.filtered = this.allItems.filter((r) => {
            if (statusFilter !== null && r.used !== statusFilter) return false;
            if (q) {
                const haystack = [
                    r.usedByFullName,
                    r.usedByCode,
                    r.homeTeamName,
                    r.awayTeamName,
                    r.competitionName,
                    r.matchday,
                ].filter(Boolean).join(' ').toLowerCase();
                if (!haystack.includes(q)) return false;
            }
            return true;
        });
    }

    clearFilters(): void {
        this.searchCtrl.setValue('', { emitEvent: false });
        this.statusCtrl.setValue(null, { emitEvent: false });
        this._applyFilters();
        this._cdr.markForCheck();
    }

    close(): void {
        this._dialogRef.close();
    }
}
