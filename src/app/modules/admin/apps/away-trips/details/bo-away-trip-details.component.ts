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
import { Subject, forkJoin, of, takeUntil } from 'rxjs';
import { catchError, finalize } from 'rxjs/operators';

import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
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
    AwayTripBookingDto,
    SendAwayTripNotificationRequest,
} from '@fuse/services/away-trips/bo-away-trips.service';
import { EventItem, EventsService } from '@fuse/services/events/events.service';
import { FuseConfirmationService } from '@fuse/services/confirmation';
import { GroupChatsService, CreateGroupChatDto } from '@fuse/services/groupchats/groupchats.service';
import { ImageUploadService } from '@fuse/services/general/image-upload.service';
import { User, UsersService } from '@fuse/services/users/users.service';
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
        MatSnackBarModule,
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
    private usersApi = inject(UsersService);
    private fb = inject(FormBuilder);
    private cdr = inject(ChangeDetectorRef);
    private route = inject(ActivatedRoute);
    private router = inject(Router);
    private dialog = inject(MatDialog);
    private confirmation = inject(FuseConfirmationService);
    private imageUpload = inject(ImageUploadService);
    private auth = inject(AuthService);
    private snack = inject(MatSnackBar);
    private groupChatsApi = inject(GroupChatsService);
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
    catColumns = ['seatView', 'name', 'price', 'totalAvailable', 'booked', 'actions'];
    catModalOpen = false;
    editingCatId: number | null = null;
    catImagePreview: string | null = null;
    catUploading = signal(false);

    // Category interests modal
    catInterestsModalOpen = false;
    catInterestsCat: AwayTripCategoryDto | null = null;

    // Bookings
    bookings: AwayTripBookingDto[] = [];
    bookingDS = new MatTableDataSource<AwayTripBookingDto>([]);
    bookingColumns = ['avatar', 'name', 'code', 'category', 'quantity', 'notes', 'bookedAt', 'actions'];
    bookingModalOpen = false;
    editingBookingId: number | null = null;

    // Interests
    interests: AwayTripInterestDto[] = [];
    interestDS = new MatTableDataSource<AwayTripInterestDto>([]);
    interestColumns = ['avatar', 'name', 'code', 'email', 'registeredAt', 'actions'];

    // Add Interest modal
    addInterestModalOpen = false;
    addInterestLoading = signal(false);
    userSearchQuery = '';
    allUsers: User[] = [];
    filteredUsers: User[] = [];

    // User details modal
    userDetailsModalOpen = false;
    selectedUser: AwayTripInterestDto | null = null;

    // Notification details modal
    notifDetailsModalOpen = false;
    selectedNotif: AwayTripNotificationDto | null = null;

    // Notifications
    notifications: AwayTripNotificationDto[] = [];

    // Group Chat creation modal
    groupChatModalOpen = false;
    hasGroupChat = signal(false);
    groupChatLoading = signal(false);
    groupChatImagePreview: string | null = null;
    groupChatUploading = signal(false);
    gcSelectedUserIds = new Set<number>();
    gcImageUrl: string | null = null;

    /** Deduplicated list of users from interests + bookings for member picker */
    get gcCandidates(): { userId: number; userFullName: string; userImageUrl: string | null }[] {
        const map = new Map<number, { userId: number; userFullName: string; userImageUrl: string | null }>();
        for (const i of this.interests) {
            map.set(i.userId, { userId: i.userId, userFullName: i.userFullName, userImageUrl: i.userImageUrl ?? null });
        }
        for (const b of this.bookings) {
            if (!map.has(b.userId)) {
                map.set(b.userId, { userId: b.userId, userFullName: b.userFullName, userImageUrl: b.userImageUrl ?? null });
            }
        }
        return [...map.values()];
    }

    // Forms
    infoForm = this.fb.group({
        title: ['', Validators.required],
        description: [''],
        imageUrl: [''],
        eventId: [null as number | null],
        maxTicketsPerUser: [1, [Validators.required, Validators.min(1)]],
        isActive: [false],
    });

    catForm = this.fb.group({
        name: ['', Validators.required],
        price: [0, [Validators.required, Validators.min(0)]],
        totalAvailable: [0, [Validators.required, Validators.min(0)]],
        seatViewImageUrl: [''],
        order: [0],
    });

    bookingForm = this.fb.group({
        userId: [null as number | null, Validators.required],
        categoryId: [null as number | null, Validators.required],
        quantity: [1, [Validators.required, Validators.min(1)]],
        notes: [''],
    });

    groupChatForm = this.fb.group({
        name: ['', Validators.required],
        description: [''],
    });

    // ── Derived stats ────────────────────────────────────────────────────────
    get totalAvailableTickets(): number {
        return this.categories.reduce((s, c) => s + (c.totalAvailable ?? 0), 0);
    }

    get totalBookedTickets(): number {
        return this.categories.reduce((s, c) => s + (c.bookedCount ?? 0), 0);
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
                        maxTicketsPerUser: trip.maxTicketsPerUser ?? 1,
                        isActive: trip.isActive,
                    });
                    this.imagePreview = trip.imageUrl ?? null;
                    this.infoEditMode = false;

                    this._loadInterests();
                    this._loadBookings();
                    this._checkGroupChat();
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

    private _loadBookings(): void {
        if (!this.tripId) return;
        this.api.getBookings(this.tripId)
            .pipe(takeUntil(this.destroy$))
            .subscribe({
                next: (bookings) => {
                    this.bookings = bookings;
                    this.bookingDS.data = bookings;
                    this.cdr.markForCheck();
                },
            });
    }

    private _checkGroupChat(): void {
        if (!this.tripId) return;
        this.groupChatsApi.getByCode(`AWAYTRIP-${this.tripId}`)
            .pipe(
                catchError(() => of(null)),
                takeUntil(this.destroy$),
            )
            .subscribe(result => {
                this.hasGroupChat.set(result != null);
                this.cdr.markForCheck();
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
                maxTicketsPerUser: this.trip.maxTicketsPerUser ?? 1,
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
            maxTicketsPerUser: v.maxTicketsPerUser ?? 1,
            isActive: v.isActive ?? false,
        })
            .pipe(takeUntil(this.destroy$))
            .subscribe({
                next: () => {
                    if (this.trip) {
                        this.trip = {
                            ...this.trip,
                            title: v.title!,
                            maxTicketsPerUser: v.maxTicketsPerUser ?? 1,
                            isActive: v.isActive ?? false,
                        };
                    }
                    this.infoEditMode = false;
                    this.saving.set(false);
                    this.snack.open('Οι πληροφορίες αποθηκεύτηκαν.', 'Κλείσιμο', { duration: 3000 });
                    this.cdr.markForCheck();
                },
                error: () => {
                    this.saving.set(false);
                    this.snack.open('Σφάλμα κατά την αποθήκευση.', 'Κλείσιμο', { duration: 4000 });
                    this.cdr.markForCheck();
                },
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
                            this.snack.open(res.isActive ? 'Away trip ενεργοποιήθηκε.' : 'Away trip απενεργοποιήθηκε.', 'Κλείσιμο', { duration: 3000 });
                            this.cdr.markForCheck();
                        },
                        error: () => {
                            this.snack.open('Σφάλμα κατά την αλλαγή κατάστασης.', 'Κλείσιμο', { duration: 4000 });
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
        this.catForm.reset({ name: '', price: 0, totalAvailable: 0, seatViewImageUrl: '', order: 0 });
        this.catModalOpen = true;
        this.cdr.markForCheck();
    }

    openEditCategory(cat: AwayTripCategoryDto): void {
        this.editingCatId = cat.id;
        this.catImagePreview = cat.seatViewImageUrl ?? null;
        this.catForm.setValue({
            name: cat.name,
            price: cat.price,
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
                        this.snack.open('Κατηγορία δημιουργήθηκε.', 'Κλείσιμο', { duration: 3000 });
                        this.cdr.markForCheck();
                    },
                    error: () => {
                        this.snack.open('Σφάλμα κατά τη δημιουργία κατηγορίας.', 'Κλείσιμο', { duration: 4000 });
                        this.cdr.markForCheck();
                    },
                });
        } else {
            this.api.updateCategory(this.tripId, this.editingCatId, req)
                .pipe(takeUntil(this.destroy$))
                .subscribe({
                    next: () => {
                        this.categories = this.categories.map(c =>
                            c.id === this.editingCatId ? { ...c, ...req, id: c.id, bookedCount: c.bookedCount } : c,
                        );
                        this.catDS.data = this.categories;
                        this.closeCatModal();
                        this.snack.open('Κατηγορία ενημερώθηκε.', 'Κλείσιμο', { duration: 3000 });
                        this.cdr.markForCheck();
                    },
                    error: () => {
                        this.snack.open('Σφάλμα κατά την ενημέρωση κατηγορίας.', 'Κλείσιμο', { duration: 4000 });
                        this.cdr.markForCheck();
                    },
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
                            this.snack.open('Κατηγορία διαγράφηκε.', 'Κλείσιμο', { duration: 3000 });
                            this.cdr.markForCheck();
                        },
                        error: () => {
                            this.snack.open('Σφάλμα κατά τη διαγραφή κατηγορίας.', 'Κλείσιμο', { duration: 4000 });
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

    // ── Bookings ─────────────────────────────────────────────────────────────
    openNewBooking(): void {
        this.editingBookingId = null;
        this.bookingForm.reset({ userId: null, categoryId: null, quantity: 1, notes: '' });
        this.bookingModalOpen = true;
        this.cdr.markForCheck();
    }

    openEditBooking(booking: AwayTripBookingDto): void {
        this.editingBookingId = booking.id;
        this.bookingForm.setValue({
            userId: booking.userId,
            categoryId: booking.categoryId,
            quantity: booking.quantity,
            notes: booking.notes ?? '',
        });
        this.bookingModalOpen = true;
        this.cdr.markForCheck();
    }

    closeBookingModal(): void {
        this.bookingModalOpen = false;
        this.editingBookingId = null;
        this.cdr.markForCheck();
    }

    saveBooking(): void {
        if (!this.tripId || this.bookingForm.invalid) return;
        const v = this.bookingForm.value;
        const req = {
            userId: v.userId!,
            categoryId: v.categoryId!,
            quantity: v.quantity ?? 1,
            notes: v.notes || null,
        };

        if (this.editingBookingId == null) {
            this.api.createBooking(this.tripId, req)
                .pipe(takeUntil(this.destroy$))
                .subscribe({
                    next: (b) => {
                        this.bookings = [b, ...this.bookings];
                        this.bookingDS.data = this.bookings;
                        this.categories = this.categories.map(c =>
                            c.id === b.categoryId ? { ...c, bookedCount: c.bookedCount + b.quantity } : c,
                        );
                        this.catDS.data = this.categories;
                        this.closeBookingModal();
                        this.snack.open('Κράτηση δημιουργήθηκε.', 'Κλείσιμο', { duration: 3000 });
                        this.cdr.markForCheck();
                    },
                    error: () => {
                        this.snack.open('Σφάλμα κατά τη δημιουργία κράτησης.', 'Κλείσιμο', { duration: 4000 });
                        this.cdr.markForCheck();
                    },
                });
        } else {
            this.api.updateBooking(this.tripId, this.editingBookingId, req)
                .pipe(takeUntil(this.destroy$))
                .subscribe({
                    next: () => {
                        const old = this.bookings.find(b => b.id === this.editingBookingId);
                        this.bookings = this.bookings.map(b =>
                            b.id === this.editingBookingId
                                ? {
                                    ...b,
                                    userId: req.userId,
                                    categoryId: req.categoryId,
                                    categoryName: this.categories.find(c => c.id === req.categoryId)?.name ?? b.categoryName,
                                    quantity: req.quantity,
                                    notes: req.notes,
                                }
                                : b,
                        );
                        this.bookingDS.data = this.bookings;
                        if (old) {
                            this.categories = this.categories.map(c => {
                                let count = c.bookedCount;
                                if (c.id === old.categoryId) count -= old.quantity;
                                if (c.id === req.categoryId) count += req.quantity;
                                return { ...c, bookedCount: Math.max(0, count) };
                            });
                            this.catDS.data = this.categories;
                        }
                        this.closeBookingModal();
                        this.snack.open('Κράτηση ενημερώθηκε.', 'Κλείσιμο', { duration: 3000 });
                        this.cdr.markForCheck();
                    },
                    error: () => {
                        this.snack.open('Σφάλμα κατά την ενημέρωση κράτησης.', 'Κλείσιμο', { duration: 4000 });
                        this.cdr.markForCheck();
                    },
                });
        }
    }

    deleteBooking(booking: AwayTripBookingDto): void {
        if (!this.tripId) return;
        this.confirmation.open({
            title: 'Διαγραφή Κράτησης',
            message: `Είστε σίγουροι ότι θέλετε να διαγράψετε την κράτηση για τον χρήστη <strong>${booking.userFullName}</strong>;`,
            icon: { show: true, name: 'heroicons_outline:trash', color: 'warn' },
            actions: { confirm: { label: 'Διαγραφή', color: 'warn' }, cancel: { label: 'Ακύρωση' } },
        })
            .afterClosed()
            .pipe(takeUntil(this.destroy$))
            .subscribe(result => {
                if (result !== 'confirmed') return;
                this.api.deleteBooking(this.tripId!, booking.id)
                    .pipe(takeUntil(this.destroy$))
                    .subscribe({
                        next: () => {
                            this.bookings = this.bookings.filter(b => b.id !== booking.id);
                            this.bookingDS.data = this.bookings;
                            this.categories = this.categories.map(c =>
                                c.id === booking.categoryId
                                    ? { ...c, bookedCount: Math.max(0, c.bookedCount - booking.quantity) }
                                    : c,
                            );
                            this.catDS.data = this.categories;
                            this.snack.open('Κράτηση διαγράφηκε.', 'Κλείσιμο', { duration: 3000 });
                            this.cdr.markForCheck();
                        },
                        error: () => {
                            this.snack.open('Σφάλμα κατά τη διαγραφή κράτησης.', 'Κλείσιμο', { duration: 4000 });
                            this.cdr.markForCheck();
                        },
                    });
            });
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

    // ── Add Interest modal ───────────────────────────────────────────────────
    openAddInterestModal(): void {
        this.userSearchQuery = '';
        this.usersApi.loadUsers()
            .pipe(takeUntil(this.destroy$))
            .subscribe({
                next: (users) => {
                    const existingIds = new Set(this.interests.map(i => i.userId));
                    this.allUsers = users.filter(u => u.id != null && !existingIds.has(u.id!));
                    this.filteredUsers = [...this.allUsers];
                    this.addInterestModalOpen = true;
                    this.cdr.markForCheck();
                },
            });
    }

    closeAddInterestModal(): void {
        this.addInterestModalOpen = false;
        this.userSearchQuery = '';
        this.filteredUsers = [];
        this.cdr.markForCheck();
    }

    onInterestUserSearch(query: string): void {
        const q = query.toLowerCase().trim();
        this.filteredUsers = q
            ? this.allUsers.filter(u =>
                `${u.firstname} ${u.lastname} ${u.email} ${u.code ?? ''}`.toLowerCase().includes(q))
            : [...this.allUsers];
        this.cdr.markForCheck();
    }

    confirmAddInterest(user: User): void {
        if (!this.tripId || !user.id || this.addInterestLoading()) return;
        this.addInterestLoading.set(true);
        this.api.addInterest(this.tripId, user.id)
            .pipe(
                takeUntil(this.destroy$),
                finalize(() => { this.addInterestLoading.set(false); this.cdr.markForCheck(); }),
            )
            .subscribe({
                next: (newInterest) => {
                    this.interests = [newInterest, ...this.interests];
                    this.interestDS.data = this.interests;
                    this.closeAddInterestModal();
                    this.snack.open('Χρήστης προστέθηκε στη λίστα ενδιαφέροντος.', 'Κλείσιμο', { duration: 3000 });
                },
                error: () => {
                    this.snack.open('Σφάλμα κατά την προσθήκη ενδιαφέροντος.', 'Κλείσιμο', { duration: 4000 });
                },
            });
    }

    deleteInterest(interest: AwayTripInterestDto): void {
        if (!this.tripId) return;
        this.confirmation.open({
            title: 'Αφαίρεση Ενδιαφέροντος',
            message: `Είστε σίγουροι ότι θέλετε να αφαιρέσετε το ενδιαφέρον του χρήστη <strong>${interest.userFullName}</strong>;`,
            icon: { show: true, name: 'heroicons_outline:trash', color: 'warn' },
            actions: { confirm: { label: 'Αφαίρεση', color: 'warn' }, cancel: { label: 'Ακύρωση' } },
        })
            .afterClosed()
            .pipe(takeUntil(this.destroy$))
            .subscribe(result => {
                if (result !== 'confirmed') return;
                this.api.deleteInterest(this.tripId!, interest.interestId)
                    .pipe(takeUntil(this.destroy$))
                    .subscribe({
                        next: () => {
                            this.interests = this.interests.filter(i => i.interestId !== interest.interestId);
                            this.interestDS.data = this.interests;
                            this.snack.open('Ενδιαφέρον αφαιρέθηκε.', 'Κλείσιμο', { duration: 3000 });
                            this.cdr.markForCheck();
                        },
                        error: () => {
                            this.snack.open('Σφάλμα κατά την αφαίρεση ενδιαφέροντος.', 'Κλείσιμο', { duration: 4000 });
                            this.cdr.markForCheck();
                        },
                    });
            });
    }

    // ── Group Chat creation modal ────────────────────────────────────────────
    openGroupChatModal(): void {
        this.groupChatForm.reset({ name: this.trip?.title ?? '', description: '' });
        this.groupChatImagePreview = null;
        this.gcImageUrl = null;
        this.gcSelectedUserIds = new Set(this.gcCandidates.map(u => u.userId));
        this.groupChatModalOpen = true;
        this.cdr.markForCheck();
    }

    closeGroupChatModal(): void {
        this.groupChatModalOpen = false;
        this.groupChatImagePreview = null;
        this.gcImageUrl = null;
        this.gcSelectedUserIds = new Set();
        this.cdr.markForCheck();
    }

    toggleGcUser(userId: number): void {
        if (this.gcSelectedUserIds.has(userId)) {
            this.gcSelectedUserIds.delete(userId);
        } else {
            this.gcSelectedUserIds.add(userId);
        }
        this.cdr.markForCheck();
    }

    selectAllGcUsers(): void {
        this.gcSelectedUserIds = new Set(this.gcCandidates.map(u => u.userId));
        this.cdr.markForCheck();
    }

    onGcFileSelected(ev: Event): void {
        const input = ev.target as HTMLInputElement;
        const file = input.files?.[0];
        input.value = '';
        if (!file || !file.type.startsWith('image/') || file.size > 3 * 1024 * 1024) return;

        const reader = new FileReader();
        reader.onload = () => { this.groupChatImagePreview = reader.result as string; this.cdr.markForCheck(); };
        reader.readAsDataURL(file);

        this.groupChatUploading.set(true);
        this.imageUpload
            .uploadImage(file, 'groupchats', `trip-${this.tripId ?? 'new'}`)
            .pipe(finalize(() => { this.groupChatUploading.set(false); this.cdr.markForCheck(); }))
            .subscribe({
                next: (res) => {
                    this.gcImageUrl = res.publicUrl;
                    this.groupChatImagePreview = res.publicUrl;
                    this.cdr.markForCheck();
                },
            });
    }

    removeGcImage(): void {
        this.gcImageUrl = null;
        this.groupChatImagePreview = null;
        this.cdr.markForCheck();
    }

    createGroupChat(): void {
        if (!this.tripId || this.groupChatForm.invalid || this.groupChatLoading()) return;
        const v = this.groupChatForm.value;
        const code = `AWAYTRIP-${this.tripId}`;
        const dto: CreateGroupChatDto = {
            code,
            name: v.name!,
            description: v.description || null,
            eventId: null,
            isMain: false,
            image: this.gcImageUrl ?? null,
            isActive: true,
        };
        this.groupChatLoading.set(true);
        this.groupChatsApi.create(dto)
            .pipe(takeUntil(this.destroy$))
            .subscribe({
                next: (created: any) => {
                    const groupId: number = created?.id ?? created?.Id;
                    this.hasGroupChat.set(true);
                    const userIds = [...this.gcSelectedUserIds];
                    if (userIds.length === 0) {
                        this.groupChatLoading.set(false);
                        this.closeGroupChatModal();
                        this.snack.open('Η ομαδική συνομιλία δημιουργήθηκε!', 'Κλείσιμο', { duration: 4000 });
                        this.cdr.markForCheck();
                        return;
                    }
                    const joins$ = userIds.map(uid => this.groupChatsApi.joinGroup(groupId, uid));
                    forkJoin(joins$)
                        .pipe(
                            takeUntil(this.destroy$),
                            finalize(() => { this.groupChatLoading.set(false); this.cdr.markForCheck(); }),
                        )
                        .subscribe({
                            next: () => {
                                this.closeGroupChatModal();
                                this.snack.open('Η ομαδική συνομιλία δημιουργήθηκε με ' + userIds.length + ' μέλη!', 'Κλείσιμο', { duration: 4000 });
                            },
                            error: () => {
                                this.closeGroupChatModal();
                                this.snack.open('Η ομαδική δημιουργήθηκε αλλά ορισμένα μέλη δεν προστέθηκαν.', 'Κλείσιμο', { duration: 5000 });
                            },
                        });
                },
                error: () => {
                    this.groupChatLoading.set(false);
                    this.snack.open('Σφάλμα κατά τη δημιουργία ομαδικής συνομιλίας.', 'Κλείσιμο', { duration: 4000 });
                    this.cdr.markForCheck();
                },
            });
    }

    // ── Notification details modal ───────────────────────────────────────────
    openNotifDetails(notif: AwayTripNotificationDto): void {
        this.selectedNotif = notif;
        this.notifDetailsModalOpen = true;
        this.cdr.markForCheck();
    }

    closeNotifDetails(): void {
        this.notifDetailsModalOpen = false;
        this.selectedNotif = null;
        this.cdr.markForCheck();
    }

    // ── Send Notification ────────────────────────────────────────────────────
    openSendNotification(): void {
        const ref = this.dialog.open(SendNotificationDialogComponent, {
            width: '600px',
            disableClose: false,
            data: { interests: this.interests },
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
