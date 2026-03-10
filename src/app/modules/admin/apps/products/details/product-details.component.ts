import { CommonModule, DatePipe, DecimalPipe, NgClass } from '@angular/common';
import { AfterViewInit, ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit, ViewChild, ViewEncapsulation, inject } from '@angular/core';
import { FormControl, FormGroup, FormsModule, ReactiveFormsModule, UntypedFormControl, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { MatTabsModule } from '@angular/material/tabs';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDialog, MatDialogModule, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { Subject, finalize, takeUntil } from 'rxjs';

import { StoreService, ProductDto, OrderDetailsResponse } from '@fuse/services/store/store.service';

const SIZES = [
    { value: 0, label: 'XS' },
    { value: 1, label: 'S' },
    { value: 2, label: 'M' },
    { value: 3, label: 'L' },
    { value: 4, label: 'XL' },
    { value: 5, label: 'XXL' },
    { value: 6, label: 'XXXL' },
];

/* ----------------------------------------------------------------
   Inline confirmation dialog
   ---------------------------------------------------------------- */
@Component({
    selector: 'product-confirm-dialog',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [MatButtonModule, MatDialogModule],
    template: `
<div class="p-6 max-w-sm min-w-[300px]">
    <div class="text-xl font-bold mb-2">{{ data.title }}</div>
    <div class="text-secondary text-sm mb-6">{{ data.message }}</div>
    <div class="flex justify-end gap-2">
        <button mat-stroked-button class="!rounded-xl" [mat-dialog-close]="false">Άκυρο</button>
        <button mat-flat-button [color]="data.danger ? 'warn' : 'primary'" class="!rounded-xl" [mat-dialog-close]="true">
            {{ data.confirmLabel ?? 'Επιβεβαίωση' }}
        </button>
    </div>
</div>`,
})
export class ProductConfirmDialogComponent {
    data = inject<{ title: string; message: string; danger?: boolean; confirmLabel?: string }>(MAT_DIALOG_DATA);
}

@Component({
    selector: 'product-details',
    standalone: true,
    templateUrl: './product-details.component.html',
    encapsulation: ViewEncapsulation.None,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        CommonModule,
        ReactiveFormsModule,
        FormsModule,
        DatePipe,
        NgClass,
        DecimalPipe,

        MatButtonModule,
        MatIconModule,
        MatChipsModule,
        MatTabsModule,
        MatFormFieldModule,
        MatInputModule,
        MatSelectModule,
        MatTableModule,
        MatPaginatorModule,
        MatSortModule,
        MatTooltipModule,
        MatProgressBarModule,
        MatSnackBarModule,
        MatDialogModule,
    ],
})
export class ProductDetailsComponent implements OnInit, AfterViewInit, OnDestroy {
    loading = true;
    saving = false;
    product: ProductDto | null = null;

    previewUrl: string | null = null;
    selectedFile: File | null = null;

    editMode = false;

    // SKU state
    skuDraft: { size: number; stock: number }[] = [];
    skuNewSize: number | null = null;
    skuNewStock = 0;
    skuSaving = false;

    // Orders tab
    ordersLoading = false;
    ordersLoaded = false;
    ordersDataSource = new MatTableDataSource<OrderDetailsResponse>([]);
    ordersCols = ['code', 'status', 'total', 'submittedAt', 'actions'];
    orderSearchCtrl = new UntypedFormControl('');
    orderFilterStatus = new FormControl<number | null>(null);
    @ViewChild('ordersPaginator') ordersPaginator?: MatPaginator;
    @ViewChild('ordersSort') ordersSort?: MatSort;

    readonly SIZES = SIZES;

    form = new FormGroup({
        title: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
        code: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
        price: new FormControl(0, { nonNullable: true }),
        deletedPrice: new FormControl(0, { nonNullable: true }),
        stock: new FormControl(0, { nonNullable: true }),
        maxQuantity: new FormControl(99, { nonNullable: true }),
        isPublished: new FormControl(false, { nonNullable: true }),
        smallDescription: new FormControl<string | null>(null),
        description: new FormControl<string | null>(null),
        imageUrl: new FormControl<string | null>(null),
    });

    private _unsubscribeAll = new Subject<void>();

    private _dialog = inject(MatDialog);

    constructor(
        private _route: ActivatedRoute,
        private _router: Router,
        private _api: StoreService,
        private _cdr: ChangeDetectorRef,
        private _snack: MatSnackBar,
    ) { }

    ngOnInit(): void {
        const id = Number(this._route.snapshot.paramMap.get('id'));
        if (!id) {
            this.loading = false;
            this._cdr.markForCheck();
            return;
        }

        this._api.getProductById(id)
            .pipe(takeUntil(this._unsubscribeAll))
            .subscribe({
                next: (p) => {
                    this.product = p;
                    this._patchForm(p);
                    this.skuDraft = (p.skUs ?? []).map(s => ({ ...s })).sort((a, b) => a.size - b.size);
                    this.loading = false;
                    this._cdr.markForCheck();
                },
                error: () => {
                    this.loading = false;
                    this._cdr.markForCheck();
                },
            });

        this.ordersDataSource.filterPredicate = (o: OrderDetailsResponse, raw: string) => {
            let f: any = {};
            try { f = raw ? JSON.parse(raw) : {}; } catch { f = {}; }
            const q = (f.q || '').trim().toLowerCase();
            const status = f.status;
            if (status != null && Number(o.status) !== Number(status)) return false;
            if (!q) return true;
            return [o.code, String(o.id)].join(' ').toLowerCase().includes(q);
        };

        this.orderSearchCtrl.valueChanges
            .pipe(takeUntil(this._unsubscribeAll))
            .subscribe(() => this._applyOrdersFilter());

        this.orderFilterStatus.valueChanges
            .pipe(takeUntil(this._unsubscribeAll))
            .subscribe(() => this._applyOrdersFilter());
    }

    ngAfterViewInit(): void { }

    ngOnDestroy(): void {
        this._unsubscribeAll.next();
        this._unsubscribeAll.complete();
        if (this.previewUrl?.startsWith('blob:')) URL.revokeObjectURL(this.previewUrl);
    }

    private _patchForm(p: ProductDto): void {
        this.form.patchValue({
            title: p.title,
            code: p.code,
            price: p.price,
            deletedPrice: p.deletedPrice,
            stock: p.stock,
            maxQuantity: p.maxQuantity,
            isPublished: p.isPublished,
            smallDescription: p.smallDescription ?? null,
            description: p.description ?? null,
            imageUrl: p.imageUrl ?? null,
        });
    }

    startEdit(): void {
        this.editMode = true;
        this._cdr.markForCheck();
    }

    cancelEdit(): void {
        if (this.product) this._patchForm(this.product);
        this.editMode = false;
        this._cdr.markForCheck();
    }

    save(): void {
        if (!this.product || this.form.invalid) return;
        this._dialog.open(ProductConfirmDialogComponent, {
            data: { title: 'Αποθήκευση αλλαγών', message: 'Θέλεις σίγουρα να αποθηκεύσεις τις αλλαγές στο προϊόν;', confirmLabel: 'Αποθήκευση' },
            maxWidth: '400px',
            panelClass: ['rounded-2xl'],
        }).afterClosed().subscribe(confirmed => {
            if (!confirmed) return;
            this._executeSave();
        });
    }

    private _executeSave(): void {
        if (!this.product || this.form.invalid) return;
        const v = this.form.getRawValue();

        const payload = {
            code: v.code,
            title: v.title,
            smallDescription: v.smallDescription,
            description: v.description,
            price: v.price,
            deletedPrice: v.deletedPrice,
            stock: v.stock,
            imageUrl: v.imageUrl,
            maxQuantity: v.maxQuantity,
            isPublished: v.isPublished,
            skUs: JSON.stringify(this.skuDraft),
            categoryIds: this.product.categoryIds ?? [],
        };

        this.saving = true;
        this._cdr.markForCheck();

        this._api.updateProduct(this.product.id, payload)
            .pipe(finalize(() => { this.saving = false; this._cdr.markForCheck(); }))
            .subscribe({
                next: (p) => {
                    this.product = p;
                    this._patchForm(p);
                    this.skuDraft = (p.skUs ?? []).map(s => ({ ...s })).sort((a, b) => a.size - b.size);
                    this.editMode = false;
                    this._snack.open('✅ Το προϊόν αποθηκεύτηκε.', 'OK', { duration: 3000 });
                    this._cdr.markForCheck();
                },
                error: (err) => {
                    this._snack.open(`❌ ${err?.error?.message ?? 'Αποτυχία αποθήκευσης'}`, 'OK', { duration: 4000 });
                },
            });
    }

    // ---- SKU management ----

    availableSizesForAdd(): { value: number; label: string }[] {
        const used = new Set(this.skuDraft.map(s => s.size));
        return SIZES.filter(s => !used.has(s.value));
    }

    addSku(): void {
        if (this.skuNewSize == null) return;
        if (this.skuDraft.some(s => s.size === this.skuNewSize)) return;
        this.skuDraft = [...this.skuDraft, { size: this.skuNewSize, stock: this.skuNewStock }]
            .sort((a, b) => a.size - b.size);
        this.skuNewSize = null;
        this.skuNewStock = 0;
        this._cdr.markForCheck();
    }

    removeSku(size: number): void {
        const label = this.sizeLabel(size);
        this._dialog.open(ProductConfirmDialogComponent, {
            data: {
                title: 'Αφαίρεση μεγέθους',
                message: `Θέλεις σίγουρα να αφαιρέσεις το μέγεθος ${label};`,
                danger: true,
                confirmLabel: 'Αφαίρεση',
            },
            maxWidth: '400px',
            panelClass: ['rounded-2xl'],
        }).afterClosed().subscribe(confirmed => {
            if (!confirmed) return;
            this.skuDraft = this.skuDraft.filter(s => s.size !== size);
            this._cdr.markForCheck();
        });
    }

    updateSkuStock(size: number, stock: number): void {
        this.skuDraft = this.skuDraft.map(s => s.size === size ? { ...s, stock: Math.max(0, stock) } : s);
        this._cdr.markForCheck();
    }

    saveSkus(): void {
        if (!this.product) return;
        this._dialog.open(ProductConfirmDialogComponent, {
            data: { title: 'Αποθήκευση μεγεθών', message: 'Θέλεις σίγουρα να αποθηκεύσεις τα μεγέθη & αποθέματα;', confirmLabel: 'Αποθήκευση' },
            maxWidth: '400px',
            panelClass: ['rounded-2xl'],
        }).afterClosed().subscribe(confirmed => {
            if (!confirmed) return;
            this._executeSkuSave();
        });
    }

    private _executeSkuSave(): void {
        if (!this.product) return;
        const v = this.form.getRawValue();
        const totalStock = this.skuDraft.reduce((s, x) => s + (Number(x.stock) || 0), 0);

        const payload = {
            code: v.code,
            title: v.title,
            smallDescription: v.smallDescription,
            description: v.description,
            price: v.price,
            deletedPrice: v.deletedPrice,
            stock: totalStock,
            imageUrl: v.imageUrl,
            maxQuantity: v.maxQuantity,
            isPublished: v.isPublished,
            skUs: JSON.stringify(this.skuDraft),
            categoryIds: this.product.categoryIds ?? [],
        };

        this.skuSaving = true;
        this._cdr.markForCheck();

        this._api.updateProduct(this.product.id, payload)
            .pipe(finalize(() => { this.skuSaving = false; this._cdr.markForCheck(); }))
            .subscribe({
                next: (p) => {
                    this.product = p;
                    this.form.patchValue({ stock: p.stock });
                    this.skuDraft = (p.skUs ?? []).map(s => ({ ...s })).sort((a, b) => a.size - b.size);
                    this._snack.open('✅ Τα μεγέθη αποθηκεύτηκαν.', 'OK', { duration: 3000 });
                    this._cdr.markForCheck();
                },
                error: (err) => {
                    this._snack.open(`❌ ${err?.error?.message ?? 'Αποτυχία αποθήκευσης μεγεθών'}`, 'OK', { duration: 4000 });
                },
            });
    }

    sizeLabel(size: number): string {
        return SIZES.find(s => s.value === size)?.label ?? String(size);
    }

    totalStock(): number {
        if (this.skuDraft.length) return this.skuDraft.reduce((s, x) => s + (Number(x.stock) || 0), 0);
        return Number(this.product?.stock) || 0;
    }

    // ---- Orders tab ----

    onTabChange(event: { index: number }): void {
        if (event.index === 1 && !this.ordersLoaded && !this.ordersLoading) {
            this.loadOrdersForProduct();
        }
    }

    loadOrdersForProduct(): void {
        if (!this.product) return;
        this.ordersLoading = true;
        this._cdr.markForCheck();

        this._api.getOrdersByProduct(this.product.id)
            .pipe(finalize(() => { this.ordersLoading = false; this.ordersLoaded = true; this._cdr.markForCheck(); }))
            .subscribe({
                next: (orders) => {
                    this.ordersDataSource.data = orders ?? [];
                    setTimeout(() => {
                        if (this.ordersPaginator) this.ordersDataSource.paginator = this.ordersPaginator;
                        if (this.ordersSort) this.ordersDataSource.sort = this.ordersSort;
                        this._applyOrdersFilter();
                        this._cdr.markForCheck();
                    });
                },
                error: () => {
                    this.ordersDataSource.data = [];
                },
            });
    }

    private _applyOrdersFilter(): void {
        this.ordersDataSource.filter = JSON.stringify({
            q: (this.orderSearchCtrl.value || '').toString(),
            status: this.orderFilterStatus.value,
        });
        if (this.ordersDataSource.paginator) this.ordersDataSource.paginator.firstPage();
        this._cdr.markForCheck();
    }

    clearOrderFilters(): void {
        this.orderSearchCtrl.setValue('');
        this.orderFilterStatus.setValue(null);
    }

    getOrderStatusLabel(status: number): string {
        switch (status) {
            case 0: return 'Σε εκκρεμότητα';
            case 1: return 'Υποβλήθηκε';
            case 2: return 'Πληρώθηκε';
            case 3: return 'Απεστάλη';
            case 4: return 'Ολοκληρώθηκε';
            case 5: return 'Ακυρώθηκε';
            default: return '—';
        }
    }

    getOrderStatusClass(status: number): string {
        switch (status) {
            case 2: case 4: return 'bg-green-100 text-green-800 dark:bg-green-500/10 dark:text-green-300';
            case 5: return 'bg-red-100 text-red-800 dark:bg-red-500/10 dark:text-red-300';
            case 0: case 1: return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-500/10 dark:text-yellow-300';
            default: return 'bg-indigo-100 text-indigo-800 dark:bg-indigo-500/10 dark:text-indigo-300';
        }
    }

    viewOrder(o: OrderDetailsResponse): void {
        this._router.navigate(['/apps/orders', o.code]);
    }

    back(): void {
        this._router.navigate(['/apps/products']);
    }

    onFileSelected(ev: Event): void {
        const input = ev.target as HTMLInputElement;
        const file = input.files?.[0];
        if (!file) return;
        this.selectedFile = file;
        if (this.previewUrl?.startsWith('blob:')) URL.revokeObjectURL(this.previewUrl);
        this.previewUrl = URL.createObjectURL(file);
        this._cdr.markForCheck();
    }

    removeImage(): void {
        this.selectedFile = null;
        if (this.previewUrl?.startsWith('blob:')) URL.revokeObjectURL(this.previewUrl);
        this.previewUrl = null;
        this.form.controls.imageUrl.setValue(null);
        this._cdr.markForCheck();
    }
}
