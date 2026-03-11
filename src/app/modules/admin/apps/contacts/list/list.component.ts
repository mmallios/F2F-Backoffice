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
import { User, UsersService } from '@fuse/services/users/users.service';
import { Subject, combineLatest, filter, fromEvent, takeUntil } from 'rxjs';
import { UserUpsertDialogComponent } from '../dialog/user-upsert-dialog.component';
import { MatTooltipModule } from '@angular/material/tooltip';
import { StaticData, StaticDataService } from '@fuse/services/staticdata/static-data.service';
import { MatSelectModule, MatSelectTrigger } from '@angular/material/select';

@Component({
    selector: 'users-list',
    templateUrl: './list.component.html',
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
        MatSelectTrigger
    ],
})
export class UsersListComponent implements OnInit, OnDestroy {
    @ViewChild('matDrawer', { static: true }) matDrawer: MatDrawer;

    @ViewChild(MatPaginator) paginator: MatPaginator;
    @ViewChild(MatSort) sort: MatSort;

    usersCount = 0;
    filteredCount = 0;
    pageSize = 15;

    loading = true;

    // dropdown options
    countries: StaticData[] = [];
    regions: StaticData[] = [];

    // filters
    filterCountryId = new UntypedFormControl(null);
    filterRegionId = new UntypedFormControl(null);
    filterStatus = new UntypedFormControl(null);

    // keep raw users (so we can re-apply filters cleanly)
    private _allUsers: User[] = [];

    get userStats() {
        const all = this._allUsers;
        return {
            total: all.length,
            pending: all.filter(u => u.status === 0).length,
            active: all.filter(u => u.status === 2).length,
            banned: all.filter(u => u.status === 7 || u.status === 5 || u.status === 6).length,
        };
    }


    usersTableColumns: string[] = ['name', 'email', 'mobile', 'country', 'region', 'points', 'status', 'actions'];

    drawerMode: 'side' | 'over' = 'over';
    searchInputControl: UntypedFormControl = new UntypedFormControl();

    selectedUser: User | null = null;

    dataSource = new MatTableDataSource<User>([]);

    // lookups
    private _countryById = new Map<string, { name: string; extraData?: string; image?: string }>();
    private _regionById = new Map<string, { name: string }>();

    private _unsubscribeAll: Subject<any> = new Subject<any>();

    constructor(
        private _activatedRoute: ActivatedRoute,
        private _changeDetectorRef: ChangeDetectorRef,
        private _usersService: UsersService,
        private _staticDataService: StaticDataService,
        @Inject(DOCUMENT) private _document: any,
        private _router: Router,
        private _fuseMediaWatcherService: FuseMediaWatcherService,
        private _dialog: MatDialog
    ) { }

