import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, ViewChild, inject, signal } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';

import { MatDrawer, MatDrawerContainer, MatSidenavModule } from '@angular/material/sidenav';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';

import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';

import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatSort, MatSortModule, Sort } from '@angular/material/sort';
import { MatPaginator, MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';

import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatDateRangeInput, MatDateRangePicker } from '@angular/material/datepicker';

import { Subject, debounceTime, distinctUntilChanged, finalize, takeUntil } from 'rxjs';

import { UsersService, User } from '@fuse/services/users/users.service';
import {
    SupportTicketsAdminService,
    SupportTicketAdminDto,
    SupportTicketStatus,
} from '@fuse/services/support/support-tickets-admin.service';

@Component({
    selector: 'app-support-tickets-list',
    standalone: true,
    imports: [
        CommonModule,
        RouterModule,
        ReactiveFormsModule,

        MatSidenavModule,
        MatIconModule,
        MatButtonModule,

        MatFormFieldModule,
        MatInputModule,
        MatSelectModule,

        MatTableModule,
        MatSortModule,
        MatPaginatorModule,
        MatChipsModule,
        MatTooltipModule,

        MatDatepickerModule,
        MatNativeDateModule,
    ],
    templateUrl: './support-tickets-list.component.html',
    styleUrls: ['./support-tickets-list.component.css'],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SupportTicketsListComponent implements OnInit, OnDestroy {
    private api = inject(SupportTicketsAdminService);
    private usersService = inject(UsersService);
    private fb = inject(FormBuilder);
    private router = inject(Router);

    private destroy$ = new Subject<void>();

    // Drawer (optional)
    drawerMode: 'side' | 'over' = 'over';
    @ViewChild('matDrawer', { static: false }) matDrawer?: MatDrawer;

    // table
    dataSource = new MatTableDataSource<SupportTicketAdminDto>([]);
    @ViewChild(MatSort, { static: false }) sort?: MatSort;
    @ViewChild(MatPaginator, { static: false }) paginator?: MatPaginator;

    loading = signal(false);
    error = signal<string | null>(null);

    total = signal(0);

    adminUsers = signal<User[]>([]);

    readonly columns = [
        'id',
        'user',
        'subject',
        'category',
        'assignee',
        'replies',
        'createdAt',
        'status',
        'actions',
    ];

    readonly statusOptions = [
        { value: null as any, label: 'Όλα' },
        { value: SupportTicketStatus.Pending, label: 'Εκκρεμεί' },
        { value: SupportTicketStatus.Answered, label: 'Απαντήθηκε' },
        { value: SupportTicketStatus.Completed, label: 'Ολοκληρώθηκε' },
        { value: SupportTicketStatus.Deleted, label: 'Διεγράφη' },
    ];

    filters = this.fb.group({
        q: [''],
        status: [null as SupportTicketStatus | null],
        category: [''],
        assigneeAdminId: [null as number | null],
        dateFrom: [null as Date | null],
        dateTo: [null as Date | null],
    });

    // pagination/sorting
    pageIndex = signal(0); // 0-based
    pageSize = signal(15);
    sortStr = signal<string>('createdAt:desc');

    ngOnInit(): void {
        // load admin users for assignee dropdown
        this.usersService
            .loadUsers()
            .pipe(takeUntil(this.destroy$))
            .subscribe({
                next: (users) => this.adminUsers.set((users ?? []).slice()),
                error: () => this.adminUsers.set([]),
            });

        // auto reload on filters change
        this.filters.valueChanges
            .pipe(debounceTime(250), distinctUntilChanged(), takeUntil(this.destroy$))
            .subscribe(() => {
                this.pageIndex.set(0);
                this.load();
            });

        this.load();
    }

    ngOnDestroy(): void {
        this.destroy$.next();
        this.destroy$.complete();
    }

    afterViewInitBind(): void {
        // call once if you prefer from ngAfterViewInit
        if (this.sort) this.dataSource.sort = this.sort;
        if (this.paginator) this.dataSource.paginator = this.paginator;
    }

    onBackdropClicked(): void {
        if (this.drawerMode === 'over') this.matDrawer?.close();
    }

    load(): void {
        this.loading.set(true);
        this.error.set(null);

        const f = this.filters.getRawValue();
        const fromIso = f.dateFrom ? new Date(f.dateFrom).toISOString() : null;
        const toIso = f.dateTo ? new Date(f.dateTo).toISOString() : null;

        this.api
            .list({
                q: (f.q || '').trim() || null,
                status: f.status ?? null,
                category: (f.category || '').trim() || null,
                assigneeAdminId: f.assigneeAdminId ?? null,
                from: fromIso,
                to: toIso,
                page: this.pageIndex() + 1,
                pageSize: this.pageSize(),
                sort: this.sortStr(),
            })
            .pipe(finalize(() => this.loading.set(false)))
            .subscribe({
                next: (res) => {
                    const items = res.items ?? [];
                    this.total.set(res.total ?? items.length);
                    this.dataSource.data = items;

                    // bind sort/paginator safely
                    queueMicrotask(() => {
                        if (this.sort) this.dataSource.sort = this.sort;
                        if (this.paginator) this.dataSource.paginator = this.paginator;
                    });
                },
                error: (err) => {
                    console.error(err);
                    this.error.set('Αποτυχία φόρτωσης tickets.');
                    this.total.set(0);
                    this.dataSource.data = [];
                },
            });
    }

    resetFilters(): void {
        this.filters.reset({
            q: '',
            status: null,
            category: '',
            assigneeAdminId: null,
            dateFrom: null,
            dateTo: null,
        });
    }

    onSortChange(sort: Sort): void {
        const active = sort.active || 'createdAt';
        const dir = sort.direction || 'desc';
        this.sortStr.set(`${active}:${dir}`);
        this.load();
    }

    onPage(ev: PageEvent): void {
        this.pageIndex.set(ev.pageIndex);
        this.pageSize.set(ev.pageSize);
        this.load();
    }

    openDetails(row: SupportTicketAdminDto): void {
        // adjust route to your real details path
        // e.g. /admin/apps/support/tickets/:id
        this.router.navigate(['/apps/support/tickets', row.id]);
        //window.location.href = `/app/support/tickets/${row.id}`;
    }

    // ---------- UI helpers ----------
    statusLabel(s: SupportTicketStatus): string {
        switch (s) {
            case SupportTicketStatus.Pending:
                return 'ΕΚΚΡΕΜΕΙ';
            case SupportTicketStatus.Answered:
                return 'ΑΠΑΝΤΗΘΗΚΕ';
            case SupportTicketStatus.Completed:
                return 'ΟΛΟΚΛΗΡΩΘΗΚΕ';
            case SupportTicketStatus.Deleted:
                return 'ΔΙΕΓΡΑΦΗ';
            default:
                return String(s);
        }
    }

    getStatusChipClass(s: SupportTicketStatus): string {
        switch (s) {
            case SupportTicketStatus.Pending:
                return 'chip chip-warn';
            case SupportTicketStatus.Answered:
                return 'chip chip-info';
            case SupportTicketStatus.Completed:
                return 'chip chip-ok';
            case SupportTicketStatus.Deleted:
                return 'chip chip-muted';
            default:
                return 'chip chip-muted';
        }
    }

    formatDate(iso: string): string {
        const d = new Date(iso);
        const dd = String(d.getDate()).padStart(2, '0');
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const yyyy = d.getFullYear();
        const hh = String(d.getHours()).padStart(2, '0');
        const mi = String(d.getMinutes()).padStart(2, '0');
        return `${dd}/${mm}/${yyyy} ${hh}:${mi}`;
    }

    clip(text?: string | null, max = 90): string {
        const t = (text ?? '').trim();
        if (!t) return '—';
        return t.length > max ? t.slice(0, max - 1) + '…' : t;
    }

    adminNameById(id?: number | null): string {
        if (!id) return '—';
        const u = this.adminUsers().find(x => Number(x.id) === Number(id));
        if (!u) return '—';
        return `${u.firstname ?? ''} ${u.lastname ?? ''}`.trim() || u.email || '—';
    }

    userInitial(u: SupportTicketAdminDto): string {
        const name = (u.userFullName ?? '').trim();
        return name ? name.charAt(0).toUpperCase() : 'U';
    }

    trackById = (_: number, x: SupportTicketAdminDto) => x.id;
}