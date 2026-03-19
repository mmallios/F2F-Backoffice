import { CommonModule, DOCUMENT, I18nPluralPipe, NgClass } from '@angular/common';
import {
    ChangeDetectionStrategy,
    ChangeDetectorRef,
    Component,
    Inject,
    OnDestroy,
    OnInit,
    ViewChild,
    ViewEncapsulation,
} from '@angular/core';
import { FormsModule, ReactiveFormsModule, UntypedFormControl } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatDrawer, MatSidenavModule } from '@angular/material/sidenav';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatChipsModule } from '@angular/material/chips';
import { ActivatedRoute, Router, RouterOutlet } from '@angular/router';
import { FuseMediaWatcherService } from '@fuse/services/media-watcher';
import { Subject, filter, fromEvent, takeUntil, forkJoin, catchError, finalize, of } from 'rxjs';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSelectModule } from '@angular/material/select';

import { EventsService, EventItem } from '@fuse/services/events/events.service';
import { GroupChatsService, GroupChat } from '@fuse/services/groupchats/groupchats.service';
import { GroupChatCreateDialogComponent } from './dialogs/groupchat-create-dialog.component';
import { FuseConfirmationService } from '@fuse/services/confirmation';

@Component({
    selector: 'groupchats',
    templateUrl: './groupchats.component.html',
    encapsulation: ViewEncapsulation.None,
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: true,
    imports: [
        CommonModule,
        MatSidenavModule,
        RouterOutlet,

        FormsModule,
        ReactiveFormsModule,
        I18nPluralPipe,
        NgClass,

        MatFormFieldModule,
        MatIconModule,
        MatInputModule,
        MatButtonModule,

        MatTableModule,
        MatPaginatorModule,
        MatSortModule,
        MatChipsModule,
        MatTooltipModule,
        MatDialogModule,
        MatSelectModule,
    ],
})
export class GroupChatsComponent implements OnInit, OnDestroy {
    @ViewChild('matDrawer', { static: true }) matDrawer: MatDrawer;
    @ViewChild(MatPaginator) paginator: MatPaginator;
    @ViewChild(MatSort) sort: MatSort;

    loading = true;
    drawerMode: 'side' | 'over' = 'over';

    count = 0;
    filteredCount = 0;
    pageSize = 15;

    dataSource = new MatTableDataSource<GroupChat>([]);
    tableColumns: string[] = ['image', 'name', 'event', 'isMain', 'active', 'actions'];

    // filters
    searchInputControl = new UntypedFormControl('');
    filterHasEvent = new UntypedFormControl(null);   // null | true | false
    filterIsActive = new UntypedFormControl(true);   // null | true | false

    // event lookup (for showing teams/competition/date)
    private _eventById = new Map<number, EventItem>();

    private _unsubscribeAll: Subject<any> = new Subject<any>();

    saving = false;
    saveError: string | null = null;

    constructor(
        private _activatedRoute: ActivatedRoute,
        private _cdr: ChangeDetectorRef,
        private _eventsService: EventsService,
        private _groupChatsService: GroupChatsService,
        @Inject(DOCUMENT) private _document: any,
        private _router: Router,
        private _fuseMediaWatcherService: FuseMediaWatcherService,
        private _dialog: MatDialog,
        private _confirmation: FuseConfirmationService
    ) { }

