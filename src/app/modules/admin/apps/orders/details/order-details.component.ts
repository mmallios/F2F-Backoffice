import { CommonModule, DatePipe, NgClass } from '@angular/common';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
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
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';

import { MatDialog, MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { FormControl, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatDividerModule } from '@angular/material/divider';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatProgressBarModule } from '@angular/material/progress-bar';

import {
  CartItemDto, OrderDetailsResponse, ProductDto, StoreService,
  UpdateOrderHeaderRequest, UpdateOrderItemsBatchRequest,
} from '@fuse/services/store/store.service';

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

export type ProductsDialogResult = { items: CartItemDto[]; saved: boolean } | null;

type DialogData = {
  orderCode: string;
  items: CartItemDto[];
};

type OrderItemEditVm = CartItemDto & { _temp?: boolean };

/* Edit-mode draft for the main order */
type OrderEditDraft = {
  status: number;
  shippingAmount: number;
  shipping: ShippingDetailsVm;
};

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
    FormsModule,

    MatButtonModule,
    MatIconModule,
    MatChipsModule,
    MatTooltipModule,
    MatSnackBarModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatProgressBarModule,
  ],
  templateUrl: './order-details.component.html',
})
export class OrderDetailsComponent {
  private route = inject(ActivatedRoute);
  private store = inject(StoreService);
  private dialog = inject(MatDialog);
  private snack = inject(MatSnackBar);
  private cdr = inject(ChangeDetectorRef);

  loading = signal(true);
  saving = signal(false);
  error = signal<string | null>(null);

  order = signal<OrderDetailsResponse | null>(null);

  // IMPORTANT: items should come from order()
  items = computed<CartItemDto[]>(() => this.order()?.items ?? []);

  user = computed<any | null>(() => (this.order() as any)?.user ?? null);

  subtotal = computed(() => this.items().reduce((sum, x) => sum + (Number(x.lineTotal ?? 0) || 0), 0));
  shipping = computed(() => {
    if (this.editMode()) return this.editDraft().shippingAmount;
    return Number(this.order()?.shippingAmount ?? 0) || 0;
  });
  total = computed(() => this.subtotal() + this.shipping());

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

  // ---- Edit mode ----
  editMode = signal(false);
  editDraft = signal<OrderEditDraft>({ status: 0, shippingAmount: 0, shipping: {} });

  readonly STATUS_OPTIONS = [
    { value: 0, label: 'Σε εκκρεμότητα' },
    { value: 1, label: 'Υποβλήθηκε' },
    { value: 2, label: 'Πληρώθηκε' },
    { value: 3, label: 'Απεστάλη' },
    { value: 4, label: 'Ολοκληρώθηκε' },
    { value: 5, label: 'Ακυρώθηκε' },
  ];

