import { CommonModule, CurrencyPipe, DatePipe, NgClass } from '@angular/common';
import {
    ChangeDetectionStrategy,
    Component,
    ViewEncapsulation,
    computed,
    inject,
    signal,
} from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { catchError, finalize, of } from 'rxjs';

import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';

import { MatDialog, MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { FormControl, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatDividerModule } from '@angular/material/divider';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';

import { CartItemDto, OrderDetailsResponse, ProductDto, StoreService } from '@fuse/services/store/store.service';

/* =========================================================
   TYPES
   ========================================================= */

type ShippingDetailsVm = {
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
    addressLine1?: string;
    addressLine2?: string;
    country?: string;
    region?: string;
    city?: string;
    zip?: string;
    method?: string;
    lockerId?: string | null;
};

export type ProductsDialogResult = { items: CartItemDto[] } | null;

type DialogData = {
    items: CartItemDto[];
};

type OrderItemEditVm = CartItemDto & { _temp?: boolean };

/* =========================================================
   ORDER DETAILS (PAGE)
   ========================================================= */

@Component({
    selector: 'app-order-details',
    standalone: true,
    encapsulation: ViewEncapsulation.None,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        CommonModule,
        RouterLink,
        NgClass,
        DatePipe,
        CurrencyPipe,

        MatButtonModule,
        MatIconModule,
        MatChipsModule,
        MatTooltipModule,

        // dialog uses standalone component below (imports there),
        // but it's ok to keep MatDialogModule here too.
        MatDialogModule,
    ],
    templateUrl: './order-details.component.html',
})
export class OrderDetailsComponent {
    private route = inject(ActivatedRoute);
    private store = inject(StoreService);
    private dialog = inject(MatDialog);

    loading = signal(true);
    error = signal<string | null>(null);

    order = signal<OrderDetailsResponse | null>(null);

    // IMPORTANT: items should come from order()
    items = computed<CartItemDto[]>(() => this.order()?.items ?? []);

    user = computed<any | null>(() => (this.order() as any)?.user ?? null);

    subtotal = computed(() => this.items().reduce((sum, x) => sum + (Number(x.lineTotal ?? 0) || 0), 0));
    shipping = computed(() => Number(this.order()?.shippingAmount ?? 0) || 0);
    total = computed(() => Number(this.order()?.totalAmount ?? 0) || (this.subtotal() + this.shipping()));

    shippingDetails = computed<ShippingDetailsVm | null>(() => {
        const raw = this.order()?.orderData;
        if (!raw) return null;

        try {
            const obj = typeof raw === 'string' ? JSON.parse(raw) : (raw as any);
            return (obj?.shippingDetails ?? null) as ShippingDetailsVm | null;
        } catch {
            return null;
        }
    });

    constructor() {
        this.route.paramMap
            .pipe(
                finalize(() => { }),
                // load once on init
                // (paramMap emits on route changes too - works fine)
                // we keep it simple:
            )
            .subscribe(() => this.loadByRoute());
    }

    private loadByRoute(): void {
        const pm = this.route.snapshot.paramMap;
        const code = pm.get('code') || pm.get('orderCode') || pm.get('id');

        if (!code) {
            this.error.set('Λείπει ο κωδικός παραγγελίας από το URL.');
            this.loading.set(false);
            return;
        }

        this.loading.set(true);
        this.error.set(null);

        this.store
            .getOrderByCode(code)
            .pipe(
                catchError((err) => {
                    console.error(err);
                    this.error.set('Αποτυχία φόρτωσης παραγγελίας. Δοκίμασε ξανά.');
                    return of(null);
                }),
                finalize(() => this.loading.set(false))
            )
            .subscribe((res) => {
                if (res) this.order.set(res);
            });
    }

    // ========== Labels (Ελληνικά) ==========
    getStatusLabel(status: number | null | undefined): string {
        switch (status) {
            case 0: return 'Σε εκκρεμότητα';
            case 1: return 'Υποβλήθηκε';
            case 2: return 'Πληρώθηκε';
            case 3: return 'Απεστάλη';
            case 4: return 'Ολοκληρώθηκε';
            case 5: return 'Ακυρώθηκε';
            default: return 'Άγνωστη κατάσταση';
        }
    }

    getStatusChipClass(status: number | null | undefined): any {
        switch (status) {
            case 2:
            case 4:
                return 'bg-green-100 text-green-800 dark:bg-green-500/10 dark:text-green-300';
            case 0:
            case 1:
                return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-500/10 dark:text-yellow-300';
            case 5:
                return 'bg-red-100 text-red-800 dark:bg-red-500/10 dark:text-red-300';
            default:
                return 'bg-indigo-100 text-indigo-800 dark:bg-indigo-500/10 dark:text-indigo-300';
        }
    }

