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
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { Subject, forkJoin, takeUntil } from 'rxjs';
import { finalize } from 'rxjs/operators';

import {
    BOAwayTripsService,
    AwayTripListDto,
} from '@fuse/services/away-trips/bo-away-trips.service';
import { EventItem, EventsService } from '@fuse/services/events/events.service';
import { FuseConfirmationService } from '@fuse/services/confirmation';
import { ImageUploadService } from '@fuse/services/general/image-upload.service';

@Component({
    selector: 'bo-away-trips-list',
    standalone: true,
    imports: [
        CommonModule,
        ReactiveFormsModule,
        MatButtonModule,
        MatFormFieldModule,
        MatIconModule,
        MatInputModule,
        MatPaginatorModule,
        MatSelectModule,
        MatSlideToggleModule,
        MatSortModule,
        MatTableModule,
        MatTooltipModule,
        MatProgressBarModule,
    ],
    templateUrl: './bo-away-trips-list.component.html',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BOAwayTripsListComponent implements OnInit, OnDestroy {
    private api = inject(BOAwayTripsService);
    private eventsApi = inject(EventsService);
    private fb = inject(FormBuilder);
    private cdr = inject(ChangeDetectorRef);
    private router = inject(Router);
    private confirmation = inject(FuseConfirmationService);
    private imageUpload = inject(ImageUploadService);
    private destroy$ = new Subject<void>();

    loading = signal(false);
    saving = signal(false);
    uploading = signal(false);
    imagePreview: string | null = null;

    all: AwayTripListDto[] = [];
    events: EventItem[] = [];
    dataSource = new MatTableDataSource<AwayTripListDto>([]);

    @ViewChild(MatSort, { static: false }) sort?: MatSort;
    @ViewChild(MatPaginator, { static: false }) paginator?: MatPaginator;

    displayedColumns = ['image', 'title', 'event', 'isActive', 'interestCount', 'actions'];

    totalTrips = signal(0);
    activeTrips = signal(0);
    inactiveTrips = signal(0);
    totalInterests = signal(0);

    filters = this.fb.group({
        search: [''],
        statusFilter: ['all'],
    });

    // ── Modal ────────────────────────────────────────────────────────────────
    modalOpen = false;
    editingId: number | null = null;

    form = this.fb.group({
        title: ['', Validators.required],
        description: [''],
        imageUrl: [''],
        eventId: [null as number | null],
        isActive: [false],
    });

    ngOnInit(): void {
        this._load();
        this.filters.valueChanges.pipe(takeUntil(this.destroy$)).subscribe(() => this._applyFilters());
    }

    _load(): void {
        this.loading.set(true);
        forkJoin({
            trips: this.api.getTrips(),
            events: this.eventsApi.getEvents(),
        })
            .pipe(takeUntil(this.destroy$))
            .subscribe({
                next: ({ trips, events }) => {
                    this.all = trips;
                    this.events = events;
                    this._updateStats(trips);
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

    private _updateStats(data: AwayTripListDto[]): void {
        this.totalTrips.set(data.length);
        this.activeTrips.set(data.filter(t => t.isActive).length);
        this.inactiveTrips.set(data.filter(t => !t.isActive).length);
        this.totalInterests.set(data.reduce((sum, t) => sum + (t.interestCount ?? 0), 0));
    }

    private _applyFilters(): void {
        const { search, statusFilter } = this.filters.value;
        let filtered = [...this.all];

        if (search?.trim()) {
            const q = search.trim().toLowerCase();
            filtered = filtered.filter(t =>
                t.title.toLowerCase().includes(q) ||
                (t.description ?? '').toLowerCase().includes(q),
            );
        }

        if (statusFilter === 'active') filtered = filtered.filter(t => t.isActive);
        else if (statusFilter === 'inactive') filtered = filtered.filter(t => !t.isActive);

        this.dataSource.data = filtered;
        if (this.sort) this.dataSource.sort = this.sort;
        if (this.paginator) this.dataSource.paginator = this.paginator;
        this.cdr.markForCheck();
    }

    resetFilters(): void {
        this.filters.setValue({ search: '', statusFilter: 'all' });
    }

    // ── Modal ────────────────────────────────────────────────────────────────
    openNew(): void {
        this.editingId = null;
        this.imagePreview = null;
        this.form.reset({ title: '', description: '', imageUrl: '', eventId: null, isActive: false });
        this.modalOpen = true;
        this.cdr.markForCheck();
    }

    openEdit(trip: AwayTripListDto): void {
        this.editingId = trip.id;
        this.imagePreview = trip.imageUrl ?? null;
        this.form.setValue({
            title: trip.title,
            description: trip.description ?? '',
            imageUrl: trip.imageUrl ?? '',
            eventId: trip.event?.eventId ?? null,
            isActive: trip.isActive,
        });
        this.modalOpen = true;
        this.cdr.markForCheck();
    }

    openDetails(trip: AwayTripListDto): void {
        this.router.navigate(['/apps/away-trips', trip.id]);
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
        this.saving.set(true);

        if (this.editingId == null) {
            const req = {
                title: v.title!,
                description: v.description || null,
                imageUrl: v.imageUrl || null,
                eventId: v.eventId || null,
            };
            this.api.createTrip(req)
                .pipe(takeUntil(this.destroy$))
                .subscribe({
                    next: (saved) => {
                        this.all = [saved, ...this.all];
                        this._updateStats(this.all);
                        this._applyFilters();
                        this.saving.set(false);
                        this.closeModal();
                    },
                    error: () => { this.saving.set(false); this.cdr.markForCheck(); },
                });
        } else {
            const req = {
                title: v.title!,
                description: v.description || null,
                imageUrl: v.imageUrl || null,
                eventId: v.eventId || null,
                isActive: v.isActive ?? false,
            };
            this.api.updateTrip(this.editingId, req)
                .pipe(takeUntil(this.destroy$))
                .subscribe({
                    next: () => {
                        this.all = this.all.map(t =>
                            t.id === this.editingId
                                ? { ...t, ...req, event: t.event }
                                : t,
                        );
                        this._updateStats(this.all);
                        this._applyFilters();
                        this.saving.set(false);
                        this.closeModal();
                    },
                    error: () => { this.saving.set(false); this.cdr.markForCheck(); },
                });
        }
    }

    toggleActive(trip: AwayTripListDto): void {
        this.api.toggleActive(trip.id)
            .pipe(takeUntil(this.destroy$))
            .subscribe({
                next: (res) => {
                    this.all = this.all.map(t => t.id === trip.id ? { ...t, isActive: res.isActive } : t);
                    this._updateStats(this.all);
                    this._applyFilters();
                },
                error: () => this.cdr.markForCheck(),
            });
    }

    deleteTrip(trip: AwayTripListDto): void {
        this.confirmation
            .open({
                title: 'Διαγραφή Away Trip',
                message: `Είστε σίγουροι ότι θέλετε να διαγράψετε το <strong>${trip.title}</strong>;`,
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
                this.api.deleteTrip(trip.id)
                    .pipe(takeUntil(this.destroy$))
                    .subscribe({
                        next: () => {
                            this.all = this.all.filter(t => t.id !== trip.id);
                            this._updateStats(this.all);
                            this._applyFilters();
                        },
                        error: () => this.cdr.markForCheck(),
                    });
            });
    }

    // ── Image upload ─────────────────────────────────────────────────────────
    triggerFileInput(input: HTMLInputElement): void {
        input.click();
    }

    onFileSelected(ev: Event): void {
        const input = ev.target as HTMLInputElement;
        const file = input.files?.[0];
        input.value = '';
        if (!file || !file.type.startsWith('image/') || file.size > 3 * 1024 * 1024) return;

        const reader = new FileReader();
        reader.onload = () => { this.imagePreview = reader.result as string; this.cdr.markForCheck(); };
        reader.readAsDataURL(file);

        const subfolder = this.editingId != null ? String(this.editingId) : 'new';
        this.uploading.set(true);
        this.imageUpload
            .uploadImage(file, 'away-trips', subfolder)
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

    // ── Helpers ──────────────────────────────────────────────────────────────
    trackById(_: number, item: { id: number }): number {
        return item.id;
    }

    getEventLabel(eventId: number | null | undefined): string {
        if (!eventId) return '—';
        const e = this.events.find(ev => ev.id === eventId);
        return e ? `${e.homeTeamName} vs ${e.awayTeamName}` : '—';
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
