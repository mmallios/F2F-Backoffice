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
    inject,
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
import { Subject, filter, fromEvent, takeUntil } from 'rxjs';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSelectModule } from '@angular/material/select';

import { EventsService, Competition } from '@fuse/services/events/events.service';
import { CompetitionUpsertDialogComponent } from './dialogs/competition-upsert-dialog.component';
import { combineLatest } from 'rxjs';
import { FanCardsAdminService, FanCardSeason } from '@fuse/services/fan-cards/fan-cards-admin.service';
import { ClaimsService } from '@fuse/services/claims/claims.service';
import { BoPermissionDirective } from '@fuse/directives/permission/bo-permission.directive';


type SportOption = { id: number; name: string };

@Component({
    selector: 'competitions',
    templateUrl: './competitions.component.html',
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
        BoPermissionDirective,
    ],
})
export class CompetitionsComponent implements OnInit, OnDestroy {
    readonly claimsService = inject(ClaimsService);

    @ViewChild('matDrawer', { static: true }) matDrawer: MatDrawer;
    @ViewChild(MatPaginator) paginator: MatPaginator;
    @ViewChild(MatSort) sort: MatSort;

    loading = true;
    drawerMode: 'side' | 'over' = 'over';

    competitionsCount = 0;
    filteredCount = 0;
    pageSize = 15;

    dataSource = new MatTableDataSource<Competition>([]);
    tableColumns: string[] = ['image', 'name', 'sport', 'active', 'actions'];

    // filters
    searchInputControl = new UntypedFormControl('');
    filterSportId = new UntypedFormControl(null);
    filterActive = new UntypedFormControl(null);


    // sports options (adjust to your ids)
    sports: SportOption[] = [
        { id: 1, name: 'Ποδόσφαιρο' },
        { id: 3, name: 'Μπάσκετ' },
        { id: 4, name: 'Πόλο' },
        { id: 5, name: 'Βόλεϊ' },
        { id: 6, name: 'Χάντμπολ' },
    ];
    private _sportById = new Map<number, string>();
    private _seasonById = new Map<number, string>();

    private _unsubscribeAll: Subject<any> = new Subject<any>();

    constructor(
        private _activatedRoute: ActivatedRoute,
        private _cdr: ChangeDetectorRef,
        private _eventsService: EventsService,
        @Inject(DOCUMENT) private _document: any,
        private _router: Router,
        private _fuseMediaWatcherService: FuseMediaWatcherService,
        private _dialog: MatDialog,
        private _fanCardsService: FanCardsAdminService,
    ) { }

    ngOnInit(): void {
        this.loading = true;

        this._sportById.clear();
        this.sports.forEach(s => this._sportById.set(s.id, s.name));

        this._fanCardsService.getSeasons()
            .pipe(takeUntil(this._unsubscribeAll))
            .subscribe(seasons => {
                this._seasonById.clear();
                (seasons ?? []).forEach(s => this._seasonById.set(s.id, s.name));
                this._cdr.markForCheck();
            });

        // Load competitions initially (populates BehaviorSubject via tap)
        this._eventsService.getCompetitions()
            .pipe(takeUntil(this._unsubscribeAll))
            .subscribe({
                error: () => {
                    this.loading = false;
                    this._cdr.markForCheck();
                }
            });

        // Reactively keep list in sync with BehaviorSubject
        combineLatest([this._eventsService.competitions$])
            .pipe(takeUntil(this._unsubscribeAll))
            .subscribe(([rows]) => {
                const list = rows ?? [];

                this.loading = false;
                this.competitionsCount = list.length;

                this.dataSource = new MatTableDataSource<Competition>(list);
                this.dataSource.paginator = this.paginator;
                this.dataSource.sort = this.sort;

                if (this.paginator) this.paginator.pageSize = this.pageSize;

                this.dataSource.sortingDataAccessor = (item: any, property: string) => {
                    switch (property) {
                        case 'name': return (item?.name ?? '').toString().toLowerCase();
                        case 'sport': return this.getSportName(item?.sportId).toLowerCase();
                        case 'active': return String(!!item?.isActive);
                        default: return (item[property] ?? '').toString().toLowerCase();
                    }
                };

                this.setupFilterPredicate();
                this.applyCombinedFilter();

                this._cdr.markForCheck();
            });

        // listeners
        this.searchInputControl.valueChanges
            .pipe(takeUntil(this._unsubscribeAll))
            .subscribe(() => this.applyCombinedFilter());

        this.filterSportId.valueChanges
            .pipe(takeUntil(this._unsubscribeAll))
            .subscribe(() => this.applyCombinedFilter());

        this.filterActive.valueChanges
            .pipe(takeUntil(this._unsubscribeAll))
            .subscribe(() => this.applyCombinedFilter());

        // drawer mode responsive
        this._fuseMediaWatcherService.onMediaChange$
            .pipe(takeUntil(this._unsubscribeAll))
            .subscribe(({ matchingAliases }) => {
                this.drawerMode = matchingAliases.includes('lg') ? 'side' : 'over';
                this._cdr.markForCheck();
            });

        // shortcut Ctrl/Cmd + /
        fromEvent(this._document, 'keydown')
            .pipe(
                takeUntil(this._unsubscribeAll),
                filter<KeyboardEvent>((event) => (event.ctrlKey === true || event.metaKey === true) && event.key === '/')
            )
            .subscribe(() => this.openCompetitionDialog());
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
        this.dataSource.filterPredicate = (c: any, raw: string) => {
            let f: any = {};
            try { f = raw ? JSON.parse(raw) : {}; } catch { f = {}; }

            const q = (f.q || '').trim().toLowerCase();
            const sportId = f.sportId;
            const isActive = f.isActive;

            const passSport = sportId == null || Number(c?.sportId) === Number(sportId);
            const passActive = isActive == null || Boolean(c?.isActive) === Boolean(isActive);

            if (!passSport || !passActive) return false;

            if (!q) return true;

            const bag = [
                c?.name,
                this.getSportName(c?.sportId),
                String(c?.seasonId ?? ''),
                String(c?.id ?? ''),
                c?.isActive ? 'active' : 'inactive',
            ].filter(Boolean).join(' ').toLowerCase();

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
        this._cdr.markForCheck();
    }

    clearFilters(): void {
        this.searchInputControl.setValue('');
        this.filterSportId.setValue(null);
        this.filterActive.setValue(null);
    }

    openCompetitionDialog(comp?: Competition): void {
        const ref = this._dialog.open(CompetitionUpsertDialogComponent, {
            width: '900px',
            maxWidth: '95vw',
            panelClass: ['fuse-mat-dialog', 'rounded-2xl'],
            data: comp
                ? { mode: 'edit', competition: comp, sports: this.sports }
                : { mode: 'create', sports: this.sports },
            autoFocus: false,
        });

        ref.afterClosed()
            .pipe(
                takeUntil(this._unsubscribeAll),
                filter((res) => !!res?.ok)
            )
            .subscribe(() => {
                // List updates automatically via the _competitions BehaviorSubject
                this._cdr.markForCheck();
            });
    }

    getSportName(sportId: any): string {
        const n = Number(sportId);
        return this._sportById.get(n) ?? '-';
    }

    getSeasonName(seasonId: any): string {
        const n = Number(seasonId);
        return this._seasonById.get(n) ?? String(seasonId ?? '-');
    }
}
