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
import { MatChipsModule } from '@angular/material/chips';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatPaginator, MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatSelectModule } from '@angular/material/select';
import { MatSort, MatSortModule, Sort } from '@angular/material/sort';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Subject, finalize, takeUntil } from 'rxjs';

import {
    AdminStatsRowDto,
    AdminUserDto,
    SupportStatsResponse,
    SupportTicketsAdminService,
    TicketStatsDto,
} from '@fuse/services/support/support-tickets-admin.service';

import {
    AdminTicketsDialogComponent,
    AdminTicketsDialogData,
} from './dialogs/admin-tickets-dialog.component';

@Component({
    selector: 'app-support-stats',
    standalone: true,
    imports: [
        CommonModule,
        ReactiveFormsModule,
        MatButtonModule,
        MatChipsModule,
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
    templateUrl: './support-stats.component.html',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SupportStatsComponent implements OnInit, OnDestroy {
    private api = inject(SupportTicketsAdminService);
    private dialog = inject(MatDialog);
    private fb = inject(FormBuilder);
    private cdr = inject(ChangeDetectorRef);
    private destroy$ = new Subject<void>();

    loading = signal(false);
    error = signal<string | null>(null);

    overall = signal<TicketStatsDto | null>(null);
    allAdmins: AdminStatsRowDto[] = [];

    // Filtered + paginated admin list
    dataSource = new MatTableDataSource<AdminStatsRowDto>([]);
    @ViewChild(MatSort, { static: false }) sort?: MatSort;
    @ViewChild(MatPaginator, { static: false }) paginator?: MatPaginator;

    total = signal(0);
    pageIndex = signal(0);
    pageSize = signal(10);

    adminList = signal<AdminUserDto[]>([]);

    readonly columns = [
        'admin',
        'totalTickets',
        'openTickets',
        'completedTickets',
        'avgFirstResponse',
        'avgResponse',
        'actions',
    ];

    readonly sortOptions = [
        { value: 'fullName:asc', label: 'Όνομα (Α→Ω)' },
        { value: 'fullName:desc', label: 'Όνομα (Ω→Α)' },
        { value: 'total:desc', label: 'Σύνολο Tickets ↓' },
        { value: 'total:asc', label: 'Σύνολο Tickets ↑' },
        { value: 'open:desc', label: 'Ανοιχτά ↓' },
        { value: 'open:asc', label: 'Ανοιχτά ↑' },
        { value: 'completed:desc', label: 'Ολοκληρωμένα ↓' },
        { value: 'completed:asc', label: 'Ολοκληρωμένα ↑' },
        { value: 'avgFirst:asc', label: 'Μ.Ο. 1ης Απάντησης ↑' },
        { value: 'avgFirst:desc', label: 'Μ.Ο. 1ης Απάντησης ↓' },
    ];

    filters = this.fb.group({
        adminId: [null as number | null],
        sort: ['fullName:asc'],
    });

    ngOnInit(): void {
        this.load();
        this.filters.valueChanges
            .pipe(takeUntil(this.destroy$))
            .subscribe(() => this.applyFilters());
    }

    ngOnDestroy(): void {
        this.destroy$.next();
        this.destroy$.complete();
    }

    load(): void {
        this.loading.set(true);
        this.error.set(null);

        this.api.getStats()
            .pipe(finalize(() => this.loading.set(false)))
            .subscribe({
                next: (res: SupportStatsResponse) => {
                    this.overall.set(res.overall);
                    this.allAdmins = res.admins;
                    this.applyFilters();
                    this.cdr.markForCheck();
                },
                error: (err) => {
                    this.error.set('Σφάλμα φόρτωσης στατιστικών.');
                    this.cdr.markForCheck();
                },
            });
    }

    applyFilters(): void {
        const { adminId, sort } = this.filters.value;

        let rows = [...this.allAdmins];

        // Filter by admin
        if (adminId != null) {
            rows = rows.filter(r => r.boUserId === adminId);
        }

        // Sort
        const [field, dir] = (sort ?? 'fullName:asc').split(':');
        const asc = dir !== 'desc';
        rows.sort((a, b) => {
            let va: number | string | null = 0;
            let vb: number | string | null = 0;
            switch (field) {
                case 'fullName': va = a.fullName; vb = b.fullName; break;
                case 'total': va = a.totalTickets; vb = b.totalTickets; break;
                case 'open': va = a.openTickets; vb = b.openTickets; break;
                case 'completed': va = a.completedTickets; vb = b.completedTickets; break;
                case 'avgFirst': va = a.avgMinutesToFirstAdminResponse ?? -1; vb = b.avgMinutesToFirstAdminResponse ?? -1; break;
                default: va = a.fullName; vb = b.fullName;
            }
            if (va == null) va = -Infinity as any;
            if (vb == null) vb = -Infinity as any;
            if (va < vb) return asc ? -1 : 1;
            if (va > vb) return asc ? 1 : -1;
            return 0;
        });

        this.total.set(rows.length);
        this.pageIndex.set(0);

        // Slice for client-side pagination
        const start = 0;
        const end = this.pageSize();
        this.dataSource.data = rows.slice(start, end);
        this._filteredRows = rows;

        if (this.paginator) {
            this.paginator.firstPage();
        }
        this.cdr.markForCheck();
    }

    private _filteredRows: AdminStatsRowDto[] = [];

    onPage(e: PageEvent): void {
        this.pageIndex.set(e.pageIndex);
        this.pageSize.set(e.pageSize);
        const start = e.pageIndex * e.pageSize;
        const end = start + e.pageSize;
        this.dataSource.data = this._filteredRows.slice(start, end);
        this.cdr.markForCheck();
    }

    openAdminTickets(row: AdminStatsRowDto): void {
        this.dialog.open<AdminTicketsDialogComponent, AdminTicketsDialogData>(
            AdminTicketsDialogComponent,
            {
                data: { boUserId: row.boUserId, adminName: row.fullName },
                maxWidth: '95vw',
                panelClass: 'rounded-2xl',
            }
        );
    }

    formatMinutes(val: number | null | undefined): string {
        if (val == null) return '—';
        if (val < 60) return `${Math.round(val)} λεπτά`;
        const h = Math.floor(val / 60);
        const m = Math.round(val % 60);
        return m > 0 ? `${h}ω ${m}λ` : `${h} ώρες`;
    }
}
