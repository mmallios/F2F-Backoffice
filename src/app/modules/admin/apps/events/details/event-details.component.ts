

import { CommonModule, DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { FormBuilder, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { Subject, combineLatest, forkJoin, startWith, takeUntil } from 'rxjs';

import { MatButtonModule } from '@angular/material/button';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatInputModule } from '@angular/material/input';
import { MatTabsModule } from '@angular/material/tabs';
import { MatProgressBarModule } from '@angular/material/progress-bar';

import {
    BODirectAssignRequest,
    BOTicketRequestDto,
    Competition,
    CreateEventTicketDto,
    EventItem,
    EventStats,
    EventTicketDto,
    EventsService,
    Team,
    UpdateEventTicketDto,
    TvChannel
} from '@fuse/services/events/events.service';
import { AuthService } from 'app/core/auth/auth.service';
import { EventFanCardUsage, FanCardsAdminService } from '@fuse/services/fan-cards/fan-cards-admin.service';
import { UsersService, User } from '@fuse/services/users/users.service';
import { BOHubService } from 'app/core/signalr/bo-hub.service';

@Component({
    selector: 'event-details',
    standalone: true,
    imports: [
        CommonModule,
        RouterModule,
        ReactiveFormsModule,
        MatButtonModule,
        MatDatepickerModule,
        MatIconModule,
        MatMenuModule,
        MatFormFieldModule,
        MatSelectModule,
        MatInputModule,
        MatTabsModule,
        MatProgressBarModule,
    ],
    templateUrl: './event-details.component.html',
    styleUrl: './event-details.component.css',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EventDetailsComponent implements OnInit, OnDestroy {
    event: EventItem | null = null;

    teams: Team[] = [];
    competitions: Competition[] = [];
    tickets: EventTicketDto[] = [];
    tvChannels: TvChannel[] = [];

    overviewEdit = false;
    showDeleteConfirm = false;
    headerForm!: FormGroup;
    statsStrip: any;
    eventStats: EventStats | null = null;

    availableGates: string[] = [];
    filteredTickets: EventTicketDto[] = [];
    loadingTickets = false;

    ticketSearchCtrl = new FormControl<string>('', { nonNullable: true });
    ticketGateCtrl = new FormControl<string | null>(null);
    ticketTypeCtrl = new FormControl<number | null>(null);
    ticketStatusCtrl = new FormControl<number | null>(null);

    // ── delete confirm
    deleteTargetId: number | null = null;
    deletePending = false;

    // ── edit modal
    editTarget: EventTicketDto | null = null;
    editForm!: FormGroup;
    editSaving = false;

    // ── add modal
    showAddModal = false;
    addForm!: FormGroup;
    addSaving = false;
    addPriceMode: 'free' | 'paid' = 'free';

    // ── direct assign modal
    showAssignModal = false;
    assignTarget: EventTicketDto | null = null;
    assignSelectedUserId: number | null = null;
    assignUserSearch = new FormControl<string>('', { nonNullable: true });
    filteredAssignUsers: User[] = [];
    assignSaving = false;
    boAssigns: BOTicketRequestDto[] = [];
    assignRequesterForm!: FormGroup;

    // ── assign info modal
    showAssignInfoModal = false;
    assignInfoTarget: BOTicketRequestDto | null = null;
    activeUsers: User[] = [];
    filteredUsers: User[] = [];
    userSearchCtrl = new FormControl<string>('', { nonNullable: true });

    createMode = false;

    fanCardUsages: EventFanCardUsage[] = [];
    loadingFanCardUsages = false;
    fanCardUsagesLoaded = false;

    trackByStatKey = (_: number, s: any) => s.key;
    trackByTicketId = (_: number, t: EventTicketDto) => t.id;

    private _unsubscribeAll = new Subject<void>();

    constructor(
        private _route: ActivatedRoute,
        private _router: Router,
        private _eventsService: EventsService,
        private _fanCardsService: FanCardsAdminService,
        private _usersService: UsersService,
        private _authService: AuthService,
        private _fb: FormBuilder,
        private _cdr: ChangeDetectorRef,
        private _boHub: BOHubService
    ) { }

    // ==============================
    // Lifecycle
    // ==============================
    ngOnInit(): void {
        this.buildHeaderForm();
        this._buildEditForm();
        this._buildAddForm();
        this.assignRequesterForm = this._fb.group({
            firstname: ['', Validators.required],
            lastname:  ['', Validators.required],
            email:     ['', [Validators.required, Validators.email]],
            amka:      ['', Validators.required],
        });

        // Real-time ticket updates from fan2fan
        this._boHub.boTicketUpdate$.pipe(takeUntil(this._unsubscribeAll)).subscribe(update => {
            if (update.eventId !== this.event?.id) return;

            if (update.action === 'ticket-added' && update.ticket) {
                this.tickets = [update.ticket, ...this.tickets];
                this.filteredTickets = [update.ticket, ...this.filteredTickets];
            } else if (update.action === 'status-changed' || update.action === 'request-created') {
                this.tickets = this.tickets.map(t =>
                    t.id === update.ticketId ? { ...t, status: update.newStatus ?? t.status } : t
                );
                this.filteredTickets = this.filteredTickets.map(t =>
                    t.id === update.ticketId ? { ...t, status: update.newStatus ?? t.status } : t
                );
            }
            this._cdr.markForCheck();
        });

        forkJoin({
            teams: this._eventsService.getTeams(),
            competitions: this._eventsService.getCompetitions(),
            tvChannels: this._eventsService.getTVChannels(),
            users: this._usersService.loadUsers(),
        }).pipe(takeUntil(this._unsubscribeAll))
            .subscribe(({ teams, competitions, tvChannels, users }) => {
                this.teams = teams ?? [];
                this.competitions = competitions ?? [];
                this.tvChannels = tvChannels ?? [];
                this.activeUsers = (users ?? []).filter(u => u.isActive);
                this.filteredUsers = this.activeUsers;
                this._cdr.markForCheck();
            });

        this.userSearchCtrl.valueChanges
            .pipe(takeUntil(this._unsubscribeAll))
            .subscribe(q => {
                const lower = (q ?? '').toLowerCase().trim();
                this.filteredUsers = lower
                    ? this.activeUsers.filter(u =>
                        `${u.firstname} ${u.lastname} ${u.email}`.toLowerCase().includes(lower))
                    : this.activeUsers;
                this._cdr.markForCheck();
            });

        this._route.data.pipe(takeUntil(this._unsubscribeAll)).subscribe((d: any) => {
            const mode = d?.mode;

            if (mode === 'create') {
                this.createMode = true;
                this.overviewEdit = true;
                this.event = null;
                this.tickets = [];
                this.filteredTickets = [];
                this.availableGates = [];
                this.statsStrip = [];

                this.headerForm.reset({
                    competitionId: null, matchday: '',
                    eventDateOnly: null, eventTimeOnly: '',
                    homeTeamId: null, awayTeamId: null,
                    tvChannel: null, referenceId: '',
                    openTickets: true, eventDate: ''
                }, { emitEvent: false });

                this.headerForm.enable({ emitEvent: false });
                this._cdr.markForCheck();
                return;
            }

            this.createMode = false;
            const ev = d?.['event'] as EventItem | null;
            if (!ev) { this._router.navigateByUrl('/apps/events'); return; }

            this.event = ev;
            this.overviewEdit = false;
            this.patchHeaderFormFromEvent(ev);
            this.headerForm.disable({ emitEvent: false });

            this._eventsService.getEventStats(ev.id).subscribe({
                next: (stats) => { this.eventStats = stats; this._cdr.markForCheck(); },
            });

            this._loadTickets(ev.id);
            this._cdr.markForCheck();
        });
    }

    ngOnDestroy(): void {
        this._unsubscribeAll.next();
        this._unsubscribeAll.complete();
    }

    // ── tickets loading ──────────────────────────────────────────
    private _loadTickets(eventId: number): void {
        this.loadingTickets = true;
        this._cdr.markForCheck();

        this._eventsService.getEventTickets(eventId)
            .pipe(takeUntil(this._unsubscribeAll))
            .subscribe({
                next: (list) => {
                    this.tickets = list ?? [];
                    this.availableGates = [...new Set(
                        this.tickets.map(t => t.gate ?? '').filter(g => !!g)
                    )].sort();
                    this._wireFilters();
                    this.loadingTickets = false;
                    this._cdr.markForCheck();
                },
                error: () => { this.loadingTickets = false; this._cdr.markForCheck(); },
            });

        this._eventsService.getAllTicketRequestsForEvent(eventId)
            .pipe(takeUntil(this._unsubscribeAll))
            .subscribe({ next: (list) => { this.boAssigns = list ?? []; this._cdr.markForCheck(); } });
    }

    private _wireFilters(): void {
        combineLatest([
            this.ticketSearchCtrl.valueChanges.pipe(startWith('')),
            this.ticketGateCtrl.valueChanges.pipe(startWith(null)),
            this.ticketTypeCtrl.valueChanges.pipe(startWith(null)),
            this.ticketStatusCtrl.valueChanges.pipe(startWith(null)),
        ]).pipe(takeUntil(this._unsubscribeAll))
            .subscribe(([search, gate, type, status]) => {
                const s = (search ?? '').toLowerCase();
                this.filteredTickets = this.tickets.filter(t => {
                    const name = `${t.ownerFirstname ?? ''} ${t.ownerLastname ?? ''}`.toLowerCase();
                    if (s && !name.includes(s)) return false;
                    if (gate != null && t.gate !== gate) return false;
                    if (type != null && t.type !== type) return false;
                    if (status != null && t.status !== status) return false;
                    return true;
                });
                this._cdr.markForCheck();
            });
    }

    // ── edit modal ───────────────────────────────────────────────
    private _buildEditForm(): void {
        this.editForm = this._fb.group({
            gate: ['', Validators.required],
            section: [''],
            row: [''],
            seat: [''],
            price: [0],
            status: [0, Validators.required],
            buyerData: [''],
        });
    }

    openEditTicket(t: EventTicketDto): void {
        this.editTarget = t;
        this.editForm.reset({
            gate: t.gate ?? '',
            section: t.section ?? '',
            row: t.row ?? '',
            seat: t.seat ?? '',
            price: t.price ?? 0,
            status: t.status ?? 0,
            buyerData: t.buyerData ?? '',
        });
        this._cdr.markForCheck();
    }

    closeEditModal(): void { this.editTarget = null; this._cdr.markForCheck(); }

    saveEditTicket(): void {
        if (!this.editTarget || !this.event || this.editForm.invalid) return;
        this.editSaving = true;
        this._cdr.markForCheck();

        const raw = this.editForm.getRawValue();
        const dto: UpdateEventTicketDto = {
            gate: raw.gate || undefined,
            section: raw.section || undefined,
            row: raw.row || undefined,
            seat: raw.seat || undefined,
            price: raw.price ?? undefined,
            status: raw.status ?? undefined,
            buyerData: raw.buyerData || undefined,
        };

        this._eventsService.updateEventTicket(this.event.id, this.editTarget.id, dto)
            .subscribe({
                next: (updated) => {
                    const idx = this.tickets.findIndex(t => t.id === updated.id);
                    if (idx >= 0) this.tickets[idx] = updated;
                    this.filteredTickets = [...this.filteredTickets.map(t => t.id === updated.id ? updated : t)];
                    this.editSaving = false;
                    this.editTarget = null;
                    this._cdr.markForCheck();
                },
                error: () => { this.editSaving = false; this._cdr.markForCheck(); },
            });
    }

    // ── add modal ────────────────────────────────────────────────
    private _buildAddForm(): void {
        this.addForm = this._fb.group({
            gate: ['', Validators.required],
            section: [''],
            row: [''],
            seat: [''],
            price: [0],
            status: [0, Validators.required],
            type: [0, Validators.required],
            userId: [null as number | null],
        });
    }

    openAddModal(): void {
        this.addPriceMode = 'free';
        this.addForm.reset({ gate: '', section: '', row: '', seat: '', price: 0, status: 0, type: 0, userId: null });
        this.userSearchCtrl.setValue('', { emitEvent: false });
        this.filteredUsers = this.activeUsers;
        this.showAddModal = true;
        this._cdr.markForCheck();
    }

    closeAddModal(): void { this.showAddModal = false; this._cdr.markForCheck(); }

    // ── direct assign modal ─────────────────────────────────────

    openAssignModal(ticket: EventTicketDto): void {
        this.assignTarget = ticket;
        this.assignSelectedUserId = null;
        this.assignUserSearch.setValue('', { emitEvent: false });
        this.filteredAssignUsers = this.activeUsers;
        this.showAssignModal = true;
        this._cdr.markForCheck();

        this.assignUserSearch.valueChanges
            .pipe(takeUntil(this._unsubscribeAll))
            .subscribe(q => {
                const lower = (q ?? '').toLowerCase().trim();
                this.filteredAssignUsers = lower
                    ? this.activeUsers.filter(u =>
                        `${u.firstname} ${u.lastname} ${u.email}`.toLowerCase().includes(lower))
                    : this.activeUsers;
                this._cdr.markForCheck();
            });
    }

    closeAssignModal(): void {
        this.showAssignModal = false;
        this.assignTarget = null;
        this.assignSelectedUserId = null;
        this.assignRequesterForm.reset();
        this._cdr.markForCheck();
    }

    submitDirectAssign(): void {
        if (!this.assignTarget || !this.assignSelectedUserId || this.assignSaving) return;
        if (this.assignRequesterForm.invalid) {
            this.assignRequesterForm.markAllAsTouched();
            this._cdr.markForCheck();
            return;
        }
        const admin = this._authService.currentUser;
        const rf = this.assignRequesterForm.getRawValue();
        this.assignSaving = true;
        this._cdr.markForCheck();

        const dto: BODirectAssignRequest = {
            eventTicketId: this.assignTarget.id,
            requestedByUserId: this.assignSelectedUserId,
            adminBoUserId: admin?.boUserId ?? admin?.id ?? 0,
            adminFullName: `${admin?.firstname ?? ''} ${admin?.lastname ?? ''}`.trim(),
            adminImage: admin?.image ?? undefined,
            requesterFirstname: rf.firstname,
            requesterLastname:  rf.lastname,
            requesterEmail:     rf.email,
            requesterAmka:      rf.amka,
        };

        this._eventsService.directAssignTicket(dto).subscribe({
            next: (result) => {
                // Update ticket status in local list
                const idx = this.tickets.findIndex(t => t.id === this.assignTarget!.id);
                if (idx >= 0) this.tickets[idx] = { ...this.tickets[idx], status: 1 };
                this.filteredTickets = this.filteredTickets.map(t =>
                    t.id === this.assignTarget!.id ? { ...t, status: 1 } : t
                );
                this.boAssigns = [...this.boAssigns, result];
                this.assignSaving = false;
                this.closeAssignModal();
            },
            error: () => { this.assignSaving = false; this._cdr.markForCheck(); },
        });
    }

    getBoAssignForTicket(ticketId: number): BOTicketRequestDto | undefined {
        return this.boAssigns.find(a => a.eventTicketId === ticketId);
    }

    openAssignInfoModal(ticketId: number): void {
        this.assignInfoTarget = this.getBoAssignForTicket(ticketId) ?? null;
        if (this.assignInfoTarget) {
            this.showAssignInfoModal = true;
            this._cdr.markForCheck();
        }
    }

    closeAssignInfoModal(): void {
        this.showAssignInfoModal = false;
        this.assignInfoTarget = null;
        this._cdr.markForCheck();
    }

    selectAssignUser(id: number): void {
        this.assignSelectedUserId = id;
        const u = this.activeUsers.find(x => x.id === id);
        if (u) {
            this.assignRequesterForm.patchValue({
                firstname: u.firstname ?? '',
                lastname:  u.lastname ?? '',
                email:     u.email ?? '',
                amka:      u.amka ?? '',
            });
        }
        this._cdr.markForCheck();
    }

    onAddPriceModeChange(mode: 'free' | 'paid'): void {
        this.addPriceMode = mode;
        if (mode === 'free') {
            this.addForm.get('price')!.setValue(0);
        } else {
            this.addForm.get('price')!.setValue(null);
        }
    }

    onPriceKeydown(event: KeyboardEvent): void {
        const controlKeys = ['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'Tab', 'Home', 'End'];
        if (controlKeys.includes(event.key)) return;
        if (!/^\d$/.test(event.key)) event.preventDefault();
    }

    saveAddTicket(): void {
        if (!this.event || this.addForm.invalid) return;
        this.addSaving = true;
        this._cdr.markForCheck();

        const raw = this.addForm.getRawValue();
        const dto: CreateEventTicketDto = {
            ticketId: 0,
            gate: raw.gate,
            section: raw.section || undefined,
            row: raw.row || undefined,
            seat: raw.seat || undefined,
            price: raw.price ?? 0,
            status: raw.status ?? 0,
            type: raw.type ?? 0,
            userId: raw.userId ?? undefined,
        };

        this._eventsService.addTicketToEvent(this.event.id, dto)
            .subscribe({
                next: (created) => {
                    this.tickets = [created, ...this.tickets];
                    this.filteredTickets = [created, ...this.filteredTickets];
                    this.addSaving = false;
                    this.showAddModal = false;
                    this._cdr.markForCheck();
                },
                error: () => { this.addSaving = false; this._cdr.markForCheck(); },
            });
    }

    // ── delete ───────────────────────────────────────────────────
    confirmDelete(id: number): void { this.deleteTargetId = id; this._cdr.markForCheck(); }
    cancelDelete(): void { this.deleteTargetId = null; this._cdr.markForCheck(); }

    executeDelete(): void {
        if (this.deleteTargetId == null || !this.event) return;
        this.deletePending = true;
        this._cdr.markForCheck();

        this._eventsService.deleteEventTicket(this.event.id, this.deleteTargetId)
            .subscribe({
                next: () => {
                    this.tickets = this.tickets.filter(t => t.id !== this.deleteTargetId);
                    this.filteredTickets = this.filteredTickets.filter(t => t.id !== this.deleteTargetId);
                    this.deleteTargetId = null;
                    this.deletePending = false;
                    this._cdr.markForCheck();
                },
                error: () => { this.deletePending = false; this._cdr.markForCheck(); },
            });
    }

    // ── labels ───────────────────────────────────────────────────
    ticketTypeLabel(type: number): string {
        return type === 1 ? 'ΔΙΑΡΚΕΙΑΣ' : 'ΑΓΩΝΑ';
    }

    ticketStatusLabel(status: number): string {
        switch (status) {
            case 0: return 'ΔΙΑΘΕΣΙΜΟ';
            case 1: return 'ΠΡΟΣ ΠΑΡΑΧΩΡΗΣΗ';
            case 2: return 'ΜΕΤΑΒΙΒΑΣΘΗΚΕ';
            case 3: return 'ΑΠΟΡΡΙΦΘΗΚΕ';
            default: return '—';
        }
    }

    ticketStatusColor(status: number): string {
        switch (status) {
            case 0: return 'text-green-700 bg-green-100';
            case 1: return 'text-amber-700 bg-amber-100';
            case 2: return 'text-blue-700 bg-blue-100';
            case 3: return 'text-red-700 bg-red-100';
            default: return 'text-gray-500 bg-gray-100';
        }
    }

    formatDate(iso?: string): string {
        if (!iso) return '—';
        const d = new Date(iso);
        if (isNaN(d.getTime())) return '—';
        return d.toLocaleDateString('el-GR', { day: '2-digit', month: '2-digit', year: 'numeric' })
            + ' ' + d.toLocaleTimeString('el-GR', { hour: '2-digit', minute: '2-digit' });
    }

    ownerInitials(t: EventTicketDto): string {
        const f = (t.ownerFirstname ?? '').trim();
        const l = (t.ownerLastname ?? '').trim();
        return ((f[0] ?? '') + (l[0] ?? '')).toUpperCase() || '?';
    }

    // ── fan card usages ──────────────────────────────────────────
    loadFanCardUsages(): void {
        if (!this.event?.id || this.fanCardUsagesLoaded) return;
        this.loadingFanCardUsages = true;
        this._cdr.markForCheck();
        this._fanCardsService.getEventUsages(this.event.id).subscribe({
            next: (usages) => {
                this.fanCardUsages = usages;
                this.fanCardUsagesLoaded = true;
                this.loadingFanCardUsages = false;
                this._cdr.markForCheck();
            },
            error: () => { this.loadingFanCardUsages = false; this._cdr.markForCheck(); },
        });
    }

    // ==============================
    // Form
    // ==============================
    private buildHeaderForm(): void {
        this.headerForm = this._fb.group({
            competitionId: [null, Validators.required],
            matchday: [''],
            eventDateOnly: [null as Date | null, Validators.required],
            eventTimeOnly: ['', Validators.pattern(/^([01]\d|2[0-3]):[0-5]\d$/)],
            homeTeamId: [null, Validators.required],
            awayTeamId: [null, Validators.required],
            eventDate: [''],
            tvChannel: [null],
            referenceId: [''],
            openTickets: [true],
        });
        this.headerForm.disable({ emitEvent: false });
    }

    private patchHeaderFormFromEvent(ev: EventItem): void {
        const iso = ev.eventDate || '';
        const { dateOnly, timeOnly } = this.splitIsoToDateTime(iso);
        this.headerForm.reset({
            competitionId: ev.competitionId ?? null,
            matchday: ev.matchday ?? '',
            homeTeamId: ev.homeTeamId ?? null,
            awayTeamId: ev.awayTeamId ?? null,
            eventDate: iso,
            eventDateOnly: dateOnly,
            eventTimeOnly: timeOnly,
            tvChannel: ev.tvChannel,
            openTickets: ev.isTicketingOpen,
            referenceId: ev.referenceMatchId
        }, { emitEvent: false });
    }

    // ── header edit actions ──────────────────────────────────────
    enableHeaderEdit(): void {
        this.overviewEdit = true;
        this.headerForm.enable({ emitEvent: false });
        const dateOnly = this.headerForm.get('eventDateOnly')?.value;
        const timeOnly = this.headerForm.get('eventTimeOnly')?.value;
        if ((!dateOnly || !timeOnly) && this.headerForm.get('eventDate')?.value) {
            const split = this.splitIsoToDateTime(this.headerForm.get('eventDate')?.value);
            this.headerForm.patchValue({ eventDateOnly: split.dateOnly, eventTimeOnly: split.timeOnly }, { emitEvent: false });
        }
        this._cdr.markForCheck();
    }

    cancelHeaderEdit(): void {
        if (!this.event) return;
        this.overviewEdit = false;
        this.patchHeaderFormFromEvent(this.event);
        this.headerForm.disable({ emitEvent: false });
        this._cdr.markForCheck();
    }

    saveHeader(): void {
        if (this.headerForm.invalid) { this.headerForm.markAllAsTouched(); this._cdr.markForCheck(); return; }
        const raw = this.headerForm.getRawValue();
        const combined = this.combineDateAndTime(raw.eventDateOnly, raw.eventTimeOnly || '00:00');
        const payload: Partial<EventItem> = {
            code: 'BO', name: 'BOO',
            competitionId: raw.competitionId,
            matchday: raw.matchday || '',
            homeTeamId: raw.homeTeamId,
            awayTeamId: raw.awayTeamId,
            eventDate: combined,
            tvChannel: raw.tvChannel,
            referenceMatchId: raw.referenceId,
            isTicketingOpen: !!raw.openTickets,
        };

        if (this.createMode) {
            this._eventsService.createEvent(payload).subscribe((created: EventItem) => {
                this._router.navigate(['/apps/events', created.id]);
            });
            return;
        }

        if (!this.event) return;
        this._eventsService.updateEvent(this.event.id, { ...payload, id: this.event.id })
            .subscribe((updated: EventItem) => {
                this.event = updated;
                this.overviewEdit = false;
                this.patchHeaderFormFromEvent(updated);
                this.headerForm.disable({ emitEvent: false });
                this._cdr.markForCheck();
            });
    }

    deleteEvent(): void {
        if (!this.event) return;
        this._eventsService.deleteEvent(this.event.id).subscribe({
            next: () => { this.showDeleteConfirm = false; this._router.navigate(['/apps/events']); },
            error: () => { this.showDeleteConfirm = false; this._cdr.markForCheck(); },
        });
    }

    // ── time picker helpers ──────────────────────────────────────
    readonly timeHours: string[] = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
    readonly timeMinutes: string[] = ['00', '05', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55'];

    get timeHour(): string { const v: string = this.headerForm?.get('eventTimeOnly')?.value ?? ''; return v.slice(0, 2) || '00'; }
    get timeMinute(): string { const v: string = this.headerForm?.get('eventTimeOnly')?.value ?? ''; return v.slice(3, 5) || '00'; }
    setTimePart(part: 'h' | 'm', val: string): void {
        const cur: string = this.headerForm.get('eventTimeOnly')?.value ?? '00:00';
        const [h, m] = cur.split(':');
        this.headerForm.get('eventTimeOnly')?.setValue(part === 'h' ? `${val}:${m || '00'}` : `${h || '00'}:${val}`);
        this._cdr.markForCheck();
    }

    // ── helpers ──────────────────────────────────────────────────
    get competitionName(): string {
        const cid = this.headerForm?.get('competitionId')?.value;
        return this.competitions?.find(x => x.id === cid)?.name || this.event?.competitionName || '-';
    }
    teamName(teamId: number | null | undefined): string {
        return this.teams?.find(x => x.id === Number(teamId))?.name || '-';
    }
    teamLogo(teamId: number | null | undefined): string {
        return this.teams?.find(x => x.id === Number(teamId))?.image || 'assets/images/placeholder-team.png';
    }
    get formattedDateGreek(): string {
        const iso = this.headerForm?.get('eventDate')?.value || this.event?.eventDate;
        if (!iso) return '-';
        const d = new Date(iso);
        if (isNaN(d.getTime())) return iso;
        return d.toLocaleDateString('el-GR', { day: 'numeric', month: 'long', year: 'numeric' })
            + ' | ' + d.toLocaleTimeString('el-GR', { hour: '2-digit', minute: '2-digit' });
    }
    private splitIsoToDateTime(iso: string): { dateOnly: Date | null; timeOnly: string } {
        if (!iso) return { dateOnly: null, timeOnly: '' };
        const d = new Date(iso);
        if (isNaN(d.getTime())) return { dateOnly: null, timeOnly: '' };
        const pad = (n: number) => String(n).padStart(2, '0');
        return { dateOnly: d, timeOnly: `${pad(d.getHours())}:${pad(d.getMinutes())}` };
    }
    private combineDateAndTime(dateOnly: any, timeOnly: string): string {
        if (!dateOnly) return this.event?.eventDate || '';
        const t = timeOnly || '00:00';
        if (typeof dateOnly === 'string') return `${dateOnly}T${t}`;
        let d: Date;
        if (typeof dateOnly.toJSDate === 'function') d = dateOnly.toJSDate();
        else d = dateOnly as Date;
        const pad = (n: number) => String(n).padStart(2, '0');
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${t}`;
    }
    get eventDateFormatted(): string {
        const iso = this.event?.eventDate;
        if (!iso) return '—';
        const d = new Date(iso);
        return isNaN(d.getTime()) ? '—' : d.toLocaleDateString('el-GR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    }
    get eventTimeFormatted(): string {
        const iso = this.event?.eventDate;
        if (!iso) return '—';
        const d = new Date(iso);
        return isNaN(d.getTime()) ? '—' : d.toLocaleTimeString('el-GR', { hour: '2-digit', minute: '2-digit' });
    }
    tvChannelName(tvChannelId: number | null | undefined): string {
        if (tvChannelId == null) return '';
        return this.tvChannels?.find(x => x.id === Number(tvChannelId))?.name || '';
    }
    competitionImage(competitionId: number | null | undefined): string {
        return this.competitions?.find(x => x.id === Number(competitionId))?.image || '';
    }
    onAvatarSelected(_ev: Event): void { }
    backToList(): void { this._router.navigateByUrl('/apps/events'); }
}