    ngOnInit(): void {
        this.loading = true;

        // 1) kick off loads
        this._usersService.loadUsers().subscribe({
            error: () => {
                this.loading = false;
                this._changeDetectorRef.markForCheck();
            },
        });

        // IMPORTANT: make sure staticData$ has data
        this._staticDataService.loadAll()
            .pipe(takeUntil(this._unsubscribeAll))
            .subscribe((all) => {
                const items = all ?? [];

                this.countries = items.filter(x => (x.domain || '').trim().toLowerCase() === 'country');
                this.regions = items.filter(x => (x.domain || '').trim().toLowerCase() === 'region');

                this._changeDetectorRef.markForCheck();
            });


        // 2) streams from staticData$
        const countries$ = this._staticDataService.getByDomain('country');
        const regions$ = this._staticDataService.getByDomain('region');


        // 3) combine
        combineLatest([this._usersService.users$, countries$, regions$])
            .pipe(takeUntil(this._unsubscribeAll))
            .subscribe(([users, countries, regions]) => {

                this._allUsers = users ?? [];


                this._changeDetectorRef.detectChanges();


                // inside combineLatest subscribe:
                this._countryById.clear();
                (countries ?? []).forEach((c: StaticData) => {
                    this._countryById.set(String(c.id), {
                        name: c.name ?? '-',
                        extraData: c.extraData,
                        image: c.image,
                    });
                });


                this._regionById.clear();
                (regions ?? []).forEach((r: any) => {
                    this._regionById.set(String(r.id), {
                        name: r.name ?? r.label ?? r.code ?? '-',
                    });
                });

                // table
                this.loading = false;
                this.usersCount = users?.length ?? 0;

                this.dataSource = new MatTableDataSource<User>(users ?? []);
                this.dataSource.paginator = this.paginator;
                this.dataSource.sort = this.sort;

                if (this.paginator) this.paginator.pageSize = this.pageSize;

                // sort by lookup label
                this.dataSource.sortingDataAccessor = (item: any, property: string) => {
                    switch (property) {
                        case 'country': return this.getCountryName(item).toLowerCase();
                        case 'region': return this.getRegionName(item).toLowerCase();
                        case 'name': return `${item.firstname || ''} ${item.lastname || ''}`.toLowerCase();
                        default: return (item[property] ?? '').toString().toLowerCase();
                    }
                };


                this.dataSource.filterPredicate = (u: any, raw: string) => {
                    // raw is a JSON string we set in applyCombinedFilter()
                    let f: any = {};
                    try { f = raw ? JSON.parse(raw) : {}; } catch { f = {}; }

                    const q = (f.q || '').trim().toLowerCase();
                    const countryId = f.countryId;
                    const regionId = f.regionId;
                    const status = f.status;

                    // dropdown filters
                    const passCountry = countryId == null || String(this.resolveCountryKey(u)) === String(countryId);
                    const passRegion = regionId == null || String(this.resolveRegionKey(u)) === String(regionId);
                    const passStatus = status == null || Number(u?.status) === Number(status);

                    if (!passCountry || !passRegion || !passStatus) return false;

                    // search bag
                    if (!q) return true;

                    const bag = [
                        u?.firstname,
                        u?.lastname,
                        u?.email,
                        u?.mobile,
                        u?.code,
                        this.getCountryName(u),
                        this.getRegionName(u),
                        String(u?.points ?? ''),
                        this.getStatusLabel(u?.status),
                    ]
                        .filter(Boolean)
                        .join(' ')
                        .toLowerCase();

                    return bag.includes(q);
                };


                this.applyCombinedFilter();

                this._changeDetectorRef.markForCheck();
            });

        // selected user (drawer)
        this._usersService.user$
            .pipe(takeUntil(this._unsubscribeAll))
            .subscribe((user: User | null) => {
                this.selectedUser = user;
                this._changeDetectorRef.markForCheck();
            });

        // Search input -> filter
        this.searchInputControl.valueChanges
            .pipe(takeUntil(this._unsubscribeAll))
            .subscribe(() => this.applyCombinedFilter());

        this.filterCountryId.valueChanges
            .pipe(takeUntil(this._unsubscribeAll))
            .subscribe(() => this.applyCombinedFilter());

        this.filterRegionId.valueChanges
            .pipe(takeUntil(this._unsubscribeAll))
            .subscribe(() => this.applyCombinedFilter());

        this.filterStatus.valueChanges
            .pipe(takeUntil(this._unsubscribeAll))
            .subscribe(() => this.applyCombinedFilter());


        // Drawer open/close
        this.matDrawer.openedChange.pipe(takeUntil(this._unsubscribeAll)).subscribe((opened) => {
            if (!opened) {
                this.selectedUser = null;
                this._changeDetectorRef.markForCheck();
            }
        });

        // Responsive drawer mode
        this._fuseMediaWatcherService.onMediaChange$
            .pipe(takeUntil(this._unsubscribeAll))
            .subscribe(({ matchingAliases }) => {
                this.drawerMode = matchingAliases.includes('lg') ? 'side' : 'over';
                this._changeDetectorRef.markForCheck();
            });

        // Keyboard shortcut: Ctrl/Cmd + /
        fromEvent(this._document, 'keydown')
            .pipe(
                takeUntil(this._unsubscribeAll),
                filter<KeyboardEvent>(
                    (event) => (event.ctrlKey === true || event.metaKey === true) && event.key === '/'
                )
            )
            .subscribe(() => this.openUserDialog());
    }

    ngOnDestroy(): void {
        this._unsubscribeAll.next(null);
        this._unsubscribeAll.complete();
    }

    onBackdropClicked(): void {
        this._router.navigate(['./'], { relativeTo: this._activatedRoute });
        this._changeDetectorRef.markForCheck();
    }

    applyCombinedFilter(): void {
        const payload = {
            q: (this.searchInputControl.value || '').toString(),
            countryId: this.filterCountryId.value,
            regionId: this.filterRegionId.value,
            status: this.filterStatus.value,
        };

        this.dataSource.filter = JSON.stringify(payload);

        if (this.dataSource.paginator) {
            this.dataSource.paginator.firstPage();
        }

        this.filteredCount = this.dataSource.filteredData?.length ?? 0;
        this._changeDetectorRef.markForCheck();
    }


