import { AsyncPipe, CommonModule, I18nPluralPipe, NgClass } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit, ViewChild, ViewEncapsulation } from '@angular/core';
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

import { StoreService, ProductDto } from '@fuse/services/store/store.service';

@Component({
    selector: 'products-list',
    templateUrl: './products-list.component.html',
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
    ],
})
export class ProductsListComponent implements OnInit, OnDestroy {
    @ViewChild(MatPaginator) paginator: MatPaginator;
    @ViewChild(MatSort) sort: MatSort;

    loading = true;

    productsCount = 0;
    filteredCount = 0;

    searchCtrl = new UntypedFormControl('');
    statusCtrl = new FormControl<boolean | null>(null);

    dateRange = new FormGroup({
        start: new FormControl<Date | null>(null),
        end: new FormControl<Date | null>(null),
    });

    columns: string[] = ['product', 'price', 'stock', 'published', 'createdOn', 'actions'];
    dataSource = new MatTableDataSource<ProductDto>([]);

    private _unsubscribeAll = new Subject<void>();

    constructor(private _api: StoreService, private _cdr: ChangeDetectorRef, private _router: Router,) { }

    ngOnInit(): void {
        // Filter predicate BEFORE load
        this.dataSource.filterPredicate = (p: any, raw: string) => {
            let f: any = {};
            try { f = raw ? JSON.parse(raw) : {}; } catch { f = {}; }

            const q = (f.q || '').trim().toLowerCase();
            const isPublished = f.isPublished; // boolean|null
            const start = f.start ? new Date(f.start) : null;
            const end = f.end ? new Date(f.end) : null;

            // status filter
            const passStatus = isPublished == null || Boolean(p.isPublished) === Boolean(isPublished);
            if (!passStatus) return false;

            // date filter (requires createdOn from API; if you don't have it, disable this filter)
            if ((start || end) && p.createdOn) {
                const d = new Date(p.createdOn);
                if (start && d < start) return false;
                if (end) {
                    const endOfDay = new Date(end);
                    endOfDay.setHours(23, 59, 59, 999);
                    if (d > endOfDay) return false;
                }
            }

            // search
            if (!q) return true;
            const bag = [p.code, p.title, p.smallDescription].filter(Boolean).join(' ').toLowerCase();
            return bag.includes(q);
        };

        // First load
        this.reload();

        // react to filters
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

        this._api.getAllProducts().subscribe({
            next: (products) => {
                const data = products ?? [];
                this.productsCount = data.length;

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
            isPublished: this.statusCtrl.value, // boolean|null
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

    createProduct(): void {
        // TODO: navigate to create page or open dialog
        // e.g. this._router.navigate(['/products/create'])
    }



    viewDetails(g: any): void {
        this._router.navigate(['/apps/products', g.id]);
    }
}