    getPaymentLabel(method: number | null | undefined): string {
        switch (method) {
            case 0: return 'Κάρτα';
            case 1: return 'Αντικαταβολή';
            case 2: return 'Revolut';
            default: return '—';
        }
    }

    getShippingLabel(method: number | null | undefined): string {
        switch (method) {
            case 0: return 'Παράδοση στο σπίτι';
            case 1: return 'Παραλαβή από locker';
            default: return '—';
        }
    }

    sizeLabel(size: any): string {
        if (size === null || size === undefined) return '—';
        return String(size);
    }

    // ========== User fallbacks ==========
    userFullname(): string {
        const u: any = this.user();
        if (!u) return '—';

        return (
            u.fullname ||
            u.fullName ||
            u.Fullname ||
            [u.firstname ?? u.Firstname, u.lastname ?? u.Lastname].filter(Boolean).join(' ') ||
            u.email ||
            '—'
        );
    }

    userEmail(): string {
        const u: any = this.user();
        return (u?.email ?? u?.Email ?? '') || '';
    }

    userImage(): string | null {
        const u: any = this.user();
        return (u?.image ?? u?.Image ?? null) || null;
    }

    // ========== Actions ==========
    retry(): void {
        this.loadByRoute();
    }

    // ===== MODAL: edit products =====
    openProductsEditor(): void {
        const dlg = this.dialog.open(OrderProductsEditDialogComponent, {
            width: '960px',
            maxWidth: '96vw',
            autoFocus: false,
            panelClass: ['f2f-dialog', 'rounded-2xl'],
            data: { items: structuredClone(this.items()) } satisfies DialogData,
        });

        dlg.afterClosed().subscribe((result: ProductsDialogResult) => {
            if (!result) return;

            // ✅ ΜΟΝΟ UI αλλαγή (όπως ζήτησες). Δεν κάνουμε .NET save εδώ.
            const current = this.order();
            if (!current) return;

            // ενημερώνουμε το order() ώστε να δει αλλαγές και ο πίνακας/σύνολα
            this.order.set({
                ...current,
                items: result.items,
            });
        });
    }
}

/* =========================================================
   DIALOG COMPONENT
   ========================================================= */