    private applyFilter(query: string): void {
        const q = (query || '').toString();
        this.dataSource.filter = q.trim().toLowerCase();

        if (this.dataSource.paginator) {
            this.dataSource.paginator.firstPage();
        }

        this.filteredCount = this.dataSource.filteredData?.length ?? 0;
        this._changeDetectorRef.markForCheck();
    }

    openUserDialog(user?: User): void {
        const ref = this._dialog.open(UserUpsertDialogComponent, {
            width: '900px',
            maxWidth: '95vw',
            panelClass: ['fuse-mat-dialog', 'rounded-2xl'],
            data: user ? { mode: 'edit', user } : { mode: 'create' },
            autoFocus: false,
        });

        ref.afterClosed()
            .pipe(
                takeUntil(this._unsubscribeAll),
                filter((res) => !!res)
            )
            .subscribe(() => {
                this.loading = true;
                this._usersService.loadUsers().subscribe({
                    error: () => (this.loading = false),
                    complete: () => {
                        this.loading = false;
                        this._changeDetectorRef.markForCheck();
                    },
                });
            });
    }

    // ---- Status helpers ----
    getStatusLabel(status: number | null | undefined): string {
        switch (status) {
            case 0: return 'Pending';
            case 1: return 'Semi-active';
            case 2: return 'Active';
            case 3: return 'Inactive';
            case 5: return 'Rejected';
            case 6: return 'Deleted';
            case 7: return 'Banned';
            case 8: return 'Locked';
            case 9: return 'Archived';
            default: return 'Unknown';
        }
    }

    getStatusChipClass(status: number | null | undefined): any {
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

    getCountryName(userOrKey?: any): string {
        const key = typeof userOrKey === 'object' ? this.resolveCountryKey(userOrKey) : (userOrKey == null ? null : String(userOrKey).trim());
        if (!key) return '-';
        return this._countryById.get(key)?.name ?? '-';
    }

    getRegionName(userOrKey?: any): string {
        const key = typeof userOrKey === 'object' ? this.resolveRegionKey(userOrKey) : (userOrKey == null ? null : String(userOrKey).trim());
        if (!key) return '-';
        return this._regionById.get(key)?.name ?? '-';
    }

    getCountryFlagUrl(userOrKey?: any): string {
        const key =
            typeof userOrKey === 'object'
                ? this.resolveCountryKey(userOrKey)
                : (userOrKey == null ? null : String(userOrKey).trim());

        if (!key) return '';

        const country = this._countryById.get(key);
        if (!country) return '';

        const iso2 = this.getIso2FromExtra(country.extraData);
        if (!iso2) return '';

        return `https://flagcdn.com/w40/${iso2}.png`;
    }


    onFlagError(ev: Event): void {
        const img = ev.target as HTMLImageElement;
        img.src = 'data:image/gif;base64,R0lGODlhAQABAAAAACwAAAAAAQABAAA=';
    }

    private resolveCountryKey(u: any): string | null {
        const v = u?.countryId ?? u?.country;
        if (v === null || v === undefined || v === '') return null;
        return String(v).trim();
    }


    private resolveRegionKey(u: any): string | null {
        const v = u?.regionId ?? u?.region;
        if (v === null || v === undefined || v === '') return null;
        return String(v).trim();
    }

    private getIso2FromExtra(extraData?: string | null): string | null {
        if (!extraData) return null;

        const raw = extraData.trim();

        // Case A: stored directly as "gr"
        if (/^[a-zA-Z]{2}$/.test(raw)) return raw.toLowerCase();

        // Case B: JSON like {"iso2":"gr"} or {"Iso2":"GR"}
        if (raw.startsWith('{')) {
            try {
                const obj: any = JSON.parse(raw);
                const v = (obj?.iso2 ?? obj?.ISO2 ?? obj?.Iso2 ?? obj?.countryCode ?? obj?.code) as any;
                const s = (v ?? '').toString().trim();
                if (/^[a-zA-Z]{2}$/.test(s)) return s.toLowerCase();
            } catch {
                // ignore
            }
        }

        return null;
    }

    clearFilters(): void {
        this.searchInputControl.setValue('');
        this.filterCountryId.setValue(null);
        this.filterRegionId.setValue(null);
        this.filterStatus.setValue(null);
    }

    getCountryLabel(): string {
        if (this.filterCountryId.value == null) return 'Όλες';
        return this.countries.find(c => c.id === this.filterCountryId.value)?.name ?? 'Όλες';
    }




}