  constructor() {
    this.route.paramMap
      .pipe(finalize(() => { }))
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
      u.fullname || u.fullName || u.Fullname ||
      [u.firstname ?? u.Firstname, u.lastname ?? u.Lastname].filter(Boolean).join(' ') ||
      u.email || '—'
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
  retry(): void { this.loadByRoute(); }

  // ---- Edit mode for order header ----
  startEdit(): void {
    const o = this.order();
    if (!o) return;
    const sd = this.shippingDetails();
    this.editDraft.set({
      status: o.status ?? 0,
      shippingAmount: Number(o.shippingAmount ?? 0),
      shipping: sd ? { ...sd } : {},
    });
    this.editMode.set(true);
  }

  cancelEdit(): void {
    this.editMode.set(false);
  }

  saveEdit(): void {
    const o = this.order();
    if (!o) return;
    const d = this.editDraft();

    // Rebuild orderData JSON with updated shippingDetails
    let orderDataObj: any = {};
    try {
      if (o.orderData) orderDataObj = JSON.parse(o.orderData);
    } catch { }
    orderDataObj = { ...orderDataObj, shippingDetails: d.shipping };

    const payload: UpdateOrderHeaderRequest = {
      status: d.status,
      shippingAmount: d.shipping ? d.shippingAmount : null,
      orderData: JSON.stringify(orderDataObj),
    };

    this.saving.set(true);
    this.store.updateOrderHeader(o.code, payload)
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: (updated) => {
          this.order.set(updated);
          this.editMode.set(false);
          this.snack.open('✅ Η παραγγελία ενημερώθηκε.', 'OK', { duration: 3000 });
        },
        error: (err) => {
          this.snack.open(`❌ ${err?.error?.message ?? 'Αποτυχία αποθήκευσης'}`, 'OK', { duration: 4000 });
        }
      });
  }

  // ===== MODAL: edit products =====
  openProductsEditor(): void {
    const o = this.order();
    if (!o) return;

    const dlg = this.dialog.open(OrderProductsEditDialogComponent, {
      width: '980px',
      maxWidth: '96vw',
      autoFocus: false,
      panelClass: ['f2f-dialog', 'rounded-2xl'],
      data: { orderCode: o.code, items: structuredClone(this.items()) } satisfies DialogData,
    });

    dlg.afterClosed().subscribe((result: ProductsDialogResult) => {
      if (!result) return;
      // If server-saved, the dialog returns the fresh server response
      const current = this.order();
      if (!current) return;
      this.order.set({ ...current, items: result.items });
      if (result.saved) {
        this.snack.open('✅ Τα προϊόντα αποθηκεύτηκαν.', 'OK', { duration: 3000 });
      }
    });
  }

  // helper for template to patch draft fields
  patchShipping(field: keyof ShippingDetailsVm, value: string): void {
    const d = this.editDraft();
    this.editDraft.set({ ...d, shipping: { ...d.shipping, [field]: value } });
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
    MatCheckboxModule,
    MatProgressBarModule,
  ],
  template: `
<div class="bg-card rounded-2xl overflow-hidden flex flex-col" style="max-height:90vh">
  <!-- HEADER -->
  <div class="px-6 py-5 border-b flex items-start justify-between gap-4 shrink-0">
    <div class="min-w-0">
      <div class="text-xl font-extrabold tracking-tight">Επεξεργασία προϊόντων</div>
      <div class="text-secondary text-sm mt-1">
        Αλλαγή ποσότητας, διαγραφή / προσθήκη προϊόντων. Αποθήκευση στέλνει στον server.
      </div>
    </div>
    <button mat-icon-button (click)="close()" matTooltip="Κλείσιμο" [disabled]="saving()">
      <mat-icon [svgIcon]="'heroicons_outline:x-mark'"></mat-icon>
    </button>
  </div>

  @if (saving()) {
    <mat-progress-bar mode="indeterminate" class="shrink-0"></mat-progress-bar>
  }

  <!-- BODY -->
  <div class="p-6 space-y-5 overflow-auto flex-1">

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
              <!-- Image -->
              <div class="w-12 h-12 rounded-xl overflow-hidden bg-gray-100 dark:bg-gray-800 flex items-center justify-center shrink-0">
                @if (it.imageUrl) {
                  <img [src]="it.imageUrl" class="h-full w-full object-cover" alt="Προϊόν" />
                } @else {
                  <mat-icon [svgIcon]="'heroicons_outline:photo'"></mat-icon>
                }
              </div>

              <!-- Info -->
              <div class="min-w-0 flex-1">
                <div class="flex items-center gap-2 min-w-0">
                  <div class="font-semibold truncate">{{ it.productTitle }}</div>
                  @if (it.isGift) {
                    <span class="inline-flex items-center gap-1 rounded-full bg-pink-100 text-pink-700 dark:bg-pink-500/20 dark:text-pink-300 text-xs font-semibold px-2 py-0.5 shrink-0">
                      <mat-icon style="font-size:12px;width:12px;height:12px">card_giftcard</mat-icon>
                      Δώρο
                    </span>
                  }
                </div>
                <div class="text-secondary text-xs mt-0.5 flex flex-wrap gap-x-3">
                  <span>Τιμή: <span class="font-medium text-gray-900 dark:text-gray-100">{{ it.isGift ? '0.00' : (it.unitPrice | number:'1.2-2') }} €</span></span>
                  <span>Σύνολο: <span class="font-semibold text-gray-900 dark:text-gray-100">{{ it.isGift ? '0.00' : (it.lineTotal | number:'1.2-2') }} €</span></span>
                </div>
              </div>

              <!-- Size select -->
              @if (sizesForItem(it).length) {
                <div class="w-24 shrink-0">
                  <mat-form-field class="fuse-mat-dense fuse-mat-rounded w-full" subscriptSizing="dynamic">
                    <mat-label>Μέγεθος</mat-label>
                    <mat-select [value]="it.size" (selectionChange)="changeSize(it, $event.value)">
                      @for (s of sizesForItem(it); track s) {
                        <mat-option [value]="s">{{ sizeLabel(s) }}</mat-option>
                      }
                    </mat-select>
                  </mat-form-field>
                </div>
              } @else {
                <div class="w-24 shrink-0 text-center text-xs text-secondary">{{ sizeLabel(it.size) }}</div>
              }

              <!-- Quantity input -->
              <div class="w-20 shrink-0">
                <mat-form-field class="fuse-mat-dense fuse-mat-rounded w-full" subscriptSizing="dynamic">
                  <mat-label>Qty</mat-label>
                  <input matInput type="number" min="1"
                    [value]="it.quantity"
                    (change)="changeQty(it, +$any($event.target).value)" />
                </mat-form-field>
              </div>

              <!-- Delete -->
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
      <div class="font-bold mb-4">Προσθήκη προϊόντος</div>

      <div class="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
        <!-- Product -->
        <div class="md:col-span-5">
          <mat-form-field class="fuse-mat-dense fuse-mat-rounded w-full" subscriptSizing="dynamic">
            <mat-label>Προϊόν</mat-label>
            <mat-select [formControl]="productCtrl">
              @for (p of products(); track p.id) {
                <mat-option [value]="p.id">
                  <div class="flex items-center gap-3">
                    <div class="w-8 h-8 rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-800 shrink-0 flex items-center justify-center">
                      @if (p.imageUrl) {
                        <img [src]="p.imageUrl" class="h-full w-full object-cover" />
                      } @else {
                        <mat-icon [svgIcon]="'heroicons_outline:photo'" style="font-size:16px;width:16px;height:16px"></mat-icon>
                      }
                    </div>
                    <div class="min-w-0">
                      <div class="font-semibold leading-none">{{ p.title }}</div>
                      <div class="text-secondary text-xs mt-0.5">{{ p.code }}</div>
                    </div>
                  </div>
                </mat-option>
              }
            </mat-select>
          </mat-form-field>
        </div>

        <!-- Size -->
        <div class="md:col-span-2">
          <mat-form-field class="fuse-mat-dense fuse-mat-rounded w-full" subscriptSizing="dynamic">
            <mat-label>Μέγεθος</mat-label>
            <mat-select [formControl]="sizeCtrl" [disabled]="!sizesForSelected().length">
              <mat-option [value]="null">—</mat-option>
              @for (s of sizesForSelected(); track s) {
                <mat-option [value]="s">{{ sizeLabel(s) }}</mat-option>
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

        <!-- Gift checkbox -->
        <div class="md:col-span-2 flex items-center gap-2 pb-1">
          <mat-checkbox [(ngModel)]="isGiftNew" color="primary">
            <span class="text-sm">Δώρο</span>
          </mat-checkbox>
        </div>

        <!-- Add button -->
        <div class="md:col-span-1 flex md:justify-end pb-1">
          <button mat-flat-button color="primary" class="!rounded-xl w-full md:w-auto"
                  (click)="add()" [disabled]="!canAdd()">
            <mat-icon [svgIcon]="'heroicons_outline:plus'"></mat-icon>
          </button>
        </div>
      </div>

      @if (isGiftNew) {
        <div class="mt-2 text-xs text-pink-600 dark:text-pink-400 flex items-center gap-1">
          <mat-icon style="font-size:14px;width:14px;height:14px">card_giftcard</mat-icon>
          Το προϊόν θα προστεθεί ως δώρο (τιμή = 0 €).
        </div>
      }

      @if (addError()) {
        <div class="mt-3 text-sm text-red-600 dark:text-red-400">{{ addError() }}</div>
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
  <div class="px-6 py-4 border-t flex items-center justify-end gap-2 shrink-0">
    <button mat-stroked-button class="!rounded-xl" (click)="close()" [disabled]="saving()">Άκυρο</button>
    <button mat-flat-button color="primary" class="!rounded-xl" (click)="save()" [disabled]="saving()">
      <mat-icon [svgIcon]="'heroicons_outline:check'"></mat-icon>
      <span class="ml-2">{{ saving() ? 'Αποθήκευση…' : 'Αποθήκευση' }}</span>
    </button>
  </div>
</div>
`,
})
export class OrderProductsEditDialogComponent {
  private store = inject(StoreService);
  private dialogRef = inject(MatDialogRef<OrderProductsEditDialogComponent, ProductsDialogResult>);
  private data = inject<DialogData>(MAT_DIALOG_DATA);