@Component({
    selector: 'order-products-edit-dialog',
    standalone: true,
    encapsulation: ViewEncapsulation.None,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        CommonModule,
        FormsModule,
        ReactiveFormsModule,

        MatDialogModule,
        MatButtonModule,
        MatIconModule,
        MatTooltipModule,
        MatDividerModule,
        MatFormFieldModule,
        MatInputModule,
        MatSelectModule,
    ],
    template: `
<div class="bg-card rounded-2xl overflow-hidden">
  <!-- HEADER -->
  <div class="px-6 py-5 border-b flex items-start justify-between gap-4">
    <div class="min-w-0">
      <div class="text-xl font-extrabold tracking-tight">Επεξεργασία προϊόντων</div>
      <div class="text-secondary text-sm mt-1">
        Διαγραφή / προσθήκη προϊόντων. Οι αλλαγές εφαρμόζονται μόνο με «Αποθήκευση».
      </div>
    </div>

    <button mat-icon-button (click)="close()" matTooltip="Κλείσιμο">
      <mat-icon [svgIcon]="'heroicons_outline:x-mark'"></mat-icon>
    </button>
  </div>

  <!-- BODY -->
  <div class="p-6 space-y-5">

    <!-- CURRENT ITEMS -->
    <div class="rounded-2xl border overflow-hidden">
      <div class="px-4 py-3 bg-gray-50/70 dark:bg-white/5 flex items-center justify-between">
        <div class="font-bold">Τρέχοντα προϊόντα</div>
        <div class="text-secondary text-sm">{{ editItems().length }} τεμ.</div>
      </div>

      <div class="divide-y">
        @if (!editItems().length) {
          <div class="p-5 text-secondary">Δεν υπάρχουν προϊόντα.</div>
        } @else {
          @for (it of editItems(); track it.id) {
            <div class="p-4 flex items-center gap-3">
              <div class="w-12 h-12 rounded-xl overflow-hidden bg-gray-100 dark:bg-gray-800 flex items-center justify-center shrink-0">
                @if (it.imageUrl) {
                  <img [src]="it.imageUrl" class="h-full w-full object-cover" alt="Προϊόν" />
                } @else {
                  <mat-icon [svgIcon]="'heroicons_outline:photo'"></mat-icon>
                }
              </div>

              <div class="min-w-0 flex-1">
                <div class="font-semibold truncate">{{ it.productTitle }}</div>
                <div class="text-secondary text-xs mt-0.5">
                  Ποσότητα:
                  <span class="font-medium text-gray-900 dark:text-gray-100">{{ it.quantity }}</span>
                  <span class="mx-2">•</span>
                  Μέγεθος:
                  <span class="font-medium text-gray-900 dark:text-gray-100">{{ it.size ?? '—' }}</span>
                  <span class="mx-2">•</span>
                  Σύνολο:
                  <span class="font-semibold text-gray-900 dark:text-gray-100">{{ it.lineTotal | number:'1.2-2' }} €</span>
                </div>
              </div>

              <button mat-icon-button color="warn" (click)="remove(it)" matTooltip="Διαγραφή">
                <mat-icon [svgIcon]="'heroicons_outline:trash'"></mat-icon>
              </button>
            </div>
          }
        }
      </div>
    </div>

    <!-- ADD PRODUCT -->
    <div class="rounded-2xl border p-4 md:p-5">
      <div class="flex items-center justify-between gap-3">
        <div class="font-bold">Προσθήκη προϊόντος</div>
        @if (loadingProducts()) {
          <div class="text-secondary text-sm">Φόρτωση προϊόντων…</div>
        }
      </div>

      <div class="mt-4 grid grid-cols-1 md:grid-cols-12 gap-3 items-end">

        <!-- Product -->
        <div class="md:col-span-6">
          <mat-form-field class="fuse-mat-dense fuse-mat-rounded w-full" subscriptSizing="dynamic">
            <mat-label>Προϊόν</mat-label>
            <mat-select [formControl]="productCtrl">
              @for (p of products(); track p.id) {
                <mat-option [value]="p.id">
                  <div class="flex items-center gap-3">
                    <div class="w-8 h-8 rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-800 flex items-center justify-center shrink-0">
                      @if (p.imageUrl) {
                        <img [src]="p.imageUrl" class="h-full w-full object-cover" alt="Προϊόν" />
                      } @else {
                        <mat-icon [svgIcon]="'heroicons_outline:photo'"></mat-icon>
                      }
                    </div>
                    <div class="min-w-0">
                      <div class="font-semibold truncate">{{ p.title }}</div>
                      <div class="text-secondary text-xs truncate">{{ p.code }}</div>
                    </div>
                  </div>
                </mat-option>
              }
            </mat-select>
          </mat-form-field>
        </div>

        <!-- Size -->
        <div class="md:col-span-3">
          <mat-form-field class="fuse-mat-dense fuse-mat-rounded w-full" subscriptSizing="dynamic">
            <mat-label>Μέγεθος</mat-label>
            <mat-select [formControl]="sizeCtrl" [disabled]="!sizesForSelected().length">
              <mat-option [value]="null">—</mat-option>
              @for (s of sizesForSelected(); track s) {
                <mat-option [value]="s">{{ s }}</mat-option>
              }
            </mat-select>
          </mat-form-field>
        </div>

        <!-- Quantity -->
        <div class="md:col-span-2">
          <mat-form-field class="fuse-mat-dense fuse-mat-rounded w-full" subscriptSizing="dynamic">
            <mat-label>Ποσότητα</mat-label>
            <input matInput type="number" min="1" [formControl]="qtyCtrl" />
          </mat-form-field>
        </div>

        <!-- Add button -->
        <div class="md:col-span-1 flex md:justify-end">
          <button mat-flat-button color="primary" class="!rounded-xl w-full md:w-auto"
                  (click)="add()"
                  [disabled]="!canAdd()">
            <mat-icon [svgIcon]="'heroicons_outline:plus'"></mat-icon>
          </button>
        </div>

      </div>

      @if (addError()) {
        <div class="mt-3 text-sm text-red-600 dark:text-red-400">
          {{ addError() }}
        </div>
      }
    </div>

    <!-- TOTALS PREVIEW -->
    <div class="rounded-2xl border p-4 md:p-5 bg-gray-50/70 dark:bg-white/5">
      <div class="flex items-center justify-between">
        <div class="text-secondary">Σύνολο προϊόντων (προεπισκόπηση)</div>
        <div class="text-lg font-extrabold">{{ previewSubtotal() | number:'1.2-2' }} €</div>
      </div>
    </div>
  </div>

  <!-- FOOTER -->
  <div class="px-6 py-4 border-t flex items-center justify-end gap-2">
    <button mat-stroked-button class="!rounded-xl" (click)="close()">Άκυρο</button>
    <button mat-flat-button color="primary" class="!rounded-xl" (click)="save()">
      <mat-icon [svgIcon]="'heroicons_outline:check'"></mat-icon>
      <span class="ml-2">Αποθήκευση</span>
    </button>
  </div>
</div>
`,
})
export class OrderProductsEditDialogComponent {
    private store = inject(StoreService);
    private dialogRef = inject(MatDialogRef<OrderProductsEditDialogComponent, ProductsDialogResult>);
    private data = inject<DialogData>(MAT_DIALOG_DATA);

