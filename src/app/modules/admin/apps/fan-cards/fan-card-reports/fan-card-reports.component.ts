import {
    ChangeDetectionStrategy,
    ChangeDetectorRef,
    Component,
    OnDestroy,
    OnInit,
    ViewEncapsulation,
    inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';
import { debounceTime, distinctUntilChanged, merge, Subject, takeUntil } from 'rxjs';
import {
    AllReportItem,
    AllReportsPagedResult,
    FanCardsAdminService,
} from '@fuse/services/fan-cards/fan-cards-admin.service';
import { User, UsersService } from '@fuse/services/users/users.service';
import {
    FanCardReportResolveDialogComponent,
    FanCardReportResolveDialogData,
} from '../fan-card-report-resolve-dialog/fan-card-report-resolve-dialog.component';
import { ClaimsService } from '@fuse/services/claims/claims.service';
import { BoPermissionDirective } from '@fuse/directives/permission/bo-permission.directive';

@Component({
    selector: 'fan-card-reports',
    templateUrl: './fan-card-reports.component.html',
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
        MatPaginatorModule,
        MatProgressBarModule,
        MatSelectModule,
        MatTooltipModule,
        BoPermissionDirective,
    ],
})
export class FanCardReportsComponent implements OnInit, OnDestroy {
    readonly claimsService = inject(ClaimsService);

    loading = true;
    items: AllReportItem[] = [];
    total = 0;
    pageSize = 20;
    currentPage = 1;

    users: User[] = [];

    filterOwner = new FormControl<number | null>(null);
    filterStatus = new FormControl<number | null>(null);

    /** Per-row draft comment text (keyed by report id) */
    commentDrafts: Record<number, string> = {};
    /** Tracks which rows are currently saving */
    savingComment: Record<number, boolean> = {};
    /** Tracks which rows have their comment input expanded */
    commentExpanded: Record<number, boolean> = {};

    get selectedUser(): User | null {
        return this.users.find(u => u.id === this.filterOwner.value) ?? null;
    }

    private _destroy$ = new Subject<void>();

    constructor(
        private _service: FanCardsAdminService,
        private _usersService: UsersService,
        private _dialog: MatDialog,
        private _cdr: ChangeDetectorRef,
    ) { }

    ngOnInit(): void {
        this._usersService.loadUsers().subscribe({
            next: (u) => { this.users = u; this._cdr.markForCheck(); },
        });

        this._load();

        merge(
            this.filterOwner.valueChanges,
            this.filterStatus.valueChanges,
        ).pipe(
            debounceTime(100),
            distinctUntilChanged(),
            takeUntil(this._destroy$),
        ).subscribe(() => {
            this.currentPage = 1;
            this._load();
        });
    }

    ngOnDestroy(): void {
        this._destroy$.next();
        this._destroy$.complete();
    }

    private _load(): void {
        this.loading = true;
        this._cdr.markForCheck();

        this._service.getAllReports(
            this.currentPage,
            this.pageSize,
            this.filterOwner.value ?? undefined,
            undefined,
            this.filterStatus.value ?? undefined,
        ).subscribe({
            next: (res: AllReportsPagedResult) => {
                this.items = res.items;
                this.total = res.total;
                // Initialise comment drafts from server data
                for (const item of res.items) {
                    this.commentDrafts[item.id] = item.adminComment ?? '';
                }
                this.loading = false;
                this._cdr.markForCheck();
            },
            error: () => {
                this.loading = false;
                this._cdr.markForCheck();
            },
        });
    }

    onPage(e: PageEvent): void {
        this.currentPage = e.pageIndex + 1;
        this.pageSize = e.pageSize;
        this._load();
    }

    clearFilters(): void {
        this.filterOwner.setValue(null, { emitEvent: false });
        this.filterStatus.setValue(null, { emitEvent: false });
        this.currentPage = 1;
        this._load();
    }

    toggleComment(id: number): void {
        this.commentExpanded[id] = !this.commentExpanded[id];
        this._cdr.markForCheck();
    }

    saveComment(item: AllReportItem): void {
        if (this.savingComment[item.id]) return;
        this.savingComment[item.id] = true;
        this._cdr.markForCheck();

        const text = this.commentDrafts[item.id] ?? '';
        this._service.saveReportComment(item.id, text || null).subscribe({
            next: () => {
                item.adminComment = text || null;
                this.savingComment[item.id] = false;
                this.commentExpanded[item.id] = false;
                this._cdr.markForCheck();
            },
            error: () => {
                this.savingComment[item.id] = false;
                this._cdr.markForCheck();
            },
        });
    }

    statusLabel(s: number): string {
        switch (s) {
            case 1: return 'Εκκρεμεί';
            case 2: return 'Επιλύθηκε';
            default: return String(s);
        }
    }

    openResolveDialog(item: AllReportItem): void {
        const ref = this._dialog.open<FanCardReportResolveDialogComponent, FanCardReportResolveDialogData>(
            FanCardReportResolveDialogComponent,
            {
                data: { report: item, mode: 'resolve' },
                width: '720px',
                maxWidth: '95vw',
            }
        );
        ref.afterClosed().subscribe((result) => {
            if (result?.resolved) {
                item.status = 2;
                item.adminComment = result.comment || null;
                item.resolvedByBoUserFullName = result.resolvedByBoUserFullName ?? null;
                item.resolvedByBoUserImage = result.resolvedByBoUserImage ?? null;
                item.resolvedAt = result.resolvedAt ?? null;
                this._cdr.markForCheck();
            }
        });
    }

    openViewDialog(item: AllReportItem): void {
        this._dialog.open<FanCardReportResolveDialogComponent, FanCardReportResolveDialogData>(
            FanCardReportResolveDialogComponent,
            {
                data: { report: item, mode: 'view' },
                width: '720px',
                maxWidth: '95vw',
            }
        );
    }
}
