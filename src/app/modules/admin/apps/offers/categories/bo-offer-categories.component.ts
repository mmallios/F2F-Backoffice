import { CommonModule } from '@angular/common';
import {
    ChangeDetectionStrategy,
    ChangeDetectorRef,
    Component,
    inject,
    OnDestroy,
    OnInit,
    signal,
} from '@angular/core';
import {
    FormBuilder,
    ReactiveFormsModule,
    Validators,
} from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Subject, takeUntil } from 'rxjs';

import { FuseConfirmationService } from '@fuse/services/confirmation';
import {
    BOOffersService,
    OfferCategoryDto,
} from '@fuse/services/offers/bo-offers.service';
import { ClaimsService } from '@fuse/services/claims/claims.service';
import { BoPermissionDirective } from '@fuse/directives/permission/bo-permission.directive';

@Component({
    selector: 'bo-offer-categories',
    standalone: true,
    imports: [
        CommonModule,
        ReactiveFormsModule,
        MatButtonModule,
        MatDialogModule,
        MatFormFieldModule,
        MatIconModule,
        MatInputModule,
        MatSlideToggleModule,
        MatTooltipModule,
        BoPermissionDirective,
    ],
    templateUrl: './bo-offer-categories.component.html',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BOOfferCategoriesComponent implements OnInit, OnDestroy {
    readonly claimsService = inject(ClaimsService);
    private _api = inject(BOOffersService);
    private _confirm = inject(FuseConfirmationService);
    private _fb = inject(FormBuilder);
    private _cdr = inject(ChangeDetectorRef);
    private _destroy$ = new Subject<void>();

    loading = signal(true);
    saving = signal(false);
    categories: OfferCategoryDto[] = [];

    // Modal state
    modalOpen = false;
    editingId: number | null = null;

    form = this._fb.group({
        code: ['', [Validators.required, Validators.maxLength(50)]],
        label: ['', [Validators.required, Validators.maxLength(100)]],
        icon: [''],
        order: [0, [Validators.required, Validators.min(0)]],
        isActive: [true],
    });

    ngOnInit(): void {
        this._load();
    }

    ngOnDestroy(): void {
        this._destroy$.next();
        this._destroy$.complete();
    }

    private _load(): void {
        this.loading.set(true);
        this._api
            .getCategories(true)
            .pipe(takeUntil(this._destroy$))
            .subscribe({
                next: (cats) => {
                    this.categories = cats;
                    this.loading.set(false);
                    this._cdr.markForCheck();
                },
                error: () => {
                    this.loading.set(false);
                    this._cdr.markForCheck();
                },
            });
    }

    openNew(): void {
        this.editingId = null;
        this.form.reset({ code: '', label: '', icon: '', order: 0, isActive: true });
        this.modalOpen = true;
        this._cdr.markForCheck();
    }

    openEdit(cat: OfferCategoryDto): void {
        this.editingId = cat.id;
        this.form.reset({
            code: cat.code,
            label: cat.label,
            icon: cat.icon ?? '',
            order: cat.order,
            isActive: cat.isActive,
        });
        this.modalOpen = true;
        this._cdr.markForCheck();
    }

    closeModal(): void {
        this.modalOpen = false;
        this._cdr.markForCheck();
    }

    save(): void {
        if (this.form.invalid) {
            this.form.markAllAsTouched();
            return;
        }

        const v = this.form.getRawValue();
        this.saving.set(true);

        if (this.editingId == null) {
            this._api
                .createCategory({ code: v.code!, label: v.label!, icon: v.icon || null, order: v.order! })
                .pipe(takeUntil(this._destroy$))
                .subscribe({
                    next: (cat) => {
                        this.categories = [...this.categories, cat];
                        this.saving.set(false);
                        this.modalOpen = false;
                        this._cdr.markForCheck();
                    },
                    error: () => {
                        this.saving.set(false);
                        this._cdr.markForCheck();
                    },
                });
        } else {
            this._api
                .updateCategory(this.editingId, {
                    code: v.code!,
                    label: v.label!,
                    icon: v.icon || null,
                    order: v.order!,
                    isActive: v.isActive!,
                })
                .pipe(takeUntil(this._destroy$))
                .subscribe({
                    next: (updated) => {
                        this.categories = this.categories.map((c) =>
                            c.id === updated.id ? updated : c
                        );
                        this.saving.set(false);
                        this.modalOpen = false;
                        this._cdr.markForCheck();
                    },
                    error: () => {
                        this.saving.set(false);
                        this._cdr.markForCheck();
                    },
                });
        }
    }

    deleteCategory(cat: OfferCategoryDto): void {
        this._confirm
            .open({
                title: 'Διαγραφή Κατηγορίας',
                message: `Θέλετε να απενεργοποιήσετε την κατηγορία <strong>"${cat.label}"</strong>; Οι προσφορές της δεν θα εμφανίζονται.`,
                icon: { show: true, name: 'heroicons_outline:exclamation-triangle', color: 'warn' },
                actions: { confirm: { label: 'Διαγραφή', color: 'warn' }, cancel: { label: 'Ακύρωση' } },
            })
            .afterClosed()
            .pipe(takeUntil(this._destroy$))
            .subscribe((result) => {
                if (result !== 'confirmed') return;
                this._api
                    .deleteCategory(cat.id)
                    .pipe(takeUntil(this._destroy$))
                    .subscribe({
                        next: () => {
                            this.categories = this.categories.filter((c) => c.id !== cat.id);
                            this._cdr.markForCheck();
                        },
                    });
            });
    }

    trackById(_: number, cat: OfferCategoryDto): number {
        return cat.id;
    }

    get activeCount(): number {
        return this.categories.filter((c) => c.isActive).length;
    }

    get totalOffers(): number {
        return this.categories.reduce((sum, c) => sum + c.offerCount, 0);
    }
}