    editItems = signal<OrderItemEditVm[]>(this.data?.items ?? []);

    loadingProducts = signal(true);
    products = signal<ProductDto[]>([]);

    productCtrl = new FormControl<number | null>(null);
    sizeCtrl = new FormControl<number | null>(null);
    qtyCtrl = new FormControl<number>(1, { nonNullable: true });

    addError = signal<string | null>(null);

    previewSubtotal = computed(() =>
        this.editItems().reduce((s, it) => s + (Number(it.lineTotal) || 0), 0)
    );

    private tempId = -1;

    constructor() {
        this.store.getAllProducts().subscribe({
            next: (list) => this.products.set(list ?? []),
            error: (err) => {
                console.error('getAllProducts failed', err);
                this.products.set([]);
            },
            complete: () => this.loadingProducts.set(false),
        });

        this.productCtrl.valueChanges.subscribe(() => {
            this.sizeCtrl.setValue(null);
            this.addError.set(null);
        });
    }

    sizesForSelected(): number[] {
        const pid = this.productCtrl.value;
        if (!pid) return [];

        const p = this.products().find((x) => x.id === pid);
        const sizes = (p?.skUs ?? []).map((x) => x.size).filter((x) => x != null);

        return Array.from(new Set(sizes));
    }

    canAdd(): boolean {
        return !!this.productCtrl.value && (Number(this.qtyCtrl.value) || 0) > 0;
    }

    add(): void {
        this.addError.set(null);

        const pid = this.productCtrl.value;
        const qty = Number(this.qtyCtrl.value || 0);
        const size = this.sizeCtrl.value;

        if (!pid) return this.addError.set('Επίλεξε προϊόν.');
        if (!qty || qty < 1) return this.addError.set('Βάλε ποσότητα (>= 1).');

        const p = this.products().find((x) => x.id === pid);
        if (!p) return this.addError.set('Το προϊόν δεν βρέθηκε.');

        const hasSkus = (p.skUs ?? []).length > 0;
        if (hasSkus && size == null) return this.addError.set('Επίλεξε μέγεθος.');

        const unitPrice = Number(p.price || 0);
        const lineTotal = unitPrice * qty;

        const existingIdx = this.editItems().findIndex(
            (x) => x.productId === pid && (x.size ?? null) === (size ?? null)
        );

        if (existingIdx >= 0) {
            const copy = [...this.editItems()];
            const old = copy[existingIdx];

            const newQty = Number(old.quantity || 0) + qty;

            copy[existingIdx] = {
                ...old,
                quantity: newQty,
                unitPrice,
                lineTotal: unitPrice * newQty,
                imageUrl: p.imageUrl ?? old.imageUrl,
                productTitle: p.title ?? old.productTitle,
                size: (size ?? old.size ?? null) as any,
            };

            this.editItems.set(copy);
        } else {
            const newItem: OrderItemEditVm = {
                id: this.tempId--,
                productId: pid,
                productTitle: p.title,
                imageUrl: p.imageUrl ?? null,
                quantity: qty,
                unitPrice,
                lineTotal,
                size: size ?? null,
                _temp: true,
            };

            this.editItems.set([newItem, ...this.editItems()]);
        }

        this.productCtrl.setValue(null);
        this.sizeCtrl.setValue(null);
        this.qtyCtrl.setValue(1);
    }

    remove(it: OrderItemEditVm): void {
        this.editItems.set(this.editItems().filter((x) => x.id !== it.id));
    }

    close(): void {
        this.dialogRef.close(null);
    }

    save(): void {
        const cleaned: CartItemDto[] = this.editItems().map((it) => ({
            id: it.id,
            productId: it.productId,
            productTitle: it.productTitle,
            imageUrl: it.imageUrl ?? null,
            quantity: Number(it.quantity || 0),
            unitPrice: Number(it.unitPrice || 0),
            lineTotal: Number(it.lineTotal || 0),
            size: it.size ?? null,
        }));

        this.dialogRef.close({ items: cleaned });
    }
}