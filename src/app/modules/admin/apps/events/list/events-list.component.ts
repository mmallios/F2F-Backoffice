import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { debounceTime, distinctUntilChanged, merge } from 'rxjs';

import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatTabsModule } from '@angular/material/tabs';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSelectModule } from '@angular/material/select';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';

import { EventItem, EventsService, TvChannel } from '@fuse/services/events/events.service';
import { ClaimsService } from '@fuse/services/claims/claims.service';
import { BoPermissionDirective } from '@fuse/directives/permission/bo-permission.directive';
import { forkJoin } from 'rxjs';

type TabKey = 'all' | 'football' | 'basket' | 'polo' | 'volley' | 'handball';

type EventVM = EventItem & {
  tvChannelName: string;
  isTicketingOpen: boolean;
  sportId: number;
};

type TabVM = {
  key: TabKey;
  label: string;
  sportId: number | null;

  searchCtrl: FormControl<string | null>;
  dateRange: FormGroup<{
    start: FormControl<Date | null>;
    end: FormControl<Date | null>;
  }>;
  competitionCtrl: FormControl<string | null>;
  ticketsCtrl: FormControl<boolean | null>;

  filtered: EventVM[];
};

@Component({
  selector: 'events-list',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatIconModule,
    MatInputModule,
    MatTabsModule,
    MatFormFieldModule,
    MatSlideToggleModule,
    MatSelectModule,
    MatDatepickerModule,
    MatNativeDateModule,
    BoPermissionDirective,
  ],
  templateUrl: './events-list.component.html',
  styleUrl: './events-list.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EventsListComponent implements OnInit {
  readonly claimsService = inject(ClaimsService);

  events: EventVM[] = [];
  tvchannels: TvChannel[] = [];

  competitionsByTab: Record<TabKey, string[]> = {
    all: [],
    football: [],
    basket: [],
    polo: [],
    volley: [],
    handball: [],
  };

  tabs: TabVM[] = [
    this.createTab('all', 'ΟΛΑ', null),
    this.createTab('football', 'ΠΟΔΟΣΦΑΙΡΟ', 1),
    this.createTab('basket', 'ΜΠΑΣΚΕΤ', 3),
    this.createTab('polo', 'ΠΟΛΟ', 4),
    this.createTab('volley', 'ΒΟΛΕΥ', 5),
    this.createTab('handball', 'XANDBALL', 6),
  ];

  constructor(
    private _eventsService: EventsService,
    private _router: Router,
    private _cdr: ChangeDetectorRef
  ) { }

  ngOnInit(): void {
    forkJoin({
      events: this._eventsService.getEvents(),
      tvChannels: this._eventsService.getTVChannels()
    }).subscribe(({ events, tvChannels }) => {

      const tvMap = new Map<number, string>(
        (tvChannels ?? []).map(c => [c.id, c.name])
      );

      this.events = (events ?? [])
        .map((e: any) => ({
          ...e,
          tvChannelName: tvMap.get(e.tvChannel) ?? '-',
          isTicketingOpen: !!(e.isTicketingOpen ?? e.openTickets ?? false),
          sportId: Number(e.sportId ?? 0),
        }))
        .sort((a, b) => new Date(b.eventDate).getTime() - new Date(a.eventDate).getTime());

      this.applyAllFilters();
      this.bindAllTabsChanges();
      this._cdr.markForCheck();
    });
  }

  private createTab(key: TabKey, label: string, sportId: number | null): TabVM {
    return {
      key,
      label,
      sportId,
      searchCtrl: new FormControl<string | null>(''),
      dateRange: new FormGroup({
        start: new FormControl<Date | null>(null),
        end: new FormControl<Date | null>(null),
      }),
      competitionCtrl: new FormControl<string | null>(null),
      ticketsCtrl: new FormControl<boolean | null>(null),
      filtered: [],
    };
  }

  private bindAllTabsChanges(): void {
    for (const tab of this.tabs) {
      const search$ = tab.searchCtrl.valueChanges.pipe(debounceTime(200), distinctUntilChanged());
      const date$ = tab.dateRange.valueChanges;
      const comp$ = tab.competitionCtrl.valueChanges;
      const tickets$ = tab.ticketsCtrl.valueChanges;

      merge(search$, date$, comp$, tickets$).subscribe(() => {
        this.thisapply();
        this._cdr.markForCheck();
      });
    }
  }

  private thisapply(): void {
    this.applyAllFilters();
  }

  clearDateRange(tab: TabVM): void {
    tab.dateRange.setValue({ start: null, end: null });
  }

  clearAllTabFilters(tab: TabVM): void {
    tab.searchCtrl.setValue('');
    tab.dateRange.setValue({ start: null, end: null });
    tab.competitionCtrl.setValue(null);
    tab.ticketsCtrl.setValue(null);
    this.applyAllFilters();
    this._cdr.markForCheck();
  }

  private applyAllFilters(): void {
    for (const tab of this.tabs) {
      const base = tab.sportId == null
        ? this.events
        : this.events.filter(x => x.sportId === tab.sportId);

      this.competitionsByTab[tab.key] = Array.from(
        new Set(base.map(x => x.competitionName).filter(Boolean))
      ).sort((a, b) => a.localeCompare(b, 'el'));

      tab.filtered = this.applyFilters(base, tab);
    }
  }

  private applyFilters(list: EventVM[], tab: TabVM): EventVM[] {
    const q = (tab.searchCtrl.value ?? '').toLowerCase().trim();
    const comp = tab.competitionCtrl.value;
    const tickets = tab.ticketsCtrl.value;
    const start = tab.dateRange.value.start;
    const end = tab.dateRange.value.end;

    return list.filter(ev => {

      // Date range filter
      if (start || end) {
        const d = new Date(ev.eventDate);
        if (isNaN(d.getTime())) return false;

        const day = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

        if (start) {
          const s = new Date(start.getFullYear(), start.getMonth(), start.getDate()).getTime();
          if (day < s) return false;
        }
        if (end) {
          const e = new Date(end.getFullYear(), end.getMonth(), end.getDate()).getTime();
          if (day > e) return false;
        }
      }

      // Competition filter
      if (comp && ev.competitionName !== comp) return false;

      // Tickets enabled filter
      if (tickets !== null && ev.isTicketingOpen !== tickets) return false;

      // Search filter
      if (!q) return true;

      const hay = [
        ev.homeTeamName,
        ev.awayTeamName,
        ev.competitionName,
        String(ev.matchday ?? ''),
      ].join(' ').toLowerCase();

      return hay.includes(q);
    });
  }

  viewDetails(ev: EventVM): void {
    this._router.navigate(['/apps/events', ev.id]);
  }

  toggleTickets(ev: EventVM, checked: boolean): void {
    ev.isTicketingOpen = checked;
    this._cdr.markForCheck();
  }

  trackById = (_: number, x: EventVM) => x.id;

  formatDateGr(value: string): string {
    if (!value) return '-';
    const d = new Date(value);
    if (isNaN(d.getTime())) return '-';

    const datePart = new Intl.DateTimeFormat('el-GR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(d);

    const timePart = new Intl.DateTimeFormat('el-GR', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(d);

    return `${datePart} | ${timePart}`;
  }

  addNewEvent(): void {
    this._router.navigate(['/apps/events/new']);
  }
}