  editItems = signal<OrderItemEditVm[]>((this.data?.items ?? []).map(i => ({ ...i, isGift: i.isGift ?? false })));

  loadingProducts = signal(true);
  saving = signal(false);
  products = signal<ProductDto[]>([]);

  productCtrl = new FormControl<number | null>(null);
  sizeCtrl = new FormControl<number | null>(null);
  qtyCtrl = new FormControl<number>(1, { nonNullable: true });
  isGiftNew = false;

  addError = signal<string | null>(null);

  previewSubtotal = computed(() =>
    this.editItems().reduce((s, it) => s + (it.isGift ? 0 : Number(it.lineTotal) || 0), 0)
  );

  private tempId = -1;

  constructor() {
    this.store.getAllProducts().subscribe({
      next: (list) => this.products.set(list ?? []),
      error: () => this.products.set([]),
      complete: () => this.loadingProducts.set(false),
    });

    this.productCtrl.valueChanges.subscribe(() => {
      this.sizeCtrl.setValue(null);
      this.addError.set(null);
    });
  }

  readonly SIZES = [
    { value: 0, label: 'XS' },
    { value: 1, label: 'S' },
    { value: 2, label: 'M' },
    { value: 3, label: 'L' },
    { value: 4, label: 'XL' },
    { value: 5, label: 'XXL' },
    { value: 6, label: 'XXXL' },
  ];

