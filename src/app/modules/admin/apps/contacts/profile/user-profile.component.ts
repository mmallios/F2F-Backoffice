import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, OnInit, ViewEncapsulation, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormBuilder, FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatTabsModule } from '@angular/material/tabs';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { UsersService, User, UserTicket, UserCard, RegistrationRequest, BanInfo, AuditLogDto, AuditLogListResult } from '@fuse/services/users/users.service';


type Card = { id: number; code: string; active: boolean; };
type Subscription = { id: number; event: string; status: string; };

export const DD_MM_YYYY_FORMAT = {
    parse: {
        dateInput: 'DD/MM/YYYY',
    },
    display: {
        dateInput: 'dd/MM/yyyy',
        monthYearLabel: 'MMM yyyy',
        dateA11yLabel: 'dd/MM/yyyy',
        monthYearA11yLabel: 'MMMM yyyy',
    },
};

@Component({
    selector: 'users-profile',
    standalone: true,
    templateUrl: './user-profile.component.html',
    encapsulation: ViewEncapsulation.None,
    changeDetection: ChangeDetectionStrategy.OnPush,
    providers: [
        { provide: MAT_DATE_FORMATS, useValue: DD_MM_YYYY_FORMAT }
    ],
    imports: [
        CommonModule,
        ReactiveFormsModule,
        MatButtonModule,
        MatIconModule,
        MatFormFieldModule,
        MatInputModule,
        MatSelectModule,
        MatTabsModule,
        MatDialogModule,
        MatProgressBarModule,
        MatTooltipModule,
    ],
})
export class UsersProfileComponent implements OnInit {
    private _route = inject(ActivatedRoute);
    private _router = inject(Router);
    private _fb = inject(FormBuilder);
    private _usersService = inject(UsersService);
    private _cdr = inject(ChangeDetectorRef);
    private _dialog = inject(MatDialog);
    private _staticDataService = inject(StaticDataService);

    staticData: StaticData[] = [];
    staticById = new Map<number | string, StaticData>();
    socialMediaItems: StaticData[] = [];
    socialById = new Map<number | string, StaticData>();


    user!: User;
    avatarPreview: string | null = null;

    // Rejection info modal
    rejectionModalOpen = false;
    rejectionInfo: RegistrationRequest | null = null;
    loadingRejectionInfo = false;

    // Code edit modal
    codeModalOpen = false;
    codeModalStep = 1; // 1 = input, 2 = confirm
    codeEditCtrl = new FormControl('', { nonNullable: true });
    codeAvailable: boolean | null = null;
    codeChecking = false;
    codeSaving = false;
    codeSaveResult: 'success' | 'error' | null = null;
    private _codeCheckSub: any = null;

    // Ban confirm modal
    readonly adminUserId: number | null = null;
    banConfirmModalOpen = false;
    banReasonCtrl = new FormControl('', { nonNullable: true });
    banningInProgress = false;

    // Ban info modal
    banInfoModalOpen = false;
    banInfo: BanInfo | null = null;
    loadingBanInfo = false;

    // Activity tab
    activityLogs: AuditLogDto[] = [];
    activityTotal = 0;
    activityPage = 1;
    activityLoaded = false;
    loadingActivity = false; activityDetailLog: AuditLogDto | null = null;
    activityDetailFields: { key: string; value: string }[] = [];
    // overview edit mode (μόνο το επάνω “card”)

    overviewEdit = false;
    viewFields: Array<{ label: string; control: string; icon: string }> = [
        { label: 'Email', control: 'email', icon: 'heroicons_outline:at-symbol' },
        { label: 'Κινητό', control: 'mobile', icon: 'heroicons_outline:phone' },
        { label: 'Ημερομηνία γέννησης', control: 'birthdate', icon: 'heroicons_outline:calendar-days' },
        { label: 'ΑΜΚΑ', control: 'amka', icon: 'heroicons_outline:identification' },
        { label: 'Συνδεδεμένο άτομο', control: 'linkedPerson', icon: 'heroicons_outline:user-group' },
        { label: 'Προφίλ social media', control: 'socialMediaAccount', icon: 'heroicons_outline:globe-alt' },
        { label: 'Χώρα', control: 'country', icon: 'heroicons_outline:map' },
        { label: 'Νομός', control: 'region', icon: 'heroicons_outline:map-pin' },
        { label: 'Πόλη', control: 'city', icon: 'heroicons_outline:building-office-2' },
        { label: 'Περιοχή', control: 'area', icon: 'heroicons_outline:squares-2x2' },
    ];


