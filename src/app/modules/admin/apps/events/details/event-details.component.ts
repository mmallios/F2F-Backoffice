

import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { FormBuilder, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { Subject, combineLatest, forkJoin, map, of, startWith, switchMap, takeUntil } from 'rxjs';

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
    Competition,
    EventItem,
    EventStats,
    EventsService,
    Team,
    Ticket,
    TvChannel
} from '@fuse/services/events/events.service';
import { EventFanCardUsage, FanCardsAdminService } from '@fuse/services/fan-cards/fan-cards-admin.service';

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
    tickets: any[] = [];
    tvChannels: TvChannel[] = []

    overviewEdit = false;

    showDeleteConfirm = false;

    headerForm!: FormGroup;
    statsStrip: any;
    eventStats: EventStats | null = null;

    // gates dropdown options (computed from tickets)
    availableGates: number[] = [];

    // filtered list shown in UI
    filteredTickets: any[] = [];

    ticketSearchCtrl = new FormControl<string>('', { nonNullable: true });
    ticketGateCtrl = new FormControl<number | null>(null);
    ticketTypeCtrl = new FormControl<number | null>(null);

    // component.ts (dummy stats strip)

    trackByStatKey = (_: number, s: any) => s.key;
    ticketStatusCtrl = new FormControl<number | null>(null);

    createMode = false;

    fanCardUsages: EventFanCardUsage[] = [];
    loadingFanCardUsages = false;
    fanCardUsagesLoaded = false;



    private _unsubscribeAll = new Subject<void>();

    constructor(
        private _route: ActivatedRoute,
        private _router: Router,
        private _eventsService: EventsService,
        private _fanCardsService: FanCardsAdminService,
        private _fb: FormBuilder,
        private _cdr: ChangeDetectorRef
    ) { }

    // ==============================
    // Lifecycle
    // ==============================
    ngOnInit(): void {
        this.buildHeaderForm();

        // load dropdowns once (teams/competitions/tv)
        forkJoin({
            teams: this._eventsService.getTeams(),
            competitions: this._eventsService.getCompetitions(),
            tvChannels: this._eventsService.getTVChannels(),
        }).pipe(takeUntil(this._unsubscribeAll))
            .subscribe(({ teams, competitions, tvChannels }) => {
                this.teams = teams ?? [];
                this.competitions = competitions ?? [];
                this.tvChannels = tvChannels ?? [];
                this._cdr.markForCheck();
            });

        // ✅ decide mode from route data
        this._route.data
            .pipe(takeUntil(this._unsubscribeAll))
            .subscribe((d: any) => {
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
                        competitionId: null,
                        matchday: '',
                        eventDateOnly: null,
                        eventTimeOnly: '',
                        homeTeamId: null,
                        awayTeamId: null,
                        tvChannel: null,
                        referenceId: '',
                        openTickets: true,
                        eventDate: ''
                    }, { emitEvent: false });

                    this.headerForm.enable({ emitEvent: false });
                    this._cdr.markForCheck();
                    return;
                }

                // ✅ edit mode: resolver gives us event
                this.createMode = false;
                const ev = d?.['event'] as EventItem | null;

                if (!ev) {
                    this._router.navigateByUrl('/apps/events');
                    return;
                }

                this.event = ev;
                this.overviewEdit = false;

                this.patchHeaderFormFromEvent(ev);
                this.headerForm.disable({ emitEvent: false });

                this._eventsService.getEventStats(ev.id).subscribe({
                    next: (stats) => { this.eventStats = stats; this._cdr.markForCheck(); },
                });

                this._cdr.markForCheck();
            });


    }


    ngOnDestroy(): void {
        this._unsubscribeAll.next();
        this._unsubscribeAll.complete();
    }

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
            error: () => {
                this.loadingFanCardUsages = false;
                this._cdr.markForCheck();
            },
        });
    }

    // ==============================
    // Form
    // ==============================
    private buildHeaderForm(): void {
        this.headerForm = this._fb.group({
            competitionId: [null, Validators.required],

            // matchday ΔΕΝ είναι required (σύμφωνα με αυτό που ζήτησες)
            matchday: [''],

            // required μόνο ημερομηνία (ώρα προαιρετική)
            eventDateOnly: [null as Date | null, Validators.required],
            eventTimeOnly: ['', Validators.pattern(/^([01]\d|2[0-3]):[0-5]\d$/)], // optional, 24h HH:MM

            homeTeamId: [null, Validators.required],
            awayTeamId: [null, Validators.required],

            eventDate: [''],
            tvChannel: [null],
            referenceId: [''],
            openTickets: [true],
        });

        // ξεκινά disabled μέχρι να δούμε αν είναι new ή υπάρχον
        this.headerForm.disable({ emitEvent: false });
    }

    ticketTypeLabel(type: number): string {
        return type === 0 ? 'ΕΙΣΙΤΗΡΙΟ ΔΙΑΡΚΕΙΑΣ' : 'ΕΙΣΙΤΗΡΙΟ ΑΓΩΝΑ';
    }

    ticketStatusLabel(status: number): string {
        switch (status) {
            case 0:
                return 'ΔΙΑΘΕΣΙΜΟ';
            case 1:
                return 'ΕΚΡΕΜΜΕΙ ΜΕΤΑΒΙΒΑΣΗ';
            case 2:
                return 'ΜΕΤΑΒΗΒΑΣΤΗΚΕ';
            default:
                return 'Unknown';
        }
    }


    private patchHeaderFormFromEvent(ev: EventItem): void {
        const iso = ev.eventDate || '';
        const { dateOnly, timeOnly } = this.splitIsoToDateTime(iso);

        this.headerForm.reset(
            {
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
            },
            { emitEvent: false }
        );
    }

    // ==============================
    // Header edit actions
    // ==============================
    enableHeaderEdit(): void {
        this.overviewEdit = true;
        this.headerForm.enable({ emitEvent: false });

        // Αν δεν έχει split values (πχ κενό), προσπάθησε από eventDate
        const dateOnly = this.headerForm.get('eventDateOnly')?.value;
        const timeOnly = this.headerForm.get('eventTimeOnly')?.value;
        if ((!dateOnly || !timeOnly) && this.headerForm.get('eventDate')?.value) {
            const split = this.splitIsoToDateTime(this.headerForm.get('eventDate')?.value);
            this.headerForm.patchValue(
                { eventDateOnly: split.dateOnly, eventTimeOnly: split.timeOnly },
                { emitEvent: false }
            );
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
        if (this.headerForm.invalid) {
            this.headerForm.markAllAsTouched();
            this._cdr.markForCheck();
            return;
        }

        const raw = this.headerForm.getRawValue();

        // ώρα προαιρετική → αν λείπει βάλε 00:00
        const combined = this.combineDateAndTime(raw.eventDateOnly, raw.eventTimeOnly || '00:00');

        const payload: Partial<EventItem> = {
            code: 'BO',
            name: 'BOO',
            competitionId: raw.competitionId,
            matchday: raw.matchday || '',
            homeTeamId: raw.homeTeamId,
            awayTeamId: raw.awayTeamId,
            eventDate: combined,
            tvChannel: raw.tvChannel,
            referenceMatchId: raw.referenceId,
            isTicketingOpen: !!raw.openTickets,
        };

        // ✅ CREATE
        if (this.createMode) {
            this._eventsService.createEvent(payload).subscribe((created: EventItem) => {
                // πήγαινε στο details του νέου event
                this._router.navigate(['/apps/events', created.id]);
            });
            return;
        }

        // ✅ UPDATE
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
            next: () => {
                this.showDeleteConfirm = false;
                this._router.navigate(['/apps/events']);
            },
            error: () => {
                this.showDeleteConfirm = false;
                this._cdr.markForCheck();
            },
        });
    }

    // ── Time picker helpers ──────────────────────────────────────
    readonly timeHours: string[] = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
    readonly timeMinutes: string[] = ['00', '05', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55'];

    get timeHour(): string {
        const v: string = this.headerForm?.get('eventTimeOnly')?.value ?? '';
        return v.slice(0, 2) || '00';
    }
    get timeMinute(): string {
        const v: string = this.headerForm?.get('eventTimeOnly')?.value ?? '';
        return v.slice(3, 5) || '00';
    }
    setTimePart(part: 'h' | 'm', val: string): void {
        const cur: string = this.headerForm.get('eventTimeOnly')?.value ?? '00:00';
        const [h, m] = cur.split(':');
        const newVal = part === 'h' ? `${val}:${m || '00'}` : `${h || '00'}:${val}`;
        this.headerForm.get('eventTimeOnly')?.setValue(newVal);
        this._cdr.markForCheck();
    }

    // ==============================
    // Helpers (teams/competitions)
    // ==============================
    get competitionName(): string {
        const cid = this.headerForm?.get('competitionId')?.value;
        const c = this.competitions?.find((x) => x.id === cid);
        return c?.name || this.event?.competitionName || '-';
    }

    teamName(teamId: number | null | undefined): string {
        const t = this.teams?.find((x) => x.id === Number(teamId));
        return t?.name || '-';
    }

    teamLogo(teamId: number | null | undefined): string {
        const t = this.teams?.find((x) => x.id === Number(teamId));
        return t?.image || 'assets/images/placeholder-team.png';
    }

    // ==============================
    // Date formatting
    // ==============================
    get formattedDateGreek(): string {
        const iso = this.headerForm?.get('eventDate')?.value || this.event?.eventDate;
        if (!iso) return '-';

        const d = new Date(iso);
        if (isNaN(d.getTime())) return iso;

        // πχ "9 Ιανουαρίου 2026 | 21:30"
        const datePart = d.toLocaleDateString('el-GR', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
        });

        const timePart = d.toLocaleTimeString('el-GR', {
            hour: '2-digit',
            minute: '2-digit',
        });

        return `${datePart} | ${timePart}`;
    }

    private splitIsoToDateTime(iso: string): { dateOnly: Date | null; timeOnly: string } {
        if (!iso) return { dateOnly: null, timeOnly: '' };

        const d = new Date(iso);
        if (isNaN(d.getTime())) return { dateOnly: null, timeOnly: '' };

        const pad = (n: number) => String(n).padStart(2, '0');
        return {
            dateOnly: d,
            timeOnly: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
        };
    }

    private combineDateAndTime(dateOnly: any, timeOnly: string): string {
        if (!dateOnly) return this.event?.eventDate || '';
        const t = timeOnly || '00:00';
        let d: Date;
        if (typeof dateOnly === 'string') {
            return `${dateOnly}T${t}`;
        }
        // Luxon DateTime (has toJSDate)
        if (typeof dateOnly.toJSDate === 'function') {
            d = dateOnly.toJSDate();
        } else {
            d = dateOnly as Date;
        }
        const pad = (n: number) => String(n).padStart(2, '0');
        const ds = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
        return `${ds}T${t}`;
    }

    // ==============================
    // Tickets actions (hooks)
    // ==============================
    trackByTicketId = (_: number, t: Ticket) => t.id;

    openEditTicket(t: Ticket): void {
        // TODO: ανοίγεις MatDialog με form (edit)
        console.log('EDIT TICKET', t);
    }

    openDeleteTicket(t: Ticket): void {
        // TODO: ανοίγεις confirm dialog (delete)
        console.log('DELETE TICKET', t);
    }

    // ==============================
    // Avatar (αν το θες στο header)
    // ==============================
    onAvatarSelected(_ev: Event): void {
        // optional - αν κρατάς εικόνες ομάδων/διοργάνωσης κλπ
    }

    tvChannelName(tvChannelId: number | null | undefined): string {
        if (tvChannelId == null) return '';
        return this.tvChannels?.find(x => x.id === Number(tvChannelId))?.name || '';
    }

    competitionImage(competitionId: number | null | undefined): string {
        return this.competitions?.find(x => x.id === Number(competitionId))?.image || '';
    }

    get eventDateFormatted(): string {
        const iso = this.event?.eventDate;
        if (!iso) return '—';
        const d = new Date(iso);
        if (isNaN(d.getTime())) return '—';
        return d.toLocaleDateString('el-GR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    }

    get eventTimeFormatted(): string {
        const iso = this.event?.eventDate;
        if (!iso) return '—';
        const d = new Date(iso);
        if (isNaN(d.getTime())) return '—';
        return d.toLocaleTimeString('el-GR', { hour: '2-digit', minute: '2-digit' });
    }

    // ==============================
    // Navigation
    // ==============================
    backToList(): void {
        this._router.navigateByUrl('/apps/events');
    }
}
