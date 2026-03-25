import { CommonModule } from '@angular/common';
import {
    ChangeDetectionStrategy,
    ChangeDetectorRef,
    Component,
    OnDestroy,
    OnInit,
    ViewChild,
    inject,
    signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { Subject, forkJoin, takeUntil } from 'rxjs';
import { finalize } from 'rxjs/operators';
import { ImageUploadService } from '@fuse/services/general/image-upload.service';

import {
    BOOffersService,
    OfferCategoryDto,
    OfferDto,
} from '@fuse/services/offers/bo-offers.service';
import { FuseConfirmationService } from '@fuse/services/confirmation';
import { ClaimsService } from '@fuse/services/claims/claims.service';
import { BoPermissionDirective } from '@fuse/directives/permission/bo-permission.directive';

@Component({
    selector: 'bo-offers-list',
    standalone: true,
    imports: [
        CommonModule,
        ReactiveFormsModule,
        MatButtonModule,
        MatDialogModule,
        MatFormFieldModule,
        MatIconModule,
        MatInputModule,
        MatPaginatorModule,
        MatSelectModule,
        MatSlideToggleModule,
        MatSortModule,
        MatTableModule,
        MatTooltipModule,
        MatDatepickerModule,
        MatNativeDateModule,
        MatProgressBarModule,
        BoPermissionDirective,
    ],
    templateUrl: './bo-offers-list.component.html',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BOOffersListComponent implements OnInit, OnDestroy {
    readonly claimsService = inject(ClaimsService);
    private api = inject(BOOffersService);
    private fb = inject(FormBuilder);
    private cdr = inject(ChangeDetectorRef);
    private confirmation = inject(FuseConfirmationService);
    private imageUpload = inject(ImageUploadService);
    private destroy$ = new Subject<void>();

    loading = signal(false);
    saving = signal(false);
    uploading = signal(false);
    imagePreview: string | null = null;

    all: OfferDto[] = [];
    categories: OfferCategoryDto[] = [];
    dataSource = new MatTableDataSource<OfferDto>([]);

    @ViewChild(MatSort, { static: false }) sort?: MatSort;
    @ViewChild(MatPaginator, { static: false }) paginator?: MatPaginator;

    displayedColumns = ['image', 'title', 'category', 'discountLabel', 'validUntil', 'isActive', 'actions'];

    filters = this.fb.group({
        search: [''],
        categoryFilter: [0],
        statusFilter: ['all'],
    });

    totalOffers = signal(0);
    activeOffers = signal(0);
    inactiveOffers = signal(0);

    // ── Modal ────────────────────────────────────────────────────────────────
    modalOpen = false;
    editingId: number | null = null;

    form = this.fb.group({
        categoryId: [0, [Validators.required, Validators.min(1)]],
        title: ['', Validators.required],
        description: ['', Validators.required],
        imageUrl: [''],
        couponCode: [''],
        discountLabel: [''],
        validUntil: [null as string | null],
        terms: [''],
        detailsHtml: [''],
        ctaLabel: [''],
        ctaUrl: [''],
        address: [''],
        lat: [null as number | null],
        lng: [null as number | null],
        isActive: [true],
    });

    ngOnInit(): void {
        this._load();
        this.filters.valueChanges.pipe(takeUntil(this.destroy$)).subscribe(() => this._applyFilters());
    }

    _load(): void {
        this.loading.set(true);
        forkJoin({
            offers: this.api.getOffers(undefined, true),
            categories: this.api.getCategories(true),
        })
            .pipe(takeUntil(this.destroy$))
            .subscribe({
                next: ({ offers, categories }) => {
                    this.all = offers;
                    this.categories = categories;
                    this._updateStats(offers);
                    this._applyFilters();
                    this.loading.set(false);
                    this.cdr.markForCheck();
                },
                error: () => {
                    this.loading.set(false);
                    this.cdr.markForCheck();
                },
            });
    }

    // ── Stats ────────────────────────────────────────────────────────────────
    private _updateStats(data: OfferDto[]): void {
        this.totalOffers.set(data.length);
        this.activeOffers.set(data.filter((o) => o.isActive).length);
        this.inactiveOffers.set(data.filter((o) => !o.isActive).length);
    }

    // ── Filters ──────────────────────────────────────────────────────────────
    private _applyFilters(): void {
        const { search, categoryFilter, statusFilter } = this.filters.value;
        let filtered = [...this.all];

        if (search?.trim()) {
            const q = search.trim().toLowerCase();
            filtered = filtered.filter(
                (o) =>
                    o.title.toLowerCase().includes(q) ||
                    o.description.toLowerCase().includes(q) ||
                    (o.couponCode ?? '').toLowerCase().includes(q),
            );
        }

        if (categoryFilter && categoryFilter > 0) {
            filtered = filtered.filter((o) => o.categoryId === categoryFilter);
        }

        if (statusFilter === 'active') filtered = filtered.filter((o) => o.isActive);
        else if (statusFilter === 'inactive') filtered = filtered.filter((o) => !o.isActive);

        this.dataSource.data = filtered;
        if (this.sort) this.dataSource.sort = this.sort;
        if (this.paginator) this.dataSource.paginator = this.paginator;
        this.cdr.markForCheck();
    }

    resetFilters(): void {
        this.filters.setValue({ search: '', categoryFilter: 0, statusFilter: 'all' });
    }

    // ── Modal ────────────────────────────────────────────────────────────────
    openNew(): void {
        this.editingId = null;
        this.imagePreview = null;
        this.form.reset({
            categoryId: 0,
            title: '',
            description: '',
            imageUrl: '',
            couponCode: '',
            discountLabel: '',
            validUntil: null,
            terms: '',
            detailsHtml: '',
            ctaLabel: '',
            ctaUrl: '',
            address: '',
            lat: null,
            lng: null,
            isActive: true,
        });
        this.modalOpen = true;
        this.cdr.markForCheck();
    }

    openEdit(offer: OfferDto): void {
        this.editingId = offer.id;
        this.imagePreview = offer.imageUrl ?? null;
        this.form.setValue({
            categoryId: offer.categoryId,
            title: offer.title,
            description: offer.description,
            imageUrl: offer.imageUrl ?? '',
            couponCode: offer.couponCode ?? '',
            discountLabel: offer.discountLabel ?? '',
            validUntil: offer.validUntil ?? null,
            terms: offer.terms ?? '',
            detailsHtml: offer.detailsHtml ?? '',
            ctaLabel: offer.ctaLabel ?? '',
            ctaUrl: offer.ctaUrl ?? '',
            address: offer.address ?? '',
            lat: offer.lat ?? null,
            lng: offer.lng ?? null,
            isActive: offer.isActive ?? true,
        });
        this.modalOpen = true;
        this.cdr.markForCheck();
    }

    triggerFileInput(input: HTMLInputElement): void {
        input.click();
    }

    onFileSelected(ev: Event): void {
        const input = ev.target as HTMLInputElement;
        const file = input.files?.[0];
        input.value = '';
        if (!file) return;
        if (!file.type.startsWith('image/')) return;
        if (file.size > 3 * 1024 * 1024) return;

        const reader = new FileReader();
        reader.onload = () => {
            this.imagePreview = reader.result as string;
            this.cdr.markForCheck();
        };
        reader.readAsDataURL(file);

        const subfolder = this.editingId != null ? String(this.editingId) : 'new';
        this.uploading.set(true);
        this.imageUpload
            .uploadImage(file, 'offers', subfolder)
            .pipe(finalize(() => { this.uploading.set(false); this.cdr.markForCheck(); }))
            .subscribe({
                next: (res) => {
                    this.form.patchValue({ imageUrl: res.publicUrl });
                    this.imagePreview = res.publicUrl;
                    this.cdr.markForCheck();
                },
            });
    }

    removeImage(): void {
        this.form.patchValue({ imageUrl: '' });
        this.imagePreview = null;
        this.cdr.markForCheck();
    }

    closeModal(): void {
        this.modalOpen = false;
        this.editingId = null;
        this.imagePreview = null;
        this.cdr.markForCheck();
    }

    save(): void {
        if (this.form.invalid || this.saving()) return;

        const v = this.form.value;
        const req = {
            categoryId: v.categoryId!,
            title: v.title!,
            description: v.description!,
            imageUrl: v.imageUrl || null,
            couponCode: v.couponCode || null,
            discountLabel: v.discountLabel || null,
            validUntil: v.validUntil || null,
            terms: v.terms || null,
            detailsHtml: v.detailsHtml || null,
            ctaLabel: v.ctaLabel || null,
            ctaUrl: v.ctaUrl || null,
            address: v.address || null,
            lat: v.lat || null,
            lng: v.lng || null,
        };

        this.saving.set(true);

        const op$ =
            this.editingId == null
                ? this.api.createOffer(req)
                : this.api.updateOffer(this.editingId, req);

        op$.pipe(takeUntil(this.destroy$)).subscribe({
            next: (saved) => {
                if (this.editingId == null) {
                    this.all = [saved, ...this.all];
                } else {
                    this.all = this.all.map((o) => (o.id === saved.id ? saved : o));
                }
                this._updateStats(this.all);
                this._applyFilters();
                this.saving.set(false);
                this.closeModal();
            },
            error: () => {
                this.saving.set(false);
                this.cdr.markForCheck();
            },
        });
    }

    // ── Delete ───────────────────────────────────────────────────────────────
    deleteOffer(offer: OfferDto): void {
        this.confirmation
            .open({
                title: 'Διαγραφή Προσφοράς',
                message: `Είστε σίγουροι ότι θέλετε να διαγράψετε την προσφορά <strong>${offer.title}</strong>;`,
                icon: { show: true, name: 'heroicons_outline:trash', color: 'warn' },
                actions: {
                    confirm: { label: 'Διαγραφή', color: 'warn' },
                    cancel: { label: 'Ακύρωση' },
                },
            })
            .afterClosed()
            .pipe(takeUntil(this.destroy$))
            .subscribe((result) => {
                if (result !== 'confirmed') return;
                this.api
                    .deleteOffer(offer.id)
                    .pipe(takeUntil(this.destroy$))
                    .subscribe({
                        next: () => {
                            this.all = this.all.filter((o) => o.id !== offer.id);
                            this._updateStats(this.all);
                            this._applyFilters();
                        },
                        error: () => this.cdr.markForCheck(),
                    });
            });
    }

    // ── Toggle active ────────────────────────────────────────────────────────
    toggleActive(offer: OfferDto): void {
        const req = {
            categoryId: offer.categoryId,
            title: offer.title,
            description: offer.description,
            imageUrl: offer.imageUrl,
            couponCode: offer.couponCode,
            discountLabel: offer.discountLabel,
            validUntil: offer.validUntil,
            terms: offer.terms,
            detailsHtml: offer.detailsHtml,
            ctaLabel: offer.ctaLabel,
            ctaUrl: offer.ctaUrl,
            address: offer.address,
            lat: offer.lat,
            lng: offer.lng,
        };
        this.api
            .updateOffer(offer.id, req)
            .pipe(takeUntil(this.destroy$))
            .subscribe({
                next: (saved) => {
                    this.all = this.all.map((o) => (o.id === saved.id ? saved : o));
                    this._updateStats(this.all);
                    this._applyFilters();
                },
                error: () => this.cdr.markForCheck(),
            });
    }

    // ── Helpers ──────────────────────────────────────────────────────────────
    trackById(_: number, item: { id: number }): number {
        return item.id;
    }

    getCategoryLabel(id: number): string {
        return this.categories.find((c) => c.id === id)?.label ?? '—';
    }

    formatDate(d: string | null | undefined): string {
        if (!d) return '—';
        return new Date(d).toLocaleDateString('el-GR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    }

    ngOnDestroy(): void {
        this.destroy$.next();
        this.destroy$.complete();
    }
}