    userStatusOptions = [
        { value: 0, label: 'Σε αναμονή έγκρισης' },
        { value: 1, label: 'Μερικώς ενεργός' },
        { value: 2, label: 'Ενεργός' },
        { value: 3, label: 'Ανενεργός' },
        { value: 5, label: 'Απορρίφθηκε' },
        { value: 6, label: 'Διαγράφηκε' },
        { value: 7, label: 'Αποκλεισμένος' },
        { value: 8, label: 'Κλειδωμένος' },
        { value: 9, label: 'Αρχειοθετημένος' },
    ];

    // ✅ Tab 1: editable by default
    detailsForm = this._fb.group({
        code: ['', Validators.required],
        firstname: ['', Validators.required],
        lastname: ['', Validators.required],
        email: ['', [Validators.required, Validators.email]],
        mobile: [''],
        status: [0, Validators.required],
        birthdate: [null as Date | null],
        amka: [''],
        linkedPerson: [''],
        socialMediaAccount: [''],
        points: [0],
        country: [''],
        region: [''],
        city: [''],
        area: [''],
    });


    tickets: UserTicket[] = [];
    userCards: UserCard[] = [];

    trackByTicketId = (_: number, t: UserTicket) => t.id;
    trackByCardId = (_: number, c: UserCard) => c.id;

    cards: Card[] = [
        { id: 1, code: 'CARD-001', active: true },
        { id: 2, code: 'CARD-002', active: false },
    ];
    subscriptions: Subscription[] = [
        { id: 1, event: 'Euroleague Final-4', status: 'Ενεργή' },
        { id: 2, event: 'Superleague', status: 'Ληγμένη' },
    ];

    ngOnInit(): void {
        this.user = this._route.snapshot.data['user'];
        this.avatarPreview = this.user?.image ?? null;

        forkJoin({
            staticData: this._staticDataService.loadAll(), // ✅ loads cached list
            tickets: this._usersService.getUserTickets(this.user.id),
            cards: this._usersService.getUserCards(this.user.id),
        }).subscribe(({ staticData, tickets, cards }) => {
            // ✅ static data lookup
            this.buildStaticLookup(staticData);

            // ✅ patch form with resolved names
            this.detailsForm.patchValue({
                code: this.user.code,
                firstname: this.user.firstname,
                lastname: this.user.lastname,
                email: this.user.email,
                mobile: this.user.mobile ?? '',
                status: this.user.status,
                birthdate: this.user.birthdate ? new Date(this.user.birthdate) : null,
                amka: (this.user as any).amka || '',
                linkedPerson: this.linkedUserFullName(this.user) || '',

                socialMediaAccount: (this.user as any).socialMediaAccount || '',
                points: this.user.points ?? 0,

                // ✅ lookup by id -> name
                country: this.nameById((this.user as any).countryId),
                region: this.nameById((this.user as any).regionId),

                city: this.nameById((this.user as any).cityId ?? (this.user as any).city),
                area: (this.user as any).area || '',
            });

            this.tickets = tickets;
            this.userCards = cards;

            this._cdr.markForCheck();
        });
    }


    get initials(): string {
        const fn = (this.detailsForm.get('firstname')?.value || '').trim();
        const ln = (this.detailsForm.get('lastname')?.value || '').trim();
        const a = fn[0] || '';
        const b = ln[0] || '';
        return (a + b).toUpperCase() || '?';
    }

