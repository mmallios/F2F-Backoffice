import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDividerModule } from '@angular/material/divider';
import { MatTooltipModule } from '@angular/material/tooltip';
import { catchError, concatMap, finalize, forkJoin, from, last, of } from 'rxjs';
import { ProductDto, ProductSize, ProductSKU, StoreService } from '@fuse/services/store/store.service';
import { User, UsersService } from '@fuse/services/users/users.service';

export interface OrderItem {
    product: ProductDto;
    qty: number;
    size: ProductSize | null;
}

const SIZE_LABELS: Record<number, string> = {
    0: 'XS', 1: 'S', 2: 'M', 3: 'L', 4: 'XL', 5: 'XXL', 6: 'XXXL',
};

@Component({
    selector: 'new-order',
    standalone: true,
    templateUrl: './new-order.component.html',
    imports: [
        CommonModule,
        ReactiveFormsModule,
        MatButtonModule,
        MatDividerModule,
        MatFormFieldModule,
        MatIconModule,
        MatInputModule,
        MatProgressBarModule,
        MatSelectModule,
        MatSnackBarModule,
        MatTooltipModule,
    ],
})
export class NewOrderComponent implements OnInit {

    private fb = inject(FormBuilder);
    private router = inject(Router);
    private snack = inject(MatSnackBar);
    private usersApi = inject(UsersService);
    private storeApi = inject(StoreService);

    // ── State ────────────────────────────────────
    loading = true;
    submitting = false;
    step = signal(0); // 0=user  1=address  2=products  3=confirm

    // ── Step 0 — User ───────────────────────────
    userSearch = '';
    allUsers: User[] = [];
    selectedUser = signal<User | null>(null);

    // ── Step 1 — Address ────────────────────────
    addressForm = this.fb.group({
        firstName: ['', Validators.required],
        lastName: [''],
        email: [''],
        phone: [''],
        addressLine1: [''],
        city: [''],
        zip: [''],
        region: [''],
        country: ['Ελλάδα'],
        notes: [''],
        shippingMethod: [null as number | null],
        paymentMethod: [null as number | null],
        shippingAmount: [0],
    });

    // ── Step 2 — Products ───────────────────────
    productSearch = '';
    allProducts: ProductDto[] = [];
    orderItems = signal<OrderItem[]>([]);

    // Pending add — shows inline size picker before committing
    pendingAddProduct = signal<ProductDto | null>(null);
    pendingSize = signal<ProductSize | null>(null);
    pendingQty = signal(1);

    readonly SIZE_LABELS = SIZE_LABELS;
    readonly SIZE_OPTIONS = Object.entries(SIZE_LABELS).map(([v, l]) => ({ value: Number(v), label: l }));

    // ── Computed ─────────────────────────────────

    get filteredUsers(): User[] {
        const q = this.userSearch.trim().toLowerCase();
        if (!q) return this.allUsers;
        return this.allUsers.filter(u => {
            const name = `${u.firstname ?? ''} ${u.lastname ?? ''}`.toLowerCase();
            return name.includes(q)
                || (u.email ?? '').toLowerCase().includes(q)
                || (u.code ?? '').toLowerCase().includes(q)
                || (u.username ?? '').toLowerCase().includes(q);
        });
    }

    get filteredProducts(): ProductDto[] {
        const q = this.productSearch.trim().toLowerCase();
        if (!q) return this.allProducts;
        return this.allProducts.filter(p =>
            (p.title ?? '').toLowerCase().includes(q) || (p.code ?? '').toLowerCase().includes(q)
        );
    }

    get subtotal(): number {
        return this.orderItems().reduce((s, i) => s + i.product.price * i.qty, 0);
    }

    get grandTotal(): number {
        return this.subtotal + Number(this.addressForm.value.shippingAmount ?? 0);
    }

    itemInCart(productId: number): OrderItem | undefined {
        return this.orderItems().find(i => i.product.id === productId);
    }

    productSizes(product: ProductDto): ProductSKU[] {
        return (product.skUs ?? []).filter(s => s.stock > 0);
    }

    hasSizes(product: ProductDto): boolean {
        return this.productSizes(product).length > 0;
    }

    sizeLabel(size: number | null): string {
        if (size === null || size === undefined) return 'Χωρίς μέγεθος';
        return SIZE_LABELS[size] ?? String(size);
    }

    get shippingMethodLabel(): string {
        switch (this.addressForm.value.shippingMethod) {
            case 0: return 'Courier';
            case 1: return 'Παράδοση στο χώρο';
            case 2: return 'Click & Collect';
            default: return '—';
        }
    }

    get paymentMethodLabel(): string {
        switch (this.addressForm.value.paymentMethod) {
            case 0: return 'Κάρτα';
            case 1: return 'Αντικαταβολή';
            case 2: return 'Revolut';
            default: return '—';
        }
    }

    userInitials(u: User | null): string {
        if (!u) return '?';
        const n = `${u.firstname ?? ''} ${u.lastname ?? ''}`.trim();
        const p = n.split(/\s+/);
        return (p.length >= 2 ? p[0][0] + p[1][0] : n.slice(0, 2)).toUpperCase() || '?';
    }

    // ── Lifecycle ────────────────────────────────