    ngOnInit(): void {
        this.loading = true;

        this._groupChatsService.getAll(true)
            .pipe(takeUntil(this._unsubscribeAll))
            .subscribe({
                next: (groups) => {
                    const list = (groups ?? []).slice().sort((a, b) => (b.id ?? 0) - (a.id ?? 0));

                    // load event details PER eventId using getEventById
                    this.loadEventsForGroups(list, () => {
                        this.count = list.length;
                        this.loading = false;

                        this.dataSource = new MatTableDataSource<GroupChat>(list);
                        this.dataSource.paginator = this.paginator;
                        this.dataSource.sort = this.sort;

                        if (this.paginator) this.paginator.pageSize = this.pageSize;

                        this.dataSource.sortingDataAccessor = (item: any, property: string) => {
                            switch (property) {
                                case 'name': return (item?.name ?? '').toString().toLowerCase();
                                case 'event': return this.getEventTitle(item?.eventId).toLowerCase();
                                case 'active': return String(!!item?.isActive);
                                case 'isMain': return String(!!item?.isMain);
                                default: return (item[property] ?? '').toString().toLowerCase();
                            }
                        };

                        this.setupFilterPredicate();
                        this.applyCombinedFilter();
                        this._cdr.markForCheck();
                    });
                },
                error: () => {
                    this.loading = false;
                    this._cdr.markForCheck();
                }
            });

        // listeners
        this.searchInputControl.valueChanges
            .pipe(takeUntil(this._unsubscribeAll))
            .subscribe(() => this.applyCombinedFilter());

        this.filterHasEvent.valueChanges
            .pipe(takeUntil(this._unsubscribeAll))
            .subscribe(() => this.applyCombinedFilter());

        this.filterIsActive.valueChanges
            .pipe(takeUntil(this._unsubscribeAll))
            .subscribe(() => this.applyCombinedFilter());

        // responsive drawer mode
        this._fuseMediaWatcherService.onMediaChange$
            .pipe(takeUntil(this._unsubscribeAll))
            .subscribe(({ matchingAliases }) => {
                this.drawerMode = matchingAliases.includes('lg') ? 'side' : 'over';
                this._cdr.markForCheck();
            });
    }

    private loadEventsForGroups(groups: GroupChat[], done: () => void): void {
        const ids = (groups ?? [])
            .map(g => g.eventId)
            .filter((x): x is number => x != null)
            .map(x => Number(x))
            .filter(x => Number.isFinite(x) && x > 0);

        const distinctIds = Array.from(new Set(ids));

        // clear map
        this._eventById.clear();

        if (!distinctIds.length) {
            done();
            return;
        }

        forkJoin(distinctIds.map(id => this._eventsService.getEventById(id)))
            .pipe(takeUntil(this._unsubscribeAll))
            .subscribe({
                next: (events) => {
                    // IMPORTANT: forkJoin keeps same order as distinctIds
                    events.forEach((ev, idx) => {
                        const id = distinctIds[idx];
                        if (ev) this._eventById.set(id, ev);
                    });
                    done();
                },
                error: () => {
                    // even if events fail, still render groups
                    done();
                }
            });
    }



    ngOnDestroy(): void {
        this._unsubscribeAll.next(null);
        this._unsubscribeAll.complete();
    }

    onBackdropClicked(): void {
        this._router.navigate(['./'], { relativeTo: this._activatedRoute });
        this._cdr.markForCheck();
    }

    private setupFilterPredicate(): void {
        this.dataSource.filterPredicate = (g: any, raw: string) => {
            let f: any = {};
            try { f = raw ? JSON.parse(raw) : {}; } catch { f = {}; }

            const q = (f.q || '').trim().toLowerCase();
            const hasEvent = f.hasEvent;     // null | true | false
            const isActive = f.isActive;     // null | true | false

            const gHasEvent = g?.eventId != null;

            const passHasEvent = hasEvent == null || Boolean(gHasEvent) === Boolean(hasEvent);
            const passActive = isActive == null || Boolean(g?.isActive) === Boolean(isActive);

            if (!passHasEvent || !passActive) return false;

            if (!q) return true;

            const ev = this.getEvent(g?.eventId);
            const bag = [
                g?.code,
                g?.name,
                g?.description,
                g?.isMain ? 'main' : '',
                g?.isActive ? 'active' : 'inactive',
                ev ? `${ev.homeTeamName} ${ev.awayTeamName} ${ev.competitionName} ${this.formatShortDate(ev.eventDate)}` : '',
            ].filter(Boolean).join(' ').toLowerCase();

            return bag.includes(q);
        };
    }

