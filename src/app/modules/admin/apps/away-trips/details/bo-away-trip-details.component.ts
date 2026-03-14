import { CommonModule } from '@angular/common';
import {
    ChangeDetectionStrategy,
    ChangeDetectorRef,
    Component,
    OnDestroy,
    OnInit,
    inject,
    signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { Subject, forkJoin, takeUntil } from 'rxjs';
import { finalize } from 'rxjs/operators';

import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSortModule } from '@angular/material/sort';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTooltipModule } from '@angular/material/tooltip';

import {
    BOAwayTripsService,
    AwayTripDetailDto,
    AwayTripCategoryDto,
    AwayTripInterestDto,
    AwayTripNotificationDto,
    SendAwayTripNotificationRequest,
} from '@fuse/services/away-trips/bo-away-trips.service';
import { EventItem, EventsService } from '@fuse/services/events/events.service';
import { FuseConfirmationService } from '@fuse/services/confirmation';
import { ImageUploadService } from '@fuse/services/general/image-upload.service';
import { AuthService } from 'app/core/auth/auth.service';
import { SendNotificationDialogComponent } from '../dialogs/send-notification-dialog.component';

@Component({
    selector: 'bo-away-trip-details',
    standalone: true,
    imports: [
        CommonModule,
        RouterModule,
        ReactiveFormsModule,
        MatButtonModule,
        MatDialogModule,
        MatFormFieldModule,
        MatIconModule,
        MatInputModule,
        MatProgressBarModule,
        MatSelectModule,
        MatSlideToggleModule,
        MatSortModule,
        MatTableModule,
        MatTabsModule,
        MatTooltipModule,
    ],
    templateUrl: './bo-away-trip-details.component.html',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BOAwayTripDetailsComponent implements OnInit, OnDestroy {
    private api = inject(BOAwayTripsService);
    private eventsApi = inject(EventsService);
    private fb = inject(FormBuilder);
    private cdr = inject(ChangeDetectorRef);
    private route = inject(ActivatedRoute);
    private router = inject(Router);
    private dialog = inject(MatDialog);
    private confirmation = inject(FuseConfirmationService);
    private imageUpload = inject(ImageUploadService);
    private auth = inject(AuthService);
    private destroy$ = new Subject<void>();

    tripId: number | null = null;
    trip: AwayTripDetailDto | null = null;
    events: EventItem[] = [];

    loading = signal(false);
    saving = signal(false);
    sendingNotif = signal(false);
    uploading = signal(false);
    imagePreview: string | null = null;

    // Info tab: view mode by default, EDIT button switches to edit mode
    infoEditMode = false;

    // Categories
    categories: AwayTripCategoryDto[] = [];
    catDS = new MatTableDataSource<AwayTripCategoryDto>([]);
    catColumns = ['seatView', 'name', 'price', 'maxPerUser', 'totalAvailable', 'booked', 'actions'];
    catModalOpen = false;
    editingCatId: number | null = null;
    catImagePreview: string | null = null;
    catUploading = signal(false);

    // Category interests modal (shows all trip interests contextualised for the category)
    catInterestsModalOpen = false;
    catInterestsCat: AwayTripCategoryDto | null = null;

    // Interests
    interests: AwayTripInterestDto[] = [];
    interestDS = new MatTableDataSource<AwayTripInterestDto>([]);
    interestColumns = ['avatar', 'name', 'code', 'email', 'registeredAt', 'actions'];

    // User details modal
    userDetailsModalOpen = false;
    selectedUser: AwayTripInterestDto | null = null;

    // Notifications
    notifications: AwayTripNotificationDto[] = [];

    // Forms
    infoForm = this.fb.group({
        title: ['', Validators.required],
        description: [''],
        imageUrl: [''],
        eventId: [null as number | null],
        isActive: [false],
    });

    catForm = this.fb.group({
        name: ['', Validators.required],
        price: [0, [Validators.required, Validators.min(0)]],
        maxPerUser: [1, [Validators.required, Validators.min(1)]],
        totalAvailable: [0, [Validators.required, Validators.min(0)]],
        seatViewImageUrl: [''],
        order: [0],
    });

    // ── Derived stats ────────────────────────────────────────────────────────
    get totalAvailableTickets(): number {
        return this.categories.reduce((s, c) => s + (c.totalAvailable ?? 0), 0);
    }

    // ── Lifecycle ────────────────────────────────────────────────────────────
    ngOnInit(): void {
        const idParam = this.route.snapshot.paramMap.get('id');
        if (idParam && idParam !== 'new') {
            this.tripId = +idParam;
            this._load();
        }
    }

    _load(): void {
        if (!this.tripId) return;
        this.loading.set(true);

        forkJoin({
            trip: this.api.getTripById(this.tripId),
            events: this.eventsApi.getEvents(),
        })
            .pipe(takeUntil(this.destroy$))
            .subscribe({
                next: ({ trip, events }) => {
                    this.trip = trip;
                    this.categories = [...(trip.categories ?? [])];
                    this.catDS.data = this.categories;
                    this.notifications = [...(trip.notifications ?? [])];
                    this.events = events;

                    this.infoForm.patchValue({
                        title: trip.title,
                        description: trip.description ?? '',
                        imageUrl: trip.imageUrl ?? '',
                        eventId: trip.event?.eventId ?? null,
                        isActive: trip.isActive,
                    });
                    this.imagePreview = trip.imageUrl ?? null;
                    this.infoEditMode = false;

                    this._loadInterests();
                    this.loading.set(false);
                    this.cdr.markForCheck();
                },
                error: () => { this.loading.set(false); this.cdr.markForCheck(); },
            });
    }

    private _loadInterests(): void {
        if (!this.tripId) return;
        this.api.getInterests(this.tripId)
            .pipe(takeUntil(this.destroy$))
            .subscribe({
                next: (interests) => {
                    this.interests = interests;
                    this.interestDS.data = interests;
                    this.cdr.markForCheck();
                },
            });
    }

    // ── Info tab ─────────────────────────────────────────────────────────────
    enterEditMode(): void {
        this.infoEditMode = true;
        this.cdr.markForCheck();
    }

    cancelEditMode(): void {
        if (this.trip) {
            this.infoForm.patchValue({
                title: this.trip.title,
                description: this.trip.description ?? '',
                imageUrl: this.trip.imageUrl ?? '',
                eventId: this.trip.event?.eventId ?? null,
                isActive: this.trip.isActive,
            });
            this.imagePreview = this.trip.imageUrl ?? null;
        }
        this.infoEditMode = false;
        this.cdr.markForCheck();
    }

    saveInfo(): void {
        if (!this.tripId || this.infoForm.invalid || this.saving()) return;
        const v = this.infoForm.value;
        this.saving.set(true);

        this.api.updateTrip(this.tripId, {
            title: v.title!,
            description: v.description || null,
            imageUrl: v.imageUrl || null,
            eventId: v.eventId || null,
            isActive: v.isActive ?? false,
        })
            .pipe(takeUntil(this.destroy$))
            .subscribe({
                next: () => {
                    if (this.trip) {
                        this.trip = { ...this.trip, title: v.title!, isActive: v.isActive ?? false };
                    }
                    this.infoEditMode = false;
                    this.saving.set(false);
                    this.cdr.markForCheck();
                },
                error: () => { this.saving.set(false); this.cdr.markForCheck(); },
            });
    }

    // ── Toggle Active (with confirmation) ───────────────────────────────────
    confirmToggleActive(): void {
        if (!this.trip) return;
        const isActive = this.trip.isActive;

        this.confirmation.open({
            title: isActive ? 'Απενεργοποίηση Away Trip' : 'Ενεργοποίηση Away Trip',
            message: isActive
                ? 'Είστε σίγουροι ότι θέλετε να <strong>απενεργοποιήσετε</strong> αυτό το Away Trip; Δεν θα εμφανίζεται ολοκληρωμένα στους χρήστες.'
                : 'Είστε σίγουροι ότι θέλετε να <strong>ενεργοποιήσετε</strong> αυτό το Away Trip; Θα γίνει πλήρως ορατό στους χρήστες.',
            icon: {
                show: true,
                name: isActive ? 'heroicons_outline:lock-closed' : 'heroicons_outline:lock-open',
                color: isActive ? 'warn' : 'primary',
            },
            actions: {
                confirm: { label: isActive ? 'Απενεργοποίηση' : 'Ενεργοποίηση', color: isActive ? 'warn' : 'primary' },
                cancel: { label: 'Ακύρωση' },
            },
        })
            .afterClosed()
            .pipe(takeUntil(this.destroy$))
            .subscribe(result => {
                if (result !== 'confirmed') return;
                this.api.toggleActive(this.tripId!)
                    .pipe(takeUntil(this.destroy$))
                    .subscribe({
                        next: (res) => {
                            if (this.trip) this.trip = { ...this.trip, isActive: res.isActive };
                            this.infoForm.patchValue({ isActive: res.isActive });
                            this.cdr.markForCheck();
                        },
                    });
            });
    }

    // ── Image upload (info) ──────────────────────────────────────────────────
    triggerFileInput(input: HTMLInputElement): void { input.click(); }

    onFileSelected(ev: Event): void {
        const input = ev.target as HTMLInputElement;
        const file = input.files?.[0];
        input.value = '';
        if (!file || !file.type.startsWith('image/') || file.size > 3 * 1024 * 1024) return;

        const reader = new FileReader();
        reader.onload = () => { this.imagePreview = reader.result as string; this.cdr.markForCheck(); };
        reader.readAsDataURL(file);

        this.uploading.set(true);
        this.imageUpload
            .uploadImage(file, 'away-trips', String(this.tripId ?? 'new'))
            .pipe(finalize(() => { this.uploading.set(false); this.cdr.markForCheck(); }))
            .subscribe({
                next: (res) => {
                    this.infoForm.patchValue({ imageUrl: res.publicUrl });
                    this.imagePreview = res.publicUrl;
                    this.cdr.markForCheck();
                },
            });
    }

    removeImage(): void {
        this.infoForm.patchValue({ imageUrl: '' });
        this.imagePreview = null;
        this.cdr.markForCheck();
    }

    // ── Categories ───────────────────────────────────────────────────────────
    openNewCategory(): void {
        this.editingCatId = null;
        this.catImagePreview = null;
        this.catForm.reset({ name: '', price: 0, maxPerUser: 1, totalAvailable: 0, seatViewImageUrl: '', order: 0 });
        this.catModalOpen = true;
        this.cdr.markForCheck();
    }

    openEditCategory(cat: AwayTripCategoryDto): void {
        this.editingCatId = cat.id;
        this.catImagePreview = cat.seatViewImageUrl ?? null;
        this.catForm.setValue({
            name: cat.name,
            price: cat.price,
            maxPerUser: cat.maxPerUser,
            totalAvailable: cat.totalAvailable ?? 0,
            seatViewImageUrl: cat.seatViewImageUrl ?? '',
            order: cat.order,
        });
        this.catModalOpen = true;
        this.cdr.markForCheck();
    }

    closeCatModal(): void {
        this.catModalOpen = false;
        this.editingCatId = null;
        this.catImagePreview = null;
        this.cdr.markForCheck();
    }

    saveCategory(): void {
        if (!this.tripId || this.catForm.invalid) return;
        const v = this.catForm.value;
        const req = {
            name: v.name!,
            price: v.price ?? 0,
            maxPerUser: v.maxPerUser ?? 1,
            totalAvailable: v.totalAvailable ?? 0,
            seatViewImageUrl: v.seatViewImageUrl || null,
            order: v.order ?? 0,
        };

        if (this.editingCatId == null) {
            this.api.createCategory(this.tripId, req)
                .pipe(takeUntil(this.destroy$))
                .subscribe({
                    next: (cat) => {
                        this.categories = [cat, ...this.categories];
                        this.catDS.data = this.categories;
                        this.closeCatModal();
                        this.cdr.markForCheck();
                    },
                    error: () => this.cdr.markForCheck(),
                });
        } else {
            this.api.updateCategory(this.tripId, this.editingCatId, req)
                .pipe(takeUntil(this.destroy$))
                .subscribe({
                    next: () => {
                        this.categories = this.categories.map(c =>
                            c.id === this.editingCatId ? { ...c, ...req, id: c.id } : c,
                        );
                        this.catDS.data = this.categories;
                        this.closeCatModal();
                        this.cdr.markForCheck();
                    },
                    error: () => this.cdr.markForCheck(),
                });
        }
    }

    deleteCategory(cat: AwayTripCategoryDto): void {
        if (!this.tripId) return;
        this.confirmation.open({
            title: 'Διαγραφή Κατηγορίας',
            message: `Είστε σίγουροι ότι θέλετε να διαγράψετε την κατηγορία <strong>${cat.name}</strong>;`,
            icon: { show: true, name: 'heroicons_outline:trash', color: 'warn' },
            actions: { confirm: { label: 'Διαγραφή', color: 'warn' }, cancel: { label: 'Ακύρωση' } },
        })
            .afterClosed()
            .pipe(takeUntil(this.destroy$))
            .subscribe(result => {
                if (result !== 'confirmed') return;
                this.api.deleteCategory(this.tripId!, cat.id)
                    .pipe(takeUntil(this.destroy$))
                    .subscribe({
                        next: () => {
                            this.categories = this.categories.filter(c => c.id !== cat.id);
                            this.catDS.data = this.categories;
                            this.cdr.markForCheck();
                        },
                    });
            });
    }

    openCatInterests(cat: AwayTripCategoryDto): void {
        this.catInterestsCat = cat;
        this.catInterestsModalOpen = true;
        this.cdr.markForCheck();
    }

    closeCatInterests(): void {
        this.catInterestsModalOpen = false;
        this.catInterestsCat = null;
        this.cdr.markForCheck();
    }

    // ── Category image upload ────────────────────────────────────────────────
    onCatFileSelected(ev: Event): void {
        const input = ev.target as HTMLInputElement;
        const file = input.files?.[0];
        input.value = '';
        if (!file || !file.type.startsWith('image/') || file.size > 3 * 1024 * 1024) return;

        const reader = new FileReader();
        reader.onload = () => { this.catImagePreview = reader.result as string; this.cdr.markForCheck(); };
        reader.readAsDataURL(file);

        this.catUploading.set(true);
        this.imageUpload
            .uploadImage(file, 'away-trips', `cat-${this.editingCatId ?? 'new'}`)
            .pipe(finalize(() => { this.catUploading.set(false); this.cdr.markForCheck(); }))
            .subscribe({
                next: (res) => {
                    this.catForm.patchValue({ seatViewImageUrl: res.publicUrl });
                    this.catImagePreview = res.publicUrl;
                    this.cdr.markForCheck();
                },
            });
    }

    removeCatImage(): void {
        this.catForm.patchValue({ seatViewImageUrl: '' });
        this.catImagePreview = null;
        this.cdr.markForCheck();
    }

    // ── User details modal ───────────────────────────────────────────────────
    openUserDetails(user: AwayTripInterestDto): void {
        this.selectedUser = user;
        this.userDetailsModalOpen = true;
        this.cdr.markForCheck();
    }

    closeUserDetails(): void {
        this.userDetailsModalOpen = false;
        this.selectedUser = null;
        this.cdr.markForCheck();
    }

    // ── Send Notification ────────────────────────────────────────────────────
    openSendNotification(): void {
        const ref = this.dialog.open(SendNotificationDialogComponent, {
            width: '520px',
            disableClose: false,
        });

        ref.afterClosed()
            .pipe(takeUntil(this.destroy$))
            .subscribe((req: SendAwayTripNotificationRequest | null) => {
                if (!req || !this.tripId) return;
                req.sentByBoUserId = this.auth.currentUser?.boUserId ?? null;
                this.sendingNotif.set(true);
                this.api.sendNotification(this.tripId, req)
                    .pipe(
                        takeUntil(this.destroy$),
                        finalize(() => { this.sendingNotif.set(false); this.cdr.markForCheck(); }),
                    )
                    .subscribe({
                        next: (notif) => {
                            this.notifications = [notif, ...this.notifications];
                            this.cdr.markForCheck();
                        },
                    });
            });
    }

    // ── Helpers ──────────────────────────────────────────────────────────────
    trackById(_: number, item: { id: number }): number { return item.id; }

    formatDate(d: string | null | undefined): string {
        if (!d) return '—';
        return new Date(d).toLocaleDateString('el-GR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    }

    formatDateShort(d: string | null | undefined): string {
        if (!d) return '—';
        return new Date(d).toLocaleDateString('el-GR', { day: '2-digit', month: 'short', year: 'numeric' });
    }

    goBack(): void {
        this.router.navigate(['/apps/away-trips']);
    }

    ngOnDestroy(): void {
        this.destroy$.next();
        this.destroy$.complete();
    }
}
