import { CommonModule } from '@angular/common';
import {
    AfterViewInit,
    ChangeDetectionStrategy,
    ChangeDetectorRef,
    Component,
    OnDestroy,
    OnInit,
    ViewChild,
    SecurityContext,
} from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTableModule, MatTableDataSource } from '@angular/material/table';
import { MatPaginatorModule, MatPaginator } from '@angular/material/paginator';
import { MatSortModule, MatSort } from '@angular/material/sort';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatSelectModule } from '@angular/material/select';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { Subject, combineLatest, debounceTime, startWith, takeUntil } from 'rxjs';
import { BONewsItem, NewsService } from '@fuse/services/news/news.service';

@Component({
    selector: 'app-news',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        CommonModule,
        ReactiveFormsModule,
        MatButtonModule,
        MatIconModule,
        MatInputModule,
        MatFormFieldModule,
        MatProgressBarModule,
        MatTableModule,
        MatPaginatorModule,
        MatSortModule,
        MatTooltipModule,
        MatDatepickerModule,
        MatNativeDateModule,
        MatSelectModule,
    ],
    templateUrl: './news.component.html',
})
export class NewsComponent implements OnInit, AfterViewInit, OnDestroy {
    @ViewChild(MatPaginator) paginator!: MatPaginator;
    @ViewChild(MatSort) sort!: MatSort;

    loading = false;
    toggling: string | null = null; // link of currently-toggling post

    dataSource = new MatTableDataSource<BONewsItem>([]);
    columns = ['image', 'title', 'date', 'visibility', 'admin', 'actions'];

    searchCtrl = new FormControl('', { nonNullable: true });
    fromDateCtrl = new FormControl<Date | null>(null);
    toDateCtrl = new FormControl<Date | null>(null);
    visibilityCtrl = new FormControl<'all' | 'visible' | 'hidden'>('all', { nonNullable: true });

    private _raw: BONewsItem[] = [];

    // Detail modal state
    detailOpen = false;
    detailItem: BONewsItem | null = null;
    detailSafeHtml: SafeHtml | null = null;

    // Admin id — replace with auth service if available
    readonly adminUserId: number | null = null;

    private _unsubscribeAll = new Subject<void>();

    constructor(
        private _newsService: NewsService,
        private _sanitizer: DomSanitizer,
        private _cdr: ChangeDetectorRef
    ) { }

    ngOnInit(): void {
        this.load();

        combineLatest([
            this.searchCtrl.valueChanges.pipe(startWith('')),
            this.fromDateCtrl.valueChanges.pipe(startWith(null as Date | null)),
            this.toDateCtrl.valueChanges.pipe(startWith(null as Date | null)),
            this.visibilityCtrl.valueChanges.pipe(startWith('all' as const)),
        ])
            .pipe(debounceTime(150), takeUntil(this._unsubscribeAll))
            .subscribe(() => this.applyFilters());
    }

    ngAfterViewInit(): void {
        this.dataSource.paginator = this.paginator;
        this.dataSource.sort = this.sort;
    }

    ngOnDestroy(): void {
        this._unsubscribeAll.next();
        this._unsubscribeAll.complete();
    }

    load(): void {
        this.loading = true;
        this._cdr.markForCheck();
        this._newsService.getAll().subscribe({
            next: (items) => {
                this._raw = items ?? [];
                this.applyFilters();
                this.loading = false;
                this._cdr.markForCheck();
            },
            error: () => {
                this.loading = false;
                this._cdr.markForCheck();
            },
        });
    }

    applyFilters(): void {
        const q = this.searchCtrl.value.toLowerCase().trim();
        const from = this.fromDateCtrl.value;
        const to = this.toDateCtrl.value;
        const vis = this.visibilityCtrl.value;

        let filtered = this._raw;

        if (q) {
            filtered = filtered.filter((r) =>
                (r.title + ' ' + r.summary).toLowerCase().includes(q)
            );
        }
        if (from || to) {
            filtered = filtered.filter((r) => {
                const d = new Date(r.publishedAt);
                if (from && d < from) return false;
                if (to) {
                    const end = new Date(to);
                    end.setHours(23, 59, 59, 999);
                    if (d > end) return false;
                }
                return true;
            });
        }
        if (vis === 'visible') filtered = filtered.filter((r) => !r.isHidden);
        if (vis === 'hidden') filtered = filtered.filter((r) => r.isHidden);

        this.dataSource.data = filtered;
        this._cdr.markForCheck();
    }

    toggleVisibility(item: BONewsItem): void {
        this.toggling = item.link;
        this._cdr.markForCheck();
        this._newsService.toggleVisibility(item.link, !item.isHidden, this.adminUserId).subscribe({
            next: (res) => {
                item.isHidden = res.isHidden;
                this.toggling = null;
                this.applyFilters();
                this._cdr.markForCheck();
            },
            error: () => {
                this.toggling = null;
                this._cdr.markForCheck();
            },
        });
    }

    openDetail(item: BONewsItem): void {
        this.detailItem = item;
        this.detailSafeHtml = this._sanitizer.bypassSecurityTrustHtml(item.summary || '');
        this.detailOpen = true;
        this._cdr.markForCheck();
    }

    closeDetail(): void {
        this.detailOpen = false;
        this.detailItem = null;
        this.detailSafeHtml = null;
        this._cdr.markForCheck();
    }

    stripHtml(html: string): string {
        const sanitized = this._sanitizer.sanitize(SecurityContext.HTML, html) ?? '';
        const tmp = document.createElement('div');
        tmp.innerHTML = sanitized;
        return tmp.textContent || tmp.innerText || '';
    }
}