    openEditUserModal(): void {
        const ref = this._dialog.open(UserUpsertDialogComponent, {
            width: '900px',
            maxWidth: '95vw',
            panelClass: ['fuse-mat-dialog', 'rounded-2xl'],
            data: { mode: 'edit', user: this.user },
            autoFocus: false,
        });

        ref.afterClosed().subscribe((res: any) => {
            if (!res?.ok) return;

            // ✅ simplest: re-fetch fresh user from API (recommended)
            this._usersService.getUserById(this.user.id).subscribe((u: User) => {
                this.user = u;
                this.avatarPreview = u.image ?? null;

                // update form (view mode)
                this.detailsForm.patchValue({
                    code: u.code,
                    firstname: u.firstname,
                    lastname: u.lastname,
                    email: u.email,
                    mobile: u.mobile ?? '',
                    status: u.status,
                    birthdate: (u as any).birthdate || '',
                    amka: (u as any).amka || '',
                    linkedPerson: (u as any).linkedPerson || '',
                    socialMediaAccount: (this.user as any).socialMediaAccount || '',

                    points: u.points ?? 0,
                    country: this.nameById((u as any).countryId),
                    region: this.nameById((u as any).regionId),
                    city: this.nameById((u as any).cityId ?? (u as any).city),
                    area: (u as any).area || '',
                });

                this._cdr.markForCheck();
            });
        });
    }


    // ---- Overview edit (top card) ----
    enableOverviewEdit(): void {
        this.overviewEdit = true;
        this._cdr.markForCheck();
    }

    cancelOverviewEdit(): void {
        this.overviewEdit = false;
        // reset από user
        this.detailsForm.patchValue({
            firstname: this.user.firstname,
            lastname: this.user.lastname,
            email: this.user.email,
            mobile: this.user.mobile ?? '',
            status: this.user.status,
            birthdate: (this.user as any).birthdate || '',
            amka: (this.user as any).amka || '',
            linkedPerson: (this.user as any).linkedPerson || '',
            socialMediaAccount: (this.user as any).socialMediaAccount || '',
            points: this.user.points,
        });
        this._cdr.markForCheck();
    }

    saveUser(): void {
        if (this.detailsForm.invalid) return;

        const payload: any = {
            ...this.user,
            ...this.detailsForm.getRawValue(),
            image: this.avatarPreview ?? this.user.image,
        };

        this._usersService.updateUser(this.user.id, payload).subscribe((u) => {
            this.user = u;
            this.avatarPreview = u.image ?? null;
            this.overviewEdit = false;
            this._cdr.markForCheck();
        });
    }

    // ---- Code Edit Modal ----
    openCodeEdit(): void {
        this.codeEditCtrl.setValue('');
        this.codeAvailable = null;
        this.codeChecking = false;
        this.codeSaveResult = null;
        this.codeModalStep = 1;
        this.codeModalOpen = true;
        this._cdr.markForCheck();
    }

    cancelCodeEdit(): void {
        this.codeModalOpen = false;
        this.codeAvailable = null;
        this.codeSaveResult = null;
        if (this._codeCheckSub) { this._codeCheckSub.unsubscribe(); this._codeCheckSub = null; }
        this._cdr.markForCheck();
    }

    onCodeInput(): void {
        const val = this.codeEditCtrl.value.trim();
        this.codeAvailable = null;
        if (this._codeCheckSub) { this._codeCheckSub.unsubscribe(); this._codeCheckSub = null; }
        if (!val || val === (this.user.code ?? '')) { this._cdr.markForCheck(); return; }

        this.codeChecking = true;
        this._cdr.markForCheck();

        this._codeCheckSub = this._usersService.checkCode(val, this.user.id!).subscribe({
            next: (res) => {
                this.codeAvailable = res.available;
                this.codeChecking = false;
                this._cdr.markForCheck();
            },
            error: () => { this.codeChecking = false; this._cdr.markForCheck(); },
        });
    }

    saveCode(): void {
        const val = this.codeEditCtrl.value.trim();
        if (!val || !this.codeAvailable || this.codeSaving) return;
        this.codeSaving = true;
        this.codeSaveResult = null;
        this._cdr.markForCheck();

        this._usersService.updateUserCode(this.user.id!, val).subscribe({
            next: (res) => {
                this.user = { ...this.user, code: res.code };
                this.detailsForm.patchValue({ code: res.code });
                this.codeSaveResult = 'success';
                this.codeSaving = false;
                this._cdr.markForCheck();
                setTimeout(() => { this.cancelCodeEdit(); }, 1200);
            },
            error: () => {
                this.codeSaveResult = 'error';
                this.codeSaving = false;
                this._cdr.markForCheck();
            },
        });
    }

    // ---- Tabs Modals ----
    editTicket(t: UserTicket): void {
        const ref = this._dialog.open(EditSimpleDialogComponent, {
            width: '520px',
            data: { title: 'Επεξεργασία Εισιτηρίου', value: { ...t } }
        });

        ref.afterClosed().subscribe((res: UserTicket | null) => {
            if (!res) return;
            this.tickets = this.tickets.map(x => x.id === res.id ? res : x);
            this._cdr.markForCheck();
        });
    }

    editCard(c: Card): void {
        const ref = this._dialog.open(EditSimpleDialogComponent, {
            width: '520px',
            data: { title: 'Επεξεργασία Κάρτας', value: { ...c } }
        });

        ref.afterClosed().subscribe((res: Card | null) => {
            if (!res) return;
            this.cards = this.cards.map(x => x.id === res.id ? res : x);
            this._cdr.markForCheck();
        });
    }

    editSubscription(s: Subscription): void {
        const ref = this._dialog.open(EditSimpleDialogComponent, {
            width: '520px',
            data: { title: 'Επεξεργασία Συνδρομής', value: { ...s } }
        });

        ref.afterClosed().subscribe((res: Subscription | null) => {
            if (!res) return;
            this.subscriptions = this.subscriptions.map(x => x.id === res.id ? res : x);
            this._cdr.markForCheck();
        });
    }

    // avatar preview only (αν θες upload API μετά)
    onAvatarSelected(event: Event): void {
        if (!this.overviewEdit) return;

        const input = event.target as HTMLInputElement;
        const file = input.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = () => {
            this.avatarPreview = reader.result as string;
            this._cdr.markForCheck();
        };
        reader.readAsDataURL(file);

        input.value = '';
    }


    openEditTicket(ticket: UserTicket): void {
        const ref = this._dialog.open(EditTicketDialogComponent, {
            width: '560px',
            maxWidth: '95vw',
            data: { ticket },
            autoFocus: false,
        });

        ref.afterClosed().subscribe((updated: UserTicket | null) => {
            if (!updated) return;

            // ✅ update local list
            this.tickets = this.tickets.map(t => (t.id === updated.id ? updated : t));

            // ✅ εδώ μπορείς να καλέσεις API update αν θέλεις
            // this._ticketsService.updateTicket(updated.id, updated).subscribe(...)
        });
    }

    openDeleteTicket(ticket: UserTicket): void {
        const ref = this._dialog.open(ConfirmDeleteDialogComponent, {
            width: '480px',
            maxWidth: '95vw',
            data: {
                title: 'Διαγραφή εισιτηρίου',
                message: `Θέλεις σίγουρα να διαγράψεις το ${ticket.firstname} ${ticket.lastname};`,
                confirmText: 'Διαγραφή',
                cancelText: 'Ακύρωση',
            },
            autoFocus: false,
        });

        ref.afterClosed().subscribe((confirmed: boolean) => {
            if (!confirmed) return;

            // ✅ delete local list
            this.tickets = this.tickets.filter(t => t.id !== ticket.id);

            // ✅ εδώ μπορείς να καλέσεις API delete αν θέλεις
            // this._ticketsService.deleteTicket(ticket.id).subscribe(...)
        });
    }

    get fanCards() {
        return (this.userCards ?? []).filter(c => c.cartType === 1);
    }

    get memberCards() {
        return (this.userCards ?? []).filter(c => c.cartType === 2);
    }


    openEditCard(card: UserCard): void {
        const ref = this._dialog.open(EditUserCardDialogComponent, {
            width: '560px',
            maxWidth: '95vw',
            data: { card },
            autoFocus: false,
        });

        ref.afterClosed().subscribe((updated: UserCard | null) => {
            if (!updated) return;

            // ✅ update local list
            this.userCards = this.userCards.map(c => (c.id === updated.id ? updated : c));
            this._cdr.markForCheck();

            // ✅ call API update later if you want
            // this._usersService.updateUserCard(updated.id, updated).subscribe(...)
        });
    }

    openDeleteCard(card: UserCard): void {
        const ref = this._dialog.open(ConfirmDeleteUserCardDialogComponent, {
            width: '480px',
            maxWidth: '95vw',
            data: {
                title: 'Διαγραφή κάρτας',
                message: `Θέλεις σίγουρα να διαγράψεις την κάρτα "${card.cardNumber}";`,
                confirmText: 'Διαγραφή',
                cancelText: 'Ακύρωση',
            },
            autoFocus: false,
        });

        ref.afterClosed().subscribe((confirmed: boolean) => {
            if (!confirmed) return;

            // ✅ delete local list
            this.userCards = this.userCards.filter(c => c.id !== card.id);
            this._cdr.markForCheck();

            // ✅ call API delete later if you want
            // this._usersService.deleteUserCard(card.id).subscribe(...)
        });
    }

    getStatusLabel(value: number | null | undefined): string {
        const opt = this.userStatusOptions.find(x => x.value === value);
        return opt?.label ?? '-';
    }

    getStatusChipClass(status: number | null | undefined): string {
        switch (status) {
            case 2:
                return 'bg-green-100 text-green-800 dark:bg-green-500/10 dark:text-green-300';
            case 0:
                return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-500/10 dark:text-yellow-300';
            case 3:
                return 'bg-gray-100 text-gray-800 dark:bg-white/5 dark:text-gray-200';
            case 7:
            case 6:
            case 5:
                return 'bg-red-100 text-red-800 dark:bg-red-500/10 dark:text-red-300';
            default:
                return 'bg-indigo-100 text-indigo-800 dark:bg-indigo-500/10 dark:text-indigo-300';
        }
    }

    getStatusDotClass(status: number | null | undefined): string {
        switch (status) {
            case 2: return 'bg-green-500';
            case 0: return 'bg-yellow-500';
            case 3: return 'bg-gray-400';
            case 7:
            case 6:
            case 5: return 'bg-red-500';
            default: return 'bg-indigo-500';
        }
    }

    openRejectionModal(): void {
        if (!this.user?.id) return;
        this.loadingRejectionInfo = true;
        this.rejectionModalOpen = true;
        this.rejectionInfo = null;
        this._cdr.markForCheck();
        this._usersService.getRegistrationRequestById(this.user.id).subscribe({
            next: (info) => {
                this.rejectionInfo = info;
                this.loadingRejectionInfo = false;
                this._cdr.markForCheck();
            },
            error: () => {
                this.loadingRejectionInfo = false;
                this._cdr.markForCheck();
            },
        });
    }

    closeRejectionModal(): void {
        this.rejectionModalOpen = false;
        this.rejectionInfo = null;
        this._cdr.markForCheck();
    }

    goToRegistrationRequest(): void {
        this._router.navigate(['/apps/registration-requests'], {
            state: { openRequestId: this.user?.id },
        });
    }

    // ── Ban ──────────────────────────────────────────────────────

    openBanConfirmModal(): void {
        this.banConfirmModalOpen = true;
        this.banReasonCtrl.reset('');
        this._cdr.markForCheck();
    }

    closeBanConfirmModal(): void {
        this.banConfirmModalOpen = false;
        this._cdr.markForCheck();
    }

    executeBan(): void {
        if (this.banningInProgress) return;
        this.banningInProgress = true;
        this._cdr.markForCheck();
        this._usersService.banUser(this.user.id!, this.adminUserId, this.banReasonCtrl.value || null).subscribe({
            next: () => {
                this.banningInProgress = false;
                this.banConfirmModalOpen = false;
                this.user = { ...this.user, status: 7 };
                this.detailsForm.patchValue({ status: 7 });
                this._cdr.markForCheck();
            },
            error: () => {
                this.banningInProgress = false;
                this._cdr.markForCheck();
            },
        });
    }

    openBanInfoModal(): void {
        if (!this.user?.id) return;
        this.loadingBanInfo = true;
        this.banInfoModalOpen = true;
        this.banInfo = null;
        this._cdr.markForCheck();
        this._usersService.getBanInfo(this.user.id).subscribe({
            next: (info) => {
                this.banInfo = info;
                this.loadingBanInfo = false;
                this._cdr.markForCheck();
            },
            error: () => {
                this.loadingBanInfo = false;
                this._cdr.markForCheck();
            },
        });
    }

    closeBanInfoModal(): void {
        this.banInfoModalOpen = false;
        this.banInfo = null;
        this._cdr.markForCheck();
    }

    // ── Activity Tab ─────────────────────────────────────────────

    onTabChange(index: number): void {
        if (index === 3 && !this.activityLoaded) {
            this.loadActivity();
        }
    }

    loadActivity(page: number = 1): void {
        if (!this.user?.id) return;
        this.loadingActivity = true;
        this.activityPage = page;
        this._cdr.markForCheck();
        this._usersService.getUserAuditLogs(this.user.id, page).subscribe({
            next: (result) => {
                this.activityLogs = result.items;
                this.activityTotal = result.total;
                this.activityLoaded = true;
                this.loadingActivity = false;
                this._cdr.markForCheck();
            },
            error: () => {
                this.loadingActivity = false;
                this._cdr.markForCheck();
            },
        });
    }

    auditLogLabel(type: number): string {
        const map: Record<number, string> = {
            1: 'Αίτημα εγγραφής', 2: 'Έγκριση εγγραφής',
            3: 'Απόρριψη εγγραφής', 4: 'Ενημέρωση στοιχείων',
            5: 'Ενημέρωση ρυθμίσεων', 6: 'Νέα παραγγελία',
            7: 'Αίτημα υποστήριξης', 8: 'Αίτημα εισιτηρίου αγώνα',
            9: 'Παραχώρηση εισιτηρίου', 10: 'Δημιουργία group chat',
            11: 'Δωρεά', 12: 'Αίτημα κάρτας φιλάθλου',
            13: 'Συμμετοχή σε διαγωνισμό', 14: 'Νίκη σε διαγωνισμό',
            15: 'Νέα κάρτα διαρκείας', 16: 'Επεξεργασία κάρτας διαρκείας',
            17: 'Διαγραφή κάρτας', 18: 'Αποκλεισμός χρήστη',
        };
        return map[type] ?? `Ενέργεια #${type}`;
    }

    auditLogIcon(type: number): string {
        const map: Record<number, string> = {
            1: 'how_to_reg', 2: 'check_circle', 3: 'cancel',
            4: 'edit', 5: 'settings', 6: 'shopping_cart',
            7: 'support_agent', 8: 'local_activity', 9: 'confirmation_number',
            10: 'group', 11: 'favorite', 12: 'badge',
            13: 'emoji_events', 14: 'star', 15: 'credit_card',
            16: 'edit_note', 17: 'remove_circle', 18: 'block',
        };
        return map[type] ?? 'info';
    }

    openActivityDetailModal(log: AuditLogDto): void {
        this.activityDetailLog = log;
        this.activityDetailFields = this.parseTableData(log.tableData);
        this._cdr.markForCheck();
    }

    closeActivityDetailModal(): void {
        this.activityDetailLog = null;
        this.activityDetailFields = [];
        this._cdr.markForCheck();
    }