    ngOnInit(): void {
        forkJoin({
            users: this.usersApi.loadUsers(),
            products: this.storeApi.getAllProducts(),
        }).subscribe({
            next: ({ users, products }) => {
                this.allUsers = (users ?? []).sort((a, b) =>
                    `${a.firstname} ${a.lastname}`.localeCompare(`${b.firstname} ${b.lastname}`)
                );
                this.allProducts = (products ?? []).filter(p => p.isPublished);
                this.loading = false;
            },
            error: () => { this.loading = false; },
        });
    }

    // ── Navigation ───────────────────────────────

    goBack(): void {
        if (this.step() > 0) {
            this.step.set(this.step() - 1);
            return;
        }
        this.router.navigate(['/apps/orders']);
    }

    goToStep(n: number): void {
        if (n < this.step()) this.step.set(n);
    }

    // ── Step 0 actions ───────────────────────────

    selectUser(u: User): void {
        this.selectedUser.set(u);
        const name = `${u.firstname ?? ''} ${u.lastname ?? ''}`.trim().split(/\s+/);
        this.addressForm.patchValue({
            firstName: name[0] ?? '',
            lastName: name.slice(1).join(' ') ?? '',
            email: u.email ?? '',
            phone: u.mobile ?? '',
        });
        this.step.set(1);
    }

    // ── Step 2 actions ───────────────────────────

    /** Open the inline size/qty picker for a product (or add directly if no sizes) */
    openAddPanel(product: ProductDto): void {
        if (this.pendingAddProduct()?.id === product.id) {
            this.pendingAddProduct.set(null);
            return;
        }
        this.pendingAddProduct.set(product);
        this.pendingSize.set(null);
        this.pendingQty.set(1);
    }

    confirmAdd(): void {
        const p = this.pendingAddProduct();
        if (!p) return;
        this.addToCart(p, this.pendingSize(), this.pendingQty());
        this.pendingAddProduct.set(null);
    }

    addToCart(product: ProductDto, size: ProductSize | null, qty = 1): void {
        const items = this.orderItems();
        // Match by product + size combination
        const idx = items.findIndex(i => i.product.id === product.id && i.size === size);
        if (idx >= 0) {
            this.orderItems.set(items.map((item, i) =>
                i === idx ? { ...item, qty: item.qty + qty } : item
            ));
        } else {
            this.orderItems.set([...items, { product, qty, size }]);
        }
    }

    increaseItem(item: OrderItem): void {
        this.orderItems.set(this.orderItems().map(i =>
            i === item ? { ...i, qty: i.qty + 1 } : i
        ));
    }

    decreaseItem(item: OrderItem): void {
        if (item.qty <= 1) {
            this.removeItem(item);
            return;
        }
        this.orderItems.set(this.orderItems().map(i =>
            i === item ? { ...i, qty: i.qty - 1 } : i
        ));
    }

    removeItem(item: OrderItem): void {
        this.orderItems.set(this.orderItems().filter(i => i !== item));
    }

    // ── Submit ───────────────────────────────────

    submit(): void {
        const user = this.selectedUser();
        if (!user?.id || !this.orderItems().length) return;

        const userId = user.id;
        const form = this.addressForm.getRawValue();
        this.submitting = true;

        const shippingDetails = {
            firstName: form.firstName,
            lastName: form.lastName,
            email: form.email,
            phone: form.phone,
            addressLine1: form.addressLine1,
            city: form.city,
            zip: form.zip,
            region: form.region,
            country: form.country,
            notes: form.notes,
        };

        const orderData = JSON.stringify({ shippingDetails });

        this.storeApi.deleteCart(userId).pipe(catchError(() => of(null))).subscribe(() => {
            from(this.orderItems())
                .pipe(
                    concatMap(item =>
                        this.storeApi.addToCart(userId, {
                            productId: item.product.id,
                            quantity: item.qty,
                            size: item.size ?? undefined,
                        })
                    ),
                    last(),
                )
                .subscribe({
                    next: (cart) => {
                        this.storeApi.createNewOrder({
                            userId,
                            cartId: cart.id,
                            totalAmount: this.grandTotal,
                            shippingAmount: Number(form.shippingAmount ?? 0),
                            shippingMethod: form.shippingMethod ?? undefined,
                            paymentMethod: form.paymentMethod ?? undefined,
                            orderData,
                        })
                            .pipe(finalize(() => { this.submitting = false; }))
                            .subscribe({
                                next: (order: any) => {
                                    this.snack.open('Η παραγγελία δημιουργήθηκε!', 'ΟΚ', { duration: 3000 });
                                    const code = order?.code ?? order?.Code;
                                    if (code) {
                                        this.router.navigate(['/apps/orders', code]);
                                    } else {
                                        this.router.navigate(['/apps/orders']);
                                    }
                                },
                                error: () => {
                                    this.snack.open('Αποτυχία δημιουργίας παραγγελίας.', 'ΟΚ', { duration: 4000 });
                                },
                            });
                    },
                    error: () => {
                        this.submitting = false;
                        this.snack.open('Αποτυχία προσθήκης προϊόντων στο καλάθι.', 'ΟΚ', { duration: 4000 });
                    },
                });
        });
    }
}
