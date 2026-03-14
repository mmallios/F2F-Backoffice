import { CommonModule } from '@angular/common';
import {
    ChangeDetectionStrategy,
    ChangeDetectorRef,
    Component,
    OnDestroy,
    OnInit,
    ViewChild,
    inject,
    signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatPaginator, MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatSelectModule } from '@angular/material/select';
import { MatSortModule } from '@angular/material/sort';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Subject, finalize, forkJoin, takeUntil } from 'rxjs';

import {
    AdminActivityService,
    AdminActivityOverviewDto,
    AdminActivityResponse,
    AdminActivityRowDto,
} from '@fuse/services/admin-activity/admin-activity.service';

import { BOHubService } from 'app/core/signalr/bo-hub.service';

import {
    AdminActionsDialogComponent,
    AdminActionsDialogData,
} from './dialogs/admin-actions-dialog.component';

import {
    AdminSessionsDialogComponent,
    AdminSessionsDialogData,
} from './dialogs/admin-sessions-dialog.component';

@Component({
    selector: 'app-admin-activity',
    standalone: true,
    imports: [
        CommonModule,
        ReactiveFormsModule,
        MatButtonModule,
        MatDialogModule,
        MatFormFieldModule,
        MatIconModule,
        MatInputModule,
        MatPaginatorModule,
        MatSelectModule,
        MatSortModule,
        MatTableModule,
        MatTooltipModule,
    ],
    templateUrl: './admin-activity.component.html',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminActivityComponent implements OnInit, OnDestroy {
    private api = inject(AdminActivityService);
    private hub = inject(BOHubService);
    private dialog = inject(MatDialog);
    private fb = inject(FormBuilder);
    private cdr = inject(ChangeDetectorRef);
    private destroy$ = new Subject<void>();

    loading = signal(false);
    error = signal<string | null>(null);
    overview = signal<AdminActivityOverviewDto | null>(null);
    onlineAdminIds = signal(new Set<number>());

    allAdmins: AdminActivityRowDto[] = [];

    dataSource = new MatTableDataSource<AdminActivityRowDto>([]);
    @ViewChild(MatPaginator, { static: false }) paginator?: MatPaginator;

    total = signal(0);
    pageIndex = signal(0);
    pageSize = signal(10);

    readonly columns = [
        'admin',
        'role',
        'totalActions',
        'actionsToday',
        'actionsThisWeek',
        'lastAction',
        'actions',
    ];

    readonly sortOptions = [
        { value: 'fullName:asc', label: 'Όνομα (Α→Ω)' },
        { value: 'fullName:desc', label: 'Όνομα (Ω→Α)' },
        { value: 'totalActions:desc', label: 'Σύνολο Ενεργειών ↓' },
        { value: 'totalActions:asc', label: 'Σύνολο Ενεργειών ↑' },
        { value: 'actionsToday:desc', label: 'Ενέργειες Σήμερα ↓' },
        { value: 'actionsToday:asc', label: 'Ενέργειες Σήμερα ↑' },
        { value: 'actionsThisWeek:desc', label: 'Ενέργειες Εβδομάδας ↓' },
        { value: 'actionsThisWeek:asc', label: 'Ενέργειες Εβδομάδας ↑' },
        { value: 'lastLoginAt:desc', label: 'Τελευταία Σύνδεση ↓' },
        { value: 'lastLoginAt:asc', label: 'Τελευταία Σύνδεση ↑' },
    ];

    filters = this.fb.group({
        adminId: [null as number | null],
        sort: ['totalActions:desc'],
    });

    private _filteredRows: AdminActivityRowDto[] = [];

    ngOnInit(): void {
        this.load();
        this.filters.valueChanges
            .pipe(takeUntil(this.destroy$))
            .subscribe(() => this.applyFilters());

        this.hub.adminPresenceChanged$
            .pipe(takeUntil(this.destroy$))
            .subscribe(({ boUserId, isOnline }) => {
                const current = new Set(this.onlineAdminIds());
                if (isOnline) current.add(boUserId);
                else current.delete(boUserId);
                this.onlineAdminIds.set(current);
                this.cdr.markForCheck();
            });
    }

    ngOnDestroy(): void {
        this.destroy$.next();
        this.destroy$.complete();
    }

    load(): void {
        this.loading.set(true);
        this.error.set(null);

        forkJoin({
            summary: this.api.getActivitySummary(),
            online: this.api.getOnlineAdmins(),
        })
            .pipe(finalize(() => this.loading.set(false)))
            .subscribe({
                next: ({ summary, online }) => {
                    this.overview.set(summary.overview);
                    this.allAdmins = summary.admins;
                    this.onlineAdminIds.set(new Set(online));
                    this.applyFilters();
                    this.cdr.markForCheck();
                },
                error: () => {
                    this.error.set('Σφάλμα φόρτωσης στατιστικών διαχειριστών.');
                    this.cdr.markForCheck();
                },
            });
    }

    applyFilters(): void {
        const { adminId, sort } = this.filters.value;

        let rows = [...this.allAdmins];

        if (adminId != null) {
            rows = rows.filter(r => r.boUserId === adminId);
        }

        const [field, dir] = (sort ?? 'totalActions:desc').split(':');
        const asc = dir !== 'desc';

        rows.sort((a, b) => {
            let va: number | string | null;
            let vb: number | string | null;
            switch (field) {
                case 'fullName': va = a.fullName; vb = b.fullName; break;
                case 'totalActions': va = a.totalActions; vb = b.totalActions; break;
                case 'actionsToday': va = a.actionsToday; vb = b.actionsToday; break;
                case 'actionsThisWeek': va = a.actionsThisWeek; vb = b.actionsThisWeek; break;
                case 'lastLoginAt': va = a.lastLoginAt ?? ''; vb = b.lastLoginAt ?? ''; break;
                default: va = a.fullName; vb = b.fullName;
            }
            if (va == null) va = '';
            if (vb == null) vb = '';
            if (va < vb) return asc ? -1 : 1;
            if (va > vb) return asc ? 1 : -1;
            return 0;
        });

        this._filteredRows = rows;
        this.total.set(rows.length);
        this.pageIndex.set(0);
        this.dataSource.data = rows.slice(0, this.pageSize());

        if (this.paginator) {
            this.paginator.firstPage();
        }
        this.cdr.markForCheck();
    }

    onPage(e: PageEvent): void {
        this.pageIndex.set(e.pageIndex);
        this.pageSize.set(e.pageSize);
        const start = e.pageIndex * e.pageSize;
        this.dataSource.data = this._filteredRows.slice(start, start + e.pageSize);
        this.cdr.markForCheck();
    }

    openActions(row: AdminActivityRowDto): void {
        const data: AdminActionsDialogData = {
            boUserId: row.boUserId,
            adminName: row.fullName,
        };
        this.dialog.open(AdminActionsDialogComponent, {
            data,
            panelClass: ['fuse-dialog', 'p-0'],
            autoFocus: false,
        });
    }

    openSessions(row: AdminActivityRowDto): void {
        const data: AdminSessionsDialogData = {
            boUserId: row.boUserId,
            adminName: row.fullName,
        };
        this.dialog.open(AdminSessionsDialogComponent, {
            data,
            panelClass: ['fuse-dialog', 'p-0'],
            autoFocus: false,
        });
    }

    isOnline(boUserId: number): boolean {
        return this.onlineAdminIds().has(boUserId);
    }
}
