import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatDividerModule } from '@angular/material/divider';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { catchError, concatMap, finalize, forkJoin, from, last, of } from 'rxjs';
import { ProductDto, StoreService } from '@fuse/services/store/store.service';
import { User, UsersService } from '@fuse/services/users/users.service';

export interface NewOrderItem {
    product: ProductDto;
    qty: number;
}

@Component({
    selector: 'new-order-dialog',
    standalone: true,
    templateUrl: './new-order-dialog.component.html',
    imports: [
        CommonModule,
        ReactiveFormsModule,
        MatButtonModule,
        MatDialogModule,
        MatDividerModule,
        MatFormFieldModule,
        MatIconModule,
        MatInputModule,
        MatProgressBarModule,
        MatSelectModule,
        MatSnackBarModule,
    ],
})
export class NewOrderDialogComponent implements OnInit {
    private dialogRef = inject(MatDialogRef<NewOrderDialogComponent>);
    private fb = inject(FormBuilder);
    private snack = inject(MatSnackBar);
    private usersService = inject(UsersService);
    private storeService = inject(StoreService);

    loading = true;
    submitting = false;
    step = 0; // 0 = user, 1 = details, 2 = products

    // ── Step 1 ──────────────────────────────
    userSearch = '';
    allUsers: User[] = [];
    selectedUser: User | null = null;

    // ── Step 2 ──────────────────────────────
    detailsForm = this.fb.group({
        fullname: [''],
        phone: [''],
        address: [''],
        city: [''],
        postalCode: [''],
        notes: [''],
        shippingMethod: [null as number | null],
        paymentMethod: [null as number | null],
        shippingAmount: [0 as number],
    });

    // ── Step 3 ──────────────────────────────
    productSearch = '';
    allProducts: ProductDto[] = [];
    orderItems: NewOrderItem[] = [];

    ngOnInit(): void {
        forkJoin({
            users: this.usersService.loadUsers(),
            products: this.storeService.getAllProducts(),
        }).subscribe({
            next: ({ users, products }) => {
                this.allUsers = (users ?? []).sort((a, b) =>
                    `${a.firstname} ${a.lastname}`.localeCompare(`${b.firstname} ${b.lastname}`),
                );
                this.allProducts = products ?? [];
                this.loading = false;
            },
            error: () => { this.loading = false; },
        });
    }

    // ── Computed helpers ─────────────────────
    get filteredUsers(): User[] {
        const q = this.userSearch.trim().toLowerCase();
        if (!q) return this.allUsers;
        return this.allUsers.filter(u => {
            const name = `${u.firstname ?? ''} ${u.lastname ?? ''}`.toLowerCase();
            return name.includes(q)
                || (u.email ?? '').toLowerCase().includes(q)
                || (u.code ?? '').toLowerCase().includes(q);
        });
    }

    get filteredProducts(): ProductDto[] {
        const q = this.productSearch.trim().toLowerCase();
        if (!q) return this.allProducts;
        return this.allProducts.filter(p =>
            (p.title ?? '').toLowerCase().includes(q) || (p.code ?? '').toLowerCase().includes(q),
        );
    }

    userInitials(u: User | null): string {
        if (!u) return '?';
        const n = `${u.firstname ?? ''} ${u.lastname ?? ''}`.trim();
        const p = n.split(/\s+/);
        return (p.length >= 2 ? p[0][0] + p[1][0] : n.slice(0, 2)).toUpperCase() || '?';
    }

    itemQty(productId: number): number {
        return this.orderItems.find(i => i.product.id === productId)?.qty ?? 0;
    }

    get subtotal(): number {
        return this.orderItems.reduce((s, i) => s + i.product.price * i.qty, 0);
    }

    get grandTotal(): number {
        return this.subtotal + Number(this.detailsForm.value.shippingAmount ?? 0);
    }

    // ── Actions ─────────────────────────────
    selectUser(u: User): void {
        this.selectedUser = u;
        this.detailsForm.patchValue({
            fullname: `${u.firstname ?? ''} ${u.lastname ?? ''}`.trim(),
            phone: u.mobile ?? '',
        });
        this.step = 1;
    }

    addItem(product: ProductDto): void {
        const idx = this.orderItems.findIndex(i => i.product.id === product.id);
        if (idx >= 0) {
            this.orderItems = this.orderItems.map((item, i) =>
                i === idx ? { ...item, qty: item.qty + 1 } : item,
            );
        } else {
            this.orderItems = [...this.orderItems, { product, qty: 1 }];
        }
    }

    decreaseItem(product: ProductDto): void {
        const idx = this.orderItems.findIndex(i => i.product.id === product.id);
        if (idx < 0) return;
        if (this.orderItems[idx].qty <= 1) {
            this.orderItems = this.orderItems.filter(i => i.product.id !== product.id);
        } else {
            this.orderItems = this.orderItems.map((item, i) =>
                i === idx ? { ...item, qty: item.qty - 1 } : item,
            );
        }
    }

    removeItemFully(product: ProductDto): void {
        this.orderItems = this.orderItems.filter(i => i.product.id !== product.id);
    }

    submit(): void {
        if (!this.selectedUser?.id || !this.orderItems.length) return;
        const userId = this.selectedUser.id;
        const form = this.detailsForm.getRawValue();
        this.submitting = true;

        // Clear existing cart (ignore 404), then add items sequentially
        this.storeService.deleteCart(userId).pipe(catchError(() => of(null))).subscribe(() => {
            from(this.orderItems)
                .pipe(
                    concatMap(item => this.storeService.addToCart(userId, {
                        productId: item.product.id,
                        quantity: item.qty,
                    })),
                    last(),
                )
                .subscribe({
                    next: (cart) => {
                        const orderData = JSON.stringify({
                            fullname: form.fullname,
                            phone: form.phone,
                            address: form.address,
                            city: form.city,
                            postalCode: form.postalCode,
                            notes: form.notes,
                        });

                        this.storeService.createNewOrder({
                            userId,
                            cartId: cart.id,
                            totalAmount: this.grandTotal,
                            shippingAmount: Number(form.shippingAmount ?? 0),
                            shippingMethod: form.shippingMethod ?? undefined,
                            paymentMethod: form.paymentMethod ?? undefined,
                            orderData,
                        }).pipe(finalize(() => { this.submitting = false; }))
                            .subscribe({
                                next: (order) => {
                                    this.snack.open('Η παραγγελία δημιουργήθηκε!', 'ΟΚ', { duration: 3000 });
                                    this.dialogRef.close(order);
                                },
                                error: () => {
                                    this.snack.open('Αποτυχία δημιουργίας παραγγελίας.', 'ΟΚ', { duration: 3000 });
                                },
                            });
                    },
                    error: () => {
                        this.submitting = false;
                        this.snack.open('Αποτυχία προσθήκης προϊόντων στο καλάθι.', 'ΟΚ', { duration: 3000 });
                    },
                });
        });
    }
}