  sizeLabel(size: number | null | undefined): string {
    if (size == null) return '—';
    return this.SIZES.find(s => s.value === size)?.label ?? String(size);
  }

  sizesForItem(it: OrderItemEditVm): number[] {
    const p = this.products().find(x => x.id === it.productId);
    if (p) {
      const sizes = (p.skUs ?? []).map(x => x.size).filter(x => x != null) as number[];
      const unique = Array.from(new Set(sizes));
      if (unique.length) return unique;
    }
    if (it.size != null) return this.SIZES.map(s => s.value);
    return [];
  }

  changeSize(it: OrderItemEditVm, size: number | null): void {
    this.editItems.set(this.editItems().map(x =>
      x.id === it.id ? { ...x, size } : x
    ));
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

  changeQty(it: OrderItemEditVm, qty: number): void {
    if (!qty || qty < 1) qty = 1;
    const copy = this.editItems().map(x => {
      if (x.id !== it.id) return x;
      const lineTotal = it.isGift ? 0 : Number(x.unitPrice || 0) * qty;
      return { ...x, quantity: qty, lineTotal };
    });
    this.editItems.set(copy);
  }

  add(): void {
    this.addError.set(null);

    const pid = this.productCtrl.value;
    const qty = Number(this.qtyCtrl.value || 0);
    const size = this.sizeCtrl.value;
    const isGift = this.isGiftNew;

    if (!pid) { this.addError.set('Επίλεξε προϊόν.'); return; }
    if (!qty || qty < 1) { this.addError.set('Βάλε ποσότητα (>= 1).'); return; }

    const p = this.products().find((x) => x.id === pid);
    if (!p) { this.addError.set('Το προϊόν δεν βρέθηκε.'); return; }

    const hasSkus = (p.skUs ?? []).length > 0;
    if (hasSkus && size == null) { this.addError.set('Επίλεξε μέγεθος.'); return; }

    const unitPrice = isGift ? 0 : Number(p.price || 0);
    const lineTotal = isGift ? 0 : unitPrice * qty;

    // Check if same product+size already exists
    const existingIdx = this.editItems().findIndex(
      (x) => x.productId === pid && (x.size ?? null) === (size ?? null)
    );

    if (existingIdx >= 0) {
      const copy = [...this.editItems()];
      const old = copy[existingIdx];
      const newQty = Number(old.quantity || 0) + qty;
      const up = isGift ? 0 : Number(old.unitPrice || unitPrice);
      copy[existingIdx] = {
        ...old,
        quantity: newQty,
        unitPrice: up,
        lineTotal: isGift ? 0 : up * newQty,
        imageUrl: p.imageUrl ?? old.imageUrl,
        productTitle: p.title ?? old.productTitle,
        size: (size ?? old.size ?? null) as any,
        isGift,
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
        isGift,
        _temp: true,
      };
      this.editItems.set([newItem, ...this.editItems()]);
    }

    this.productCtrl.setValue(null);
    this.sizeCtrl.setValue(null);
    this.qtyCtrl.setValue(1);
    this.isGiftNew = false;
  }

  remove(it: OrderItemEditVm): void {
    this.editItems.set(this.editItems().filter((x) => x.id !== it.id));
  }

  close(): void {
    this.dialogRef.close(null);
  }

  save(): void {
    const payload: UpdateOrderItemsBatchRequest = {
      items: this.editItems().map(it => ({
        id: it._temp ? 0 : it.id,
        productId: it.productId,
        quantity: Number(it.quantity || 0),
        unitPrice: it.isGift ? 0 : Number(it.unitPrice || 0),
        lineTotal: it.isGift ? 0 : Number(it.lineTotal || 0),
        size: it.size ?? null,
        isGift: it.isGift ?? false,
      })),
    };

    this.saving.set(true);
    this.store.updateOrderItems(this.data.orderCode, payload)
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: (updated) => {
          this.dialogRef.close({ items: updated.items, saved: true });
        },
        error: (err) => {
          console.error('updateOrderItems failed', err);
          // Fallback: close with local changes, not server-saved
          const items: CartItemDto[] = this.editItems().map(it => ({
            id: it.id,
            productId: it.productId,
            productTitle: it.productTitle,
            imageUrl: it.imageUrl ?? null,
            quantity: Number(it.quantity || 0),
            unitPrice: Number(it.unitPrice || 0),
            lineTotal: Number(it.lineTotal || 0),
            size: it.size ?? null,
            isGift: it.isGift ?? false,
          }));
          this.dialogRef.close({ items, saved: false });
        },
      });
  }
}