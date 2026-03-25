import { CommonModule, DatePipe, NgClass } from '@angular/common';
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
import { FormControl, FormGroup, ReactiveFormsModule, UntypedFormControl, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MAT_DIALOG_DATA, MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatChipsModule } from '@angular/material/chips';
import { Subject, finalize, takeUntil } from 'rxjs';
import {
    CategoryDto,
    StoreService,
    UpdateCategoryRequest,
} from '@fuse/services/store/store.service';
import { ClaimsService } from '@fuse/services/claims/claims.service';

/* =========================================================
   DIALOG: Add / Edit Category
   ========================================================= */

type DialogMode = 'add' | 'edit';
type DialogData = { mode: DialogMode; category?: CategoryDto };
type DialogResult = CategoryDto | null;

@Component({
    selector: 'category-form-dialog',
    standalone: true,
    encapsulation: ViewEncapsulation.None,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        CommonModule,
        ReactiveFormsModule,
        MatDialogModule,
        MatButtonModule,
        MatIconModule,
        MatFormFieldModule,
        MatInputModule,
        MatCheckboxModule,
        MatProgressBarModule,
    ],
    template: `
<div class="bg-card rounded-2xl overflow-hidden flex flex-col" style="min-width:420px;max-width:95vw">
  <div class="px-6 py-5 border-b flex items-start justify-between gap-4 shrink-0">
    <div class="text-xl font-extrabold tracking-tight">
      {{ data.mode === 'add' ? 'Νέα Κατηγορία' : 'Επεξεργασία Κατηγορίας' }}
    </div>
    <button mat-icon-button (click)="close()" [disabled]="saving">
      <mat-icon [svgIcon]="'heroicons_outline:x-mark'"></mat-icon>
    </button>
  </div>

  @if (saving) {
    <mat-progress-bar mode="indeterminate" class="shrink-0"></mat-progress-bar>
  }

  <div class="p-6 space-y-4 overflow-auto flex-1">
    <mat-form-field class="fuse-mat-dense fuse-mat-rounded w-full" subscriptSizing="dynamic">
      <mat-label>Όνομα *</mat-label>
      <input matInput [formControl]="form.controls.name" />
    </mat-form-field>

    <mat-form-field class="fuse-mat-dense fuse-mat-rounded w-full" subscriptSizing="dynamic">
      <mat-label>Κωδικός</mat-label>
      <input matInput [formControl]="form.controls.code" />
    </mat-form-field>

    <mat-form-field class="fuse-mat-dense fuse-mat-rounded w-full" subscriptSizing="dynamic">
      <mat-label>Περιγραφή</mat-label>
      <textarea matInput rows="3" [formControl]="form.controls.description"></textarea>
    </mat-form-field>

    <mat-form-field class="fuse-mat-dense fuse-mat-rounded w-full" subscriptSizing="dynamic">
      <mat-label>URL Εικόνας</mat-label>
      <input matInput [formControl]="form.controls.imageUrl" />
    </mat-form-field>

    <div class="grid grid-cols-2 gap-3">
      <mat-form-field class="fuse-mat-dense fuse-mat-rounded w-full" subscriptSizing="dynamic">
        <mat-label>Σειρά</mat-label>
        <input matInput type="number" [formControl]="form.controls.order" />
      </mat-form-field>

      <div class="flex items-center gap-2 pt-2">
        <mat-checkbox [formControl]="form.controls.isActive" color="primary">
          <span class="text-sm">Ενεργή</span>
        </mat-checkbox>
      </div>
    </div>

    @if (error) {
      <div class="text-sm text-red-600 dark:text-red-400">{{ error }}</div>
    }
  </div>

  <div class="px-6 py-4 border-t flex items-center justify-end gap-2 shrink-0">
    <button mat-stroked-button class="!rounded-xl" (click)="close()" [disabled]="saving">Άκυρο</button>
    <button mat-flat-button color="primary" class="!rounded-xl" (click)="submit()" [disabled]="saving || form.invalid">
      <mat-icon [svgIcon]="'heroicons_outline:check'"></mat-icon>
      <span class="ml-2">{{ saving ? 'Αποθήκευση…' : 'Αποθήκευση' }}</span>
    </button>
  </div>
</div>
`,
})
export class CategoryFormDialogComponent {
    private _api = inject(StoreService);
    private _cdr = inject(ChangeDetectorRef);
    dialogRef = inject(MatDialogRef<CategoryFormDialogComponent, DialogResult>);
    data = inject<DialogData>(MAT_DIALOG_DATA);

    saving = false;
    error: string | null = null;

    form = new FormGroup({
        name: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
        code: new FormControl('', { nonNullable: true }),
        description: new FormControl<string | null>(null),
        imageUrl: new FormControl<string | null>(null),
        isActive: new FormControl(true, { nonNullable: true }),
        order: new FormControl(0, { nonNullable: true }),
    });

    constructor() {
        if (this.data.mode === 'edit' && this.data.category) {
            const c = this.data.category;
            this.form.patchValue({
                name: c.name,
                code: c.code,
                description: c.description ?? null,
                imageUrl: c.imageUrl ?? null,
                isActive: c.isActive,
                order: c.order,
            });
        }
    }

    close(): void {
        this.dialogRef.close(null);
    }

    submit(): void {
        if (this.form.invalid) return;
        const v = this.form.getRawValue();

        const payload: UpdateCategoryRequest = {
            name: v.name,
            code: v.code,
            description: v.description,
            imageUrl: v.imageUrl,
            isActive: v.isActive,
            order: v.order,
        };

        this.saving = true;
        this.error = null;
        this._cdr.markForCheck();

        if (this.data.mode === 'add') {
            this._api.addCategory({ name: v.name, code: v.code, description: v.description, imageUrl: v.imageUrl, isActive: v.isActive, order: v.order })
                .pipe(finalize(() => { this.saving = false; this._cdr.markForCheck(); }))
                .subscribe({
                    next: (cat) => this.dialogRef.close(cat),
                    error: (err) => {
                        this.error = err?.error?.message ?? 'Αποτυχία αποθήκευσης.';
                        this._cdr.markForCheck();
                    },
                });
        } else {
            this._api.updateCategory(this.data.category!.id, payload)
                .pipe(finalize(() => { this.saving = false; this._cdr.markForCheck(); }))
                .subscribe({
                    next: (cat) => this.dialogRef.close(cat),
                    error: (err) => {
                        this.error = err?.error?.message ?? 'Αποτυχία αποθήκευσης.';
                        this._cdr.markForCheck();
                    },
                });
        }
    }
}

/* =========================================================
   PRODUCT CATEGORIES PAGE
   ========================================================= */

@Component({
    selector: 'product-categories',
    standalone: true,
    encapsulation: ViewEncapsulation.None,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        CommonModule,
        NgClass,
        DatePipe,
        ReactiveFormsModule,
        MatButtonModule,
        MatIconModule,
        MatTooltipModule,
        MatSnackBarModule,
        MatProgressBarModule,
        MatFormFieldModule,
        MatInputModule,
        MatTableModule,
        MatSortModule,
        MatPaginatorModule,
        MatChipsModule,
    ],
    template: `
<div class="absolute inset-0 flex min-w-0 flex-col overflow-hidden">

  <!-- HEADER -->
  <div class="shrink-0 border-b bg-card px-6 py-7 md:px-8">
    <div class="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
      <div class="min-w-0">
        <div class="text-3xl md:text-4xl font-extrabold leading-none tracking-tight">Κατηγορίες</div>
        <div class="text-secondary mt-2 font-medium">
          @if (!loading) { {{ categories.length }} κατηγορί{{ categories.length === 1 ? 'α' : 'ες' }} }
        </div>
      </div>

      <div class="flex w-full flex-col gap-3 sm:flex-row lg:w-auto lg:items-center">
        <!-- Search -->
        <mat-form-field class="fuse-mat-dense fuse-mat-rounded fuse-mat-no-subscript w-full sm:w-56" subscriptSizing="dynamic">
          <mat-icon matPrefix [svgIcon]="'heroicons_outline:magnifying-glass'"></mat-icon>
          <input matInput [formControl]="searchCtrl" placeholder="Αναζήτηση…" />
        </mat-form-field>

        <button mat-stroked-button class="!rounded-xl w-full sm:w-auto" (click)="reload()" [disabled]="loading">
          <mat-icon [svgIcon]="'heroicons_outline:arrow-path'"></mat-icon>
          <span class="ml-2">Ανανέωση</span>
        </button>

        <button mat-flat-button color="primary" class="!rounded-xl w-full sm:w-auto" (click)="openAdd()" [disabled]="!claimsService.canEdit('PRODUCT_CATEGORIES')">
          <mat-icon [svgIcon]="'heroicons_outline:plus'"></mat-icon>
          <span class="ml-2">Νέα Κατηγορία</span>
        </button>
      </div>
    </div>
  </div>

  <!-- SCROLL AREA -->
  <div class="flex-1 min-h-0 overflow-auto">
    <div class="px-4 md:px-6 py-6">
      <div class="bg-card rounded-2xl border shadow-sm overflow-hidden">

        <!-- Loading skeleton -->
        @if (loading) {
          <div class="p-8">
            <div class="animate-pulse space-y-3">
              <div class="h-4 w-1/3 rounded bg-gray-200 dark:bg-gray-700"></div>
              <div class="h-4 w-2/3 rounded bg-gray-200 dark:bg-gray-700"></div>
              <div class="h-4 w-1/2 rounded bg-gray-200 dark:bg-gray-700"></div>
            </div>
          </div>
        } @else if (!dataSource.data.length) {
          <!-- Empty state -->
          <div class="p-12 text-center">
            <mat-icon [svgIcon]="'heroicons_outline:tag'" class="!w-16 !h-16 opacity-30 mx-auto"></mat-icon>
            <div class="text-2xl font-semibold tracking-tight mt-4">Δεν υπάρχουν κατηγορίες</div>
            <div class="text-secondary mt-2">Δημιούργησε την πρώτη σου κατηγορία.</div>
            <button mat-flat-button color="primary" class="!rounded-xl mt-6" (click)="openAdd()">
              <mat-icon [svgIcon]="'heroicons_outline:plus'"></mat-icon>
              <span class="ml-2">Νέα Κατηγορία</span>
            </button>
          </div>
        } @else {
          <div class="overflow-x-auto">
            <table mat-table [dataSource]="dataSource" matSort class="min-w-[800px] w-full">

              <!-- Κατηγορία (image + name + code) -->
              <ng-container matColumnDef="category">
                <th mat-header-cell *matHeaderCellDef mat-sort-header class="px-6">Κατηγορία</th>
                <td mat-cell *matCellDef="let cat" class="px-6 py-3">
                  <div class="flex items-center gap-3">
                    <div class="h-10 w-10 rounded-xl overflow-hidden bg-gray-100 dark:bg-gray-800 flex items-center justify-center shrink-0">
                      @if (cat.imageUrl) {
                        <img [src]="cat.imageUrl" class="h-full w-full object-cover" alt="" />
                      } @else {
                        <mat-icon [svgIcon]="'heroicons_outline:tag'" class="opacity-40"></mat-icon>
                      }
                    </div>
                    <div class="min-w-0">
                      <div class="font-semibold truncate">{{ cat.name }}</div>
                      <div class="text-secondary text-xs font-mono truncate">{{ cat.code }}</div>
                    </div>
                  </div>
                </td>
              </ng-container>

              <!-- Περιγραφή -->
              <ng-container matColumnDef="description">
                <th mat-header-cell *matHeaderCellDef>Περιγραφή</th>
                <td mat-cell *matCellDef="let cat" class="py-3 max-w-xs">
                  <span class="text-sm line-clamp-2 text-secondary">{{ cat.description || '—' }}</span>
                </td>
              </ng-container>

              <!-- Σειρά -->
              <ng-container matColumnDef="order">
                <th mat-header-cell *matHeaderCellDef mat-sort-header class="w-20">Σειρά</th>
                <td mat-cell *matCellDef="let cat" class="py-3 font-semibold text-center">{{ cat.order }}</td>
              </ng-container>

              <!-- Κατάσταση -->
              <ng-container matColumnDef="status">
                <th mat-header-cell *matHeaderCellDef>Κατάσταση</th>
                <td mat-cell *matCellDef="let cat" class="py-3">
                  <mat-chip class="!rounded-full !px-3 !text-xs !font-semibold"
                    [ngClass]="cat.isActive
                      ? 'bg-green-100 text-green-800 dark:bg-green-500/10 dark:text-green-300'
                      : 'bg-gray-100 text-gray-800 dark:bg-white/5 dark:text-gray-200'">
                    {{ cat.isActive ? 'Ενεργή' : 'Ανενεργή' }}
                  </mat-chip>
                </td>
              </ng-container>

              <!-- Ημερομηνία δημιουργίας -->
              <ng-container matColumnDef="createdOn">
                <th mat-header-cell *matHeaderCellDef mat-sort-header>Δημιουργία</th>
                <td mat-cell *matCellDef="let cat" class="py-3 text-secondary text-sm">
                  {{ cat.createdOn ? (cat.createdOn | date:'mediumDate') : '—' }}
                </td>
              </ng-container>

              <!-- Actions -->
              <ng-container matColumnDef="actions">
                <th mat-header-cell *matHeaderCellDef class="text-right px-6"></th>
                <td mat-cell *matCellDef="let cat" class="text-right px-6 py-3">
                  <div class="inline-flex items-center gap-2">
                    <button mat-stroked-button class="!rounded-xl" (click)="openEdit(cat)" matTooltip="Επεξεργασία" [disabled]="!claimsService.canEdit('PRODUCT_CATEGORIES')">
                      <mat-icon [svgIcon]="'heroicons_outline:pencil-square'"></mat-icon>
                      <span class="ml-2">Επεξεργασία</span>
                    </button>
                    <button mat-icon-button color="warn" (click)="deleteCategory(cat)" matTooltip="Διαγραφή"
                      [disabled]="deletingId === cat.id || !claimsService.canDelete('PRODUCT_CATEGORIES')">
                      <mat-icon [svgIcon]="'heroicons_outline:trash'"></mat-icon>
                    </button>
                  </div>
                </td>
              </ng-container>

              <tr mat-header-row *matHeaderRowDef="cols"></tr>
              <tr mat-row *matRowDef="let row; columns: cols"
                  class="hover:bg-gray-50 dark:hover:bg-white/5 transition"></tr>
            </table>
          </div>
          <mat-paginator [pageSizeOptions]="[15, 30, 50]" showFirstLastButtons class="border-t"></mat-paginator>
        }
      </div>
    </div>
  </div>
</div>
`,
})
export class ProductCategoriesComponent implements OnInit, OnDestroy {
    @ViewChild(MatPaginator) paginator: MatPaginator;
    @ViewChild(MatSort) sort: MatSort;

    readonly claimsService = inject(ClaimsService);
    private _api = inject(StoreService);
    private _dialog = inject(MatDialog);
    private _snack = inject(MatSnackBar);
    private _cdr = inject(ChangeDetectorRef);
    private _unsubscribeAll = new Subject<void>();

    loading = true;
    categories: CategoryDto[] = [];
    deletingId: number | null = null;

    cols: string[] = ['category', 'description', 'order', 'status', 'createdOn', 'actions'];
    dataSource = new MatTableDataSource<CategoryDto>([]);
    searchCtrl = new UntypedFormControl('');

    ngOnInit(): void {
        this.dataSource.filterPredicate = (cat: CategoryDto, raw: string) => {
            const q = raw.trim().toLowerCase();
            if (!q) return true;
            return [cat.name, cat.code, cat.description].filter(Boolean).join(' ').toLowerCase().includes(q);
        };

        this.searchCtrl.valueChanges
            .pipe(takeUntil(this._unsubscribeAll))
            .subscribe(v => {
                this.dataSource.filter = (v || '').trim().toLowerCase();
                this.dataSource.paginator?.firstPage();
                this._cdr.markForCheck();
            });

        this.reload();
    }

    ngOnDestroy(): void {
        this._unsubscribeAll.next();
        this._unsubscribeAll.complete();
    }

