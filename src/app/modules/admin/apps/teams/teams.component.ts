import { AsyncPipe, CommonModule, DOCUMENT, I18nPluralPipe, NgClass } from '@angular/common';
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
import { ActivatedRoute, Router, RouterLink, RouterOutlet } from '@angular/router';
import { FuseMediaWatcherService } from '@fuse/services/media-watcher';
import { Subject, combineLatest, filter, fromEvent, takeUntil } from 'rxjs';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSelectModule } from '@angular/material/select';


import { EventsService, Team } from '@fuse/services/events/events.service';
import { TeamUpsertDialogComponent } from './dialogs/team-upsert-dialog.component';

type SportOption = { id: number; name: string };

@Component({
    selector: 'teams',
    templateUrl: './teams.component.html',
    encapsulation: ViewEncapsulation.None,
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: true,
    imports: [
        CommonModule,
        MatSidenavModule,
        RouterOutlet,
        RouterLink,

        FormsModule,
        ReactiveFormsModule,
        AsyncPipe,
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
export class TeamsComponent implements OnInit, OnDestroy {

    @ViewChild('matDrawer', { static: true }) matDrawer: MatDrawer;
    @ViewChild(MatPaginator) paginator: MatPaginator;
    @ViewChild(MatSort) sort: MatSort;

    teamsCount = 0;
    filteredCount = 0;
    pageSize = 15;
    loading = true;

    drawerMode: 'side' | 'over' = 'over';

    teamsTableColumns: string[] = ['image', 'team', 'sport', 'actions'];

    searchInputControl: UntypedFormControl = new UntypedFormControl();
    filterSportId = new UntypedFormControl(null);
    filterActive = new UntypedFormControl(null);

    dataSource = new MatTableDataSource<Team>([]);

    // sports options (replace with StaticData if you have it)
    sports: SportOption[] = [
        { id: 1, name: 'Ποδόσφαιρο' },
        { id: 3, name: 'Μπάσκετ' },
        { id: 4, name: 'Πόλο' },
        { id: 5, name: 'Βόλεϊ' },
        { id: 6, name: 'Χάντμπολ' },
    ];

    private _sportById = new Map<number, string>();
    private _unsubscribeAll: Subject<any> = new Subject<any>();

    constructor(
        private _activatedRoute: ActivatedRoute,
        private _changeDetectorRef: ChangeDetectorRef,
        private _eventsService: EventsService,
        @Inject(DOCUMENT) private _document: any,
        private _router: Router,
        private _fuseMediaWatcherService: FuseMediaWatcherService,
        private _dialog: MatDialog
    ) { }

    ngOnInit(): void {
        this.loading = true;

        this._sportById.clear();
        this.sports.forEach(s => this._sportById.set(s.id, s.name));

        // load teams
        this._eventsService.getTeams().subscribe({
            next: (teams) => {
                this.loading = false;
                this.teamsCount = teams?.length ?? 0;

                this.dataSource = new MatTableDataSource<Team>(teams ?? []);
                this.dataSource.paginator = this.paginator;
                this.dataSource.sort = this.sort;

                this.setupFilterPredicate();
                this.applyCombinedFilter();

                this._changeDetectorRef.markForCheck();
            },
            error: () => {
                this.loading = false;
                this._changeDetectorRef.markForCheck();
            }
        });

        combineLatest([this._eventsService.teams$])
            .pipe(takeUntil(this._unsubscribeAll))
            .subscribe(([teams]) => {
                const list = teams ?? [];

                this.loading = false;
                this.teamsCount = list.length;

                this.dataSource = new MatTableDataSource<Team>(list);
                this.dataSource.paginator = this.paginator;
                this.dataSource.sort = this.sort;

                if (this.paginator) this.paginator.pageSize = this.pageSize;

                this.dataSource.sortingDataAccessor = (item: any, property: string) => {
                    switch (property) {
                        case 'team': return (item?.name ?? '').toString().toLowerCase();
                        case 'sport': return this.getSportName(item?.sportId).toLowerCase();
                        case 'active': return String(!!item?.isActive);
                        default: return (item[property] ?? '').toString().toLowerCase();
                    }
                };

                // combined filters
                this.dataSource.filterPredicate = (t: any, raw: string) => {
                    let f: any = {};
                    try { f = raw ? JSON.parse(raw) : {}; } catch { f = {}; }

                    const q = (f.q || '').trim().toLowerCase();
                    const sportId = f.sportId;
                    const isActive = f.isActive;

                    const passSport = sportId == null || Number(t?.sportId) === Number(sportId);
                    const passActive = isActive == null || Boolean(t?.isActive) === Boolean(isActive);

                    if (!passSport || !passActive) return false;

                    if (!q) return true;

                    const bag = [
                        t?.name,
                        t?.shortName,
                        this.getSportName(t?.sportId),
                        t?.isActive ? 'active' : 'inactive',
                    ].filter(Boolean).join(' ').toLowerCase();

                    return bag.includes(q);
                };

                this.applyCombinedFilter();
                this._changeDetectorRef.markForCheck();
            });

        // filters
        this.searchInputControl.valueChanges.pipe(takeUntil(this._unsubscribeAll))
            .subscribe(() => this.applyCombinedFilter());

        this.filterSportId.valueChanges.pipe(takeUntil(this._unsubscribeAll))
            .subscribe(() => this.applyCombinedFilter());

        this.filterActive.valueChanges.pipe(takeUntil(this._unsubscribeAll))
            .subscribe(() => this.applyCombinedFilter());

        // responsive drawer mode
        this._fuseMediaWatcherService.onMediaChange$
            .pipe(takeUntil(this._unsubscribeAll))
            .subscribe(({ matchingAliases }) => {
                this.drawerMode = matchingAliases.includes('lg') ? 'side' : 'over';
                this._changeDetectorRef.markForCheck();
            });

        // shortcut Ctrl/Cmd + /
        fromEvent(this._document, 'keydown')
            .pipe(
                takeUntil(this._unsubscribeAll),
                filter<KeyboardEvent>((event) => (event.ctrlKey === true || event.metaKey === true) && event.key === '/')
            )
            .subscribe(() => this.openTeamDialog());
    }

    ngOnDestroy(): void {
        this._unsubscribeAll.next(null);
        this._unsubscribeAll.complete();
    }

    onBackdropClicked(): void {
        this._router.navigate(['./'], { relativeTo: this._activatedRoute });
        this._changeDetectorRef.markForCheck();
    }

    private setupFilterPredicate(): void {
        this.dataSource.filterPredicate = (t: any, raw: string) => {
            let f: any = {};
            try { f = raw ? JSON.parse(raw) : {}; } catch { f = {}; }

            const q = (f.q || '').trim().toLowerCase();
            const sportId = f.sportId;
            const isActive = f.isActive;

            const passSport = sportId == null || Number(t?.sportId) === Number(sportId);
            const passActive = isActive == null || Boolean(t?.isActive) === Boolean(isActive);

            if (!passSport || !passActive) return false;

            if (!q) return true;

            const bag = [
                t?.name,
                t?.shortName,
                this.getSportName(t?.sportId),
                t?.isActive ? 'active' : 'inactive',
            ]
                .filter(Boolean)
                .join(' ')
                .toLowerCase();

            return bag.includes(q);
        };
    }


    applyCombinedFilter(): void {
        const payload = {
            q: (this.searchInputControl.value || '').toString(),
            sportId: this.filterSportId.value,
            isActive: this.filterActive.value,
        };

        this.dataSource.filter = JSON.stringify(payload);

        if (this.dataSource.paginator) {
            this.dataSource.paginator.firstPage();
        }

        this.filteredCount = this.dataSource.filteredData?.length ?? 0;
        this._changeDetectorRef.markForCheck();
    }


    clearFilters(): void {
        this.searchInputControl.setValue('');
        this.filterSportId.setValue(null);
        this.filterActive.setValue(null);
    }

    openTeamDialog(team?: Team): void {
        const ref = this._dialog.open(TeamUpsertDialogComponent, {
            width: '900px',
            maxWidth: '95vw',
            panelClass: ['fuse-mat-dialog', 'rounded-2xl'],
            data: team ? { mode: 'edit', team, sports: this.sports } : { mode: 'create', sports: this.sports },
            autoFocus: false,
        });

        ref.afterClosed()
            .pipe(
                takeUntil(this._unsubscribeAll),
                filter((res) => !!res?.ok)
            )
            .subscribe(() => {
                // List updates automatically via the _teams BehaviorSubject
                // (EventsService.updateTeam/createTeam patches it in tap())
                this._changeDetectorRef.markForCheck();
            });
    }

    getSportName(sportId: any): string {
        const n = Number(sportId);
        return this._sportById.get(n) ?? '-';
    }
}