    applyCombinedFilter(): void {
        const payload = {
            q: (this.searchInputControl.value || '').toString(),
            hasEvent: this.filterHasEvent.value,
            isActive: this.filterIsActive.value,
        };

        this.dataSource.filter = JSON.stringify(payload);

        if (this.dataSource.paginator) {
            this.dataSource.paginator.firstPage();
        }

        this.filteredCount = this.dataSource.filteredData?.length ?? 0;
        this._cdr.markForCheck();
    }

    clearFilters(): void {
        this.searchInputControl.setValue('');
        this.filterHasEvent.setValue(null);
        this.filterIsActive.setValue(null);
    }

    openCreateDialog(): void {
        const ref = this._dialog.open(GroupChatCreateDialogComponent, {
            width: '900px',
            maxWidth: '95vw',
            panelClass: ['fuse-mat-dialog', 'rounded-2xl'],
            data: {},
            autoFocus: false,
        });

        ref.afterClosed()
            .pipe(takeUntil(this._unsubscribeAll), filter((res) => !!res))
            .subscribe(() => this.reload());
    }

    private reload(): void {
        this.loading = true;

        this._groupChatsService.getAll().subscribe({
            next: (groups) => {
                const list = (groups ?? []).slice().sort((a, b) => (b.id ?? 0) - (a.id ?? 0));

                this.loadEventsForGroups(list, () => {
                    this.count = list.length;
                    this.loading = false;

                    this.dataSource.data = list;
                    this.applyCombinedFilter();
                    this._cdr.markForCheck();
                });
            },
            error: () => {
                this.loading = false;
                this._cdr.markForCheck();
            }
        });
    }


    // --------- Event helpers ----------
    getEvent(eventId: any): EventItem | null {
        const id = Number(eventId);
        if (!id) return null;
        return this._eventById.get(id) ?? null;
    }

    getEventTitle(eventId: any): string {
        const ev = this.getEvent(eventId);
        if (!ev) return '-';
        return `${ev.homeTeamName} - ${ev.awayTeamName}`;
    }

    getEventSubtitle(eventId: any): string {
        const ev = this.getEvent(eventId);
        if (!ev) return '';
        return `${ev.competitionName} • ${this.formatShortDate(ev.eventDate)}`;
    }

    formatShortDate(value: string): string {
        if (!value) return '-';
        const d = new Date(value);
        if (isNaN(d.getTime())) return '-';

        // short like 12/01 19:30
        const datePart = new Intl.DateTimeFormat('el-GR', { day: '2-digit', month: '2-digit' }).format(d);
        const timePart = new Intl.DateTimeFormat('el-GR', { hour: '2-digit', minute: '2-digit', hour12: false }).format(d);

        return `${datePart} ${timePart}`;
    }

    openEdit(g: GroupChat): void {
        this._router.navigate(['/apps/groupchats', g.id]);
    }

    deleteGroupChat(g: GroupChat): void {
        this._confirmation.open({
            title: 'Διαγραφή group chat',
            message: `Είστε σίγουροι ότι θέλετε να διαγράψετε το group chat <strong>${g.name}</strong>;`,
            icon: { show: true, name: 'heroicons_outline:trash', color: 'warn' },
            actions: {
                confirm: { label: 'Διαγραφή', color: 'warn' },
                cancel: { label: 'Ακύρωση' },
            },
        }).afterClosed()
            .pipe(takeUntil(this._unsubscribeAll))
            .subscribe(result => {
                if (result !== 'confirmed') return;
                this._groupChatsService.deleteGroupChat(g.id)
                    .pipe(takeUntil(this._unsubscribeAll))
                    .subscribe({
                        next: () => {
                            this.dataSource.data = this.dataSource.data.filter(x => x.id !== g.id);
                            this.count = this.dataSource.data.length;
                            this.applyCombinedFilter();
                        },
                        error: () => this._cdr.markForCheck(),
                    });
            });
    }

    trackById = (_: number, x: GroupChat) => x.id;


}