    parseTableData(raw: string | null | undefined): { key: string; value: string }[] {
        if (!raw) return [];
        try {
            const obj = JSON.parse(raw);
            if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) return [];
            return Object.entries(obj).map(([k, v]) => ({
                key: k,
                value: v === null || v === undefined ? '—' : String(v),
            }));
        } catch {
            return [{ key: 'data', value: raw }];
        }
    }

    private buildStaticLookup(items: StaticData[]): void {
        this.staticData = items ?? [];
        this.staticById = new Map((items ?? []).map(x => [x.id as any, x]));

        this.socialMediaItems = (items ?? [])
            .filter(x => (x.domain || '').toLowerCase() === 'socialmedia')
            .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

        this.socialById = new Map(this.socialMediaItems.map(x => [x.id as any, x]));
    }

    getSocialIconUrl(): string {
        const socialMediaId = (this.user as any)?.socialMediaId;
        if (socialMediaId == null) return '';

        const item = this.socialById.get(socialMediaId);
        if (!item) return '';

        // prefer image, fallback to extraData
        return (item.image || item.extraData || '').trim();
    }

    getSocialMediaName(): string {
        const socialMediaId = (this.user as any)?.socialMediaId;
        if (socialMediaId == null) return '';

        return this.socialById.get(socialMediaId)?.name ?? '';
    }


    private nameById(id: any): string {
        if (id === null || id === undefined || id === '') return '';
        return this.staticById.get(id)?.name ?? '';
    }


    private linkedUserFullName(u: any): string {
        const lu = u?.linkedUser;
        if (!lu) return '';
        const first = (lu.firstname || '').trim();
        const last = (lu.lastname || '').trim();
        return `${first} ${last}`.trim();
    }




}

// ✅ Reusable simple edit dialog (για demo)
import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { ConfirmDeleteDialogComponent } from '../dialogs/confirm-delete-dialog.component';
import { EditTicketDialogComponent } from '../dialogs/edit-ticket-dialog.component';
import { forkJoin } from 'rxjs';
import { EditUserCardDialogComponent } from '../dialogs/cards/edit-card-dialog.component';
import { ConfirmDeleteUserCardDialogComponent } from '../dialogs/cards/delete-card-dialog,component';
import { UserUpsertDialogComponent } from '../dialog/user-upsert-dialog.component';
import { StaticData, StaticDataService } from '@fuse/services/staticdata/static-data.service';
import { MAT_DATE_FORMATS } from '@angular/material/core';

@Component({
    selector: 'edit-simple-dialog',
    standalone: true,
    imports: [CommonModule, ReactiveFormsModule, MatButtonModule, MatFormFieldModule, MatInputModule],
    template: `
    <div class="p-6">
      <div class="text-xl font-bold mb-4">{{ data.title }}</div>

      <form [formGroup]="form" class="space-y-4">
        <mat-form-field class="w-full" subscriptSizing="dynamic">
          <mat-label>Περιγραφή / Τίτλος</mat-label>
          <input matInput formControlName="title" />
        </mat-form-field>

        <mat-form-field class="w-full" subscriptSizing="dynamic">
          <mat-label>Κατάσταση</mat-label>
          <input matInput formControlName="status" />
        </mat-form-field>
      </form>

      <div class="flex justify-end gap-2 mt-6">
        <button mat-button type="button" (click)="ref.close(null)">Άκυρο</button>
        <button mat-flat-button color="primary" type="button" (click)="save()">Αποθήκευση</button>
      </div>
    </div>
  `,
})
export class EditSimpleDialogComponent {
    form = inject(FormBuilder).group({
        id: [0],
        title: [''],
        status: [''],
    });

    constructor(
        public ref: MatDialogRef<EditSimpleDialogComponent>,
        @Inject(MAT_DIALOG_DATA) public data: any
    ) {
        const v = data.value || {};
        this.form.patchValue({
            id: v.id || 0,
            title: v.title || v.code || v.event || '',
            status: v.status ?? (v.active ? 'Ενεργή' : 'Ανενεργή'),
        });
    }

    save(): void {
        const raw = this.form.getRawValue();
        // επιστρέφουμε object “σαν” το αρχικό (simple demo)
        this.ref.close({ ...this.data.value, title: raw.title, status: raw.status });
    }



}