    reload(): void {
        this.loading = true;
        this._cdr.markForCheck();

        this._api.getAllCategories()
            .pipe(
                takeUntil(this._unsubscribeAll),
                finalize(() => { this.loading = false; this._cdr.markForCheck(); }),
            )
            .subscribe({
                next: (cats) => {
                    this.categories = (cats ?? []).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
                    this.dataSource.data = this.categories;
                    this.dataSource.paginator = this.paginator;
                    this.dataSource.sort = this.sort;
                    this._cdr.markForCheck();
                },
                error: () => {
                    this.categories = [];
                    this.dataSource.data = [];
                    this._snack.open('❌ Αποτυχία φόρτωσης κατηγοριών.', 'OK', { duration: 4000 });
                },
            });
    }

    openAdd(): void {
        const ref = this._dialog.open(CategoryFormDialogComponent, {
            autoFocus: false,
            panelClass: ['f2f-dialog', 'rounded-2xl'],
            data: { mode: 'add' } satisfies DialogData,
        });

        ref.afterClosed().subscribe((result: CategoryDto | null) => {
            if (!result) return;
            this.categories = [...this.categories, result].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
            this.dataSource.data = this.categories;
            this._snack.open('✅ Η κατηγορία δημιουργήθηκε.', 'OK', { duration: 3000 });
            this._cdr.markForCheck();
        });
    }

    openEdit(cat: CategoryDto): void {
        const ref = this._dialog.open(CategoryFormDialogComponent, {
            autoFocus: false,
            panelClass: ['f2f-dialog', 'rounded-2xl'],
            data: { mode: 'edit', category: cat } satisfies DialogData,
        });

        ref.afterClosed().subscribe((result: CategoryDto | null) => {
            if (!result) return;
            this.categories = this.categories
                .map(c => (c.id === result.id ? result : c))
                .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
            this.dataSource.data = this.categories;
            this._snack.open('✅ Η κατηγορία ενημερώθηκε.', 'OK', { duration: 3000 });
            this._cdr.markForCheck();
        });
    }

    deleteCategory(cat: CategoryDto): void {
        if (!confirm(`Διαγραφή κατηγορίας "${cat.name}";`)) return;

        this.deletingId = cat.id;
        this._cdr.markForCheck();

        this._api.deleteCategory(cat.id)
            .pipe(finalize(() => { this.deletingId = null; this._cdr.markForCheck(); }))
            .subscribe({
                next: () => {
                    this.categories = this.categories.filter(c => c.id !== cat.id);
                    this.dataSource.data = this.categories;
                    this._snack.open('✅ Η κατηγορία διαγράφηκε.', 'OK', { duration: 3000 });
                    this._cdr.markForCheck();
                },
                error: (err) => {
                    this._snack.open(`❌ ${err?.error?.message ?? 'Αποτυχία διαγραφής.'}`, 'OK', { duration: 4000 });
                },
            });
    }
}
