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
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { MatSelectModule } from '@angular/material/select';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Router } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';

import {
    ContestListItemDto,
    ContestsAdminService,
} from '@fuse/services/contests/contests-admin.service';
import { ContestNewDialogComponent } from './dialogs/contest-new-dialog.component';

@Component({
    selector: 'app-contests-list',
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
    templateUrl: './contests-list.component.html',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ContestsListComponent implements OnInit, OnDestroy {
    private api = inject(ContestsAdminService);
    private dialog = inject(MatDialog);
    private router = inject(Router);
    private fb = inject(FormBuilder);
    private cdr = inject(ChangeDetectorRef);
    private destroy$ = new Subject<void>();

    loading = signal(false);
    error = signal<string | null>(null);
    deletingId = signal<number | null>(null);

    all: ContestListItemDto[] = [];
    dataSource = new MatTableDataSource<ContestListItemDto>([]);

    @ViewChild(MatSort, { static: false }) sort?: MatSort;
    @ViewChild(MatPaginator, { static: false }) paginator?: MatPaginator;

    displayedColumns = ['image', 'title', 'startDate', 'endDate', 'participants', 'status', 'actions'];

    filters = this.fb.group({
        search: [''],
        statusFilter: ['all'],
    });

    totalContests = signal(0);
    activeContests = signal(0);
    endedContests = signal(0);

    ngOnInit(): void {
        this.load();
        this.filters.valueChanges.pipe(takeUntil(this.destroy$)).subscribe(() => this.applyFilters());
    }

    load(): void {
        this.loading.set(true);
        this.error.set(null);
        this.api
            .list()
            .pipe(takeUntil(this.destroy$))
            .subscribe({
                next: (data) => {
                    this.all = data;
                    this.updateStats(data);
                    this.applyFilters();
                    this.loading.set(false);
                    this.cdr.markForCheck();
                },
                error: () => {
                    this.error.set('Σφάλμα φόρτωσης διαγωνισμών.');
                    this.loading.set(false);
                    this.cdr.markForCheck();
                },
            });
    }

    openNew(): void {
        this.dialog
            .open(ContestNewDialogComponent, {
                width: '640px',
                maxWidth: '95vw',
                maxHeight: '90vh',
                disableClose: true,
            })
            .afterClosed()
            .pipe(takeUntil(this.destroy$))
            .subscribe((created) => {
                if (created) this.load();
            });
    }

    goToDetails(c: ContestListItemDto): void {
        this.router.navigate(['/apps/contests', c.id]);
    }

    deleteContest(c: ContestListItemDto, event: MouseEvent): void {
        event.stopPropagation();
        if (!confirm(`Διαγραφή διαγωνισμού "${c.title}";`)) return;
        this.deletingId.set(c.id);
        this.api
            .delete(c.id)
            .pipe(takeUntil(this.destroy$))
            .subscribe({
                next: () => {
                    this.deletingId.set(null);
                    this.load();
                },
                error: () => {
                    this.deletingId.set(null);
                    this.cdr.markForCheck();
                },
            });
    }

    private updateStats(data: ContestListItemDto[]): void {
        const now = new Date();
        this.totalContests.set(data.length);
        this.activeContests.set(data.filter((c) => c.isActive && new Date(c.endDate) >= now).length);
        this.endedContests.set(data.filter((c) => !c.isActive || new Date(c.endDate) < now).length);
    }

    private applyFilters(): void {
        const { search, statusFilter } = this.filters.value;
        const now = new Date();
        let filtered = [...this.all];
        if (search?.trim()) {
            const q = search.trim().toLowerCase();
            filtered = filtered.filter((c) => c.title.toLowerCase().includes(q));
        }
        if (statusFilter === 'active') filtered = filtered.filter((c) => c.isActive && new Date(c.endDate) >= now);
        else if (statusFilter === 'ended') filtered = filtered.filter((c) => !c.isActive || new Date(c.endDate) < now);
        else if (statusFilter === 'upcoming') filtered = filtered.filter((c) => c.isActive && new Date(c.startDate) > now);

        this.dataSource.data = filtered;
        if (this.sort) this.dataSource.sort = this.sort;
        if (this.paginator) this.dataSource.paginator = this.paginator;
        this.cdr.markForCheck();
    }

    getStatus(c: ContestListItemDto): 'active' | 'upcoming' | 'ended' {
        const now = new Date();
        if (!c.isActive || new Date(c.endDate) < now) return 'ended';
        if (new Date(c.startDate) > now) return 'upcoming';
        return 'active';
    }

    ngOnDestroy(): void {
        this.destroy$.next();
        this.destroy$.complete();
    }
}