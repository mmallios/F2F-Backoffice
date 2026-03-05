import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit, ViewEncapsulation } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTabsModule } from '@angular/material/tabs';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { Subject, takeUntil } from 'rxjs';

import { StoreService, ProductDto, OrderListItem } from '@fuse/services/store/store.service';


@Component({
    selector: 'product-details',
    standalone: true,
    templateUrl: './product-details.component.html',
    encapsulation: ViewEncapsulation.None,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        CommonModule,
        ReactiveFormsModule,
        RouterLink,
        MatButtonModule,
        MatIconModule,
        MatTabsModule,
        MatFormFieldModule,
        MatInputModule,
        MatSelectModule,
        MatTableModule,
    ],
})
export class ProductDetailsComponent implements OnInit, OnDestroy {
    loading = true;
    product: ProductDto | null = null;

    previewUrl: string | null = null;
    selectedFile: File | null = null;

    ordersLoading = false;
    orders: OrderListItem[] = [];
    ordersCols: string[] = ['code', 'submittedAt', 'total', 'actions'];

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

    constructor(
        private _route: ActivatedRoute,
        private _api: StoreService,
        private _cdr: ChangeDetectorRef
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
                    this.loading = false;
                    this._cdr.markForCheck();
                },
                error: () => {
                    this.product = null;
                    this.loading = false;
                    this._cdr.markForCheck();
                },
            });
    }

    ngOnDestroy(): void {
        this._unsubscribeAll.next();
        this._unsubscribeAll.complete();
        if (this.previewUrl?.startsWith('blob:')) URL.revokeObjectURL(this.previewUrl);
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

        // also clear saved url if you want
        this.form.controls.imageUrl.setValue(null);
        this._cdr.markForCheck();
    }

    save(): void {
        if (!this.product) return;
        if (this.form.invalid) return;

        // TODO:
        // 1) if selectedFile -> upload file -> get url -> set imageUrl
        // 2) call updateProduct(this.product.id, payload)
    }

    loadOrdersForProduct(): void {
        if (!this.product) return;

        this.ordersLoading = true;
        this._cdr.markForCheck();

        // TODO: needs backend endpoint + service method
        // this._api.getOrdersByProduct(this.product.id).subscribe(...)

        this.ordersLoading = false;
        this._cdr.markForCheck();
    }
}
