import { AsyncPipe, CommonModule, I18nPluralPipe, NgClass } from '@angular/common';
import {
    ChangeDetectionStrategy,
    ChangeDetectorRef,
    Component,
    OnDestroy,
    OnInit,
    ViewChild,
    ViewEncapsulation,
    inject,
} from '@angular/core';
import { FormControl, FormGroup, FormsModule, ReactiveFormsModule, UntypedFormControl } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatChipsModule } from '@angular/material/chips';
import { Router, RouterLink } from '@angular/router';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSelectModule } from '@angular/material/select';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { Subject, takeUntil } from 'rxjs';

import { AnnouncementsService, AnnouncementDto } from '@fuse/services/announcements/announcements.service';
import { SafeHtmlPipe } from '@fuse/pipes/safe-html/safe-html.pipe';
import { FuseConfirmationService } from '@fuse/services/confirmation';

@Component({
    selector: 'announcements-list',
    templateUrl: './announcements-list.component.html',
    encapsulation: ViewEncapsulation.None,
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: true,
    imports: [
        CommonModule,
        RouterLink,

        FormsModule,
        ReactiveFormsModule,
        AsyncPipe,
        I18nPluralPipe,
        NgClass,

        MatFormFieldModule,
        MatIconModule,
        MatInputModule,
        MatButtonModule,

        MatTableModule,
        MatPaginatorModule,
        MatSortModule,
        MatChipsModule,
        MatTooltipModule,
        MatSelectModule,

        MatDatepickerModule,
        MatNativeDateModule,
        SafeHtmlPipe,
    ],
})
export class AnnouncementsListComponent implements OnInit, OnDestroy {
    @ViewChild(MatPaginator) paginator: MatPaginator;
    @ViewChild(MatSort) sort: MatSort;

    loading = true;

    totalCount = 0;
    filteredCount = 0;

    searchCtrl = new UntypedFormControl('');
    statusCtrl = new FormControl<boolean | null>(null); // true=Published, false=Draft, null=All

    dateRange = new FormGroup({
        start: new FormControl<Date | null>(null),
        end: new FormControl<Date | null>(null),
    });

    columns: string[] = ['announcement', 'announcedBy', 'publishDate', 'status', 'actions'];
    dataSource = new MatTableDataSource<AnnouncementDto>([]);

    private _unsubscribeAll = new Subject<void>();

    private _confirmation = inject(FuseConfirmationService);

    constructor(
        private _api: AnnouncementsService,
        private _cdr: ChangeDetectorRef,
        private _router: Router
    ) { }

    ngOnInit(): void {
        // Filter predicate BEFORE load
        this.dataSource.filterPredicate = (a: any, raw: string) => {
            let f: any = {};
            try { f = raw ? JSON.parse(raw) : {}; } catch { f = {}; }

            const q = (f.q || '').trim().toLowerCase();
            const isPublished = f.isPublished; // boolean|null
            const start = f.start ? new Date(f.start) : null;
            const end = f.end ? new Date(f.end) : null;

            const pub = a.status === 1; // 1 = Published
            const passStatus = isPublished == null || pub === Boolean(isPublished);
            if (!passStatus) return false;

            // date filter by publishDate
            if ((start || end) && a.publishDate) {
                const d = new Date(a.publishDate);
                if (start && d < start) return false;
                if (end) {
                    const endOfDay = new Date(end);
                    endOfDay.setHours(23, 59, 59, 999);
                    if (d > endOfDay) return false;
                }
            } else if (start || end) {
                // if filtering by date but announcement has no publishDate -> exclude
                return false;
            }

            if (!q) return true;

            const bag = [
                a.code,
                a.title,
                a.message,
            ].filter(Boolean).join(' ').toLowerCase();

            return bag.includes(q);
        };

        this.reload();

        this.searchCtrl.valueChanges.pipe(takeUntil(this._unsubscribeAll)).subscribe(() => this.applyFilter());
        this.statusCtrl.valueChanges.pipe(takeUntil(this._unsubscribeAll)).subscribe(() => this.applyFilter());
        this.dateRange.valueChanges.pipe(takeUntil(this._unsubscribeAll)).subscribe(() => this.applyFilter());
    }

    ngOnDestroy(): void {
        this._unsubscribeAll.next();
        this._unsubscribeAll.complete();
    }

    reload(): void {
        this.loading = true;
        this._cdr.markForCheck();

        this._api.getAll().subscribe({
            next: (items) => {
                const data = (items ?? []).filter(x => !x?.isDeleted);
                this.totalCount = data.length;

                this.dataSource.data = data;
                this.dataSource.paginator = this.paginator;
                this.dataSource.sort = this.sort;

                this.applyFilter();
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

    applyFilter(): void {
        const payload = {
            q: (this.searchCtrl.value || '').toString(),
            isPublished: this.statusCtrl.value,
            start: this.dateRange.value?.start ? this.dateRange.value.start.toISOString() : null,
            end: this.dateRange.value?.end ? this.dateRange.value.end.toISOString() : null,
        };

        this.dataSource.filter = JSON.stringify(payload);

        if (this.dataSource.paginator) this.dataSource.paginator.firstPage();
        this.filteredCount = this.dataSource.filteredData?.length ?? 0;

        this._cdr.markForCheck();
    }

    clearDateRange(): void {
        this.dateRange.setValue({ start: null, end: null });
    }

    createAnnouncement(): void {
        // route to details in "create mode"
        this._router.navigate(['/apps/announcements/create']);
    }

    viewDetails(a: AnnouncementDto): void {
        this._router.navigate(['/apps/announcements', a.id]);
    }

    deleteAnnouncement(a: AnnouncementDto): void {
        this._confirmation
            .open({
                title: 'Διαγραφή ανακοίνωσης',
                message: `Είστε σίγουροι ότι θέλετε να διαγράψετε την ανακοίνωση <strong>${a.title}</strong>;`,
                icon: { show: true, name: 'heroicons_outline:trash', color: 'warn' },
                actions: {
                    confirm: { label: 'Διαγραφή', color: 'warn' },
                    cancel: { label: 'Ακύρωση' },
                },
            })
            .afterClosed()
            .pipe(takeUntil(this._unsubscribeAll))
            .subscribe((result) => {
                if (result !== 'confirmed') return;
                this._api.delete(a.id)
                    .pipe(takeUntil(this._unsubscribeAll))
                    .subscribe({
                        next: () => {
                            this.dataSource.data = this.dataSource.data.filter(x => x.id !== a.id);
                            this.totalCount = this.dataSource.data.length;
                            this.applyFilter();
                        },
                        error: () => this._cdr.markForCheck(),
                    });
            });
    }
}