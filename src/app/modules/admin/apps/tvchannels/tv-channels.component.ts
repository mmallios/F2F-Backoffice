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
import { Subject, combineLatest, filter, fromEvent, takeUntil } from 'rxjs';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSelectModule } from '@angular/material/select';

import { TvChannel as TvChannelModel, EventsService } from '@fuse/services/events/events.service';
import { TVChannelUpsertDialogComponent } from './dialogs/tv-channel-upsert-dialog.component';
import { ClaimsService } from '@fuse/services/claims/claims.service';
import { BoPermissionDirective } from '@fuse/directives/permission/bo-permission.directive';


// Adjust if you already have interface in EventsService
export type TVChannel = TvChannelModel;

@Component({
    selector: 'tv-channels',
    templateUrl: './tv-channels.component.html',
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
export class TVChannelsComponent implements OnInit, OnDestroy {
    readonly claimsService = inject(ClaimsService);

    @ViewChild('matDrawer', { static: true }) matDrawer: MatDrawer;
    @ViewChild(MatPaginator) paginator: MatPaginator;
    @ViewChild(MatSort) sort: MatSort;

    loading = true;
    drawerMode: 'side' | 'over' = 'over';

    channelsCount = 0;
    filteredCount = 0;
    pageSize = 15;

    dataSource = new MatTableDataSource<TVChannel>([]);
    tableColumns: string[] = ['image', 'name', 'active', 'actions'];

    // filters
    searchInputControl = new UntypedFormControl('');
    filterActive = new UntypedFormControl(null);

    private _unsubscribeAll: Subject<any> = new Subject<any>();

    constructor(
        private _activatedRoute: ActivatedRoute,
        private _cdr: ChangeDetectorRef,
        private _eventsService: EventsService,
        @Inject(DOCUMENT) private _document: any,
        private _router: Router,
        private _fuseMediaWatcherService: FuseMediaWatcherService,
        private _dialog: MatDialog
    ) { }

    ngOnInit(): void {
        this.loading = true;

        // Initial load + subscribe to live updates via BehaviorSubject
        this._eventsService.getTVChannels()
            .pipe(takeUntil(this._unsubscribeAll))
            .subscribe();

        combineLatest([this._eventsService.tvChannels$])
            .pipe(takeUntil(this._unsubscribeAll))
            .subscribe({
                next: ([rows]) => {
                    const list: TVChannel[] = rows ?? [];

                    this.loading = false;
                    this.channelsCount = list.length;

                    this.dataSource = new MatTableDataSource<TVChannel>(list);
                    this.dataSource.paginator = this.paginator;
                    this.dataSource.sort = this.sort;

                    if (this.paginator) this.paginator.pageSize = this.pageSize;

                    this.dataSource.sortingDataAccessor = (item: any, property: string) => {
                        switch (property) {
                            case 'name': return (item?.name ?? '').toString().toLowerCase();
                            case 'active': return String(!!item?.isActive);
                            default: return (item[property] ?? '').toString().toLowerCase();
                        }
                    };

                    this.setupFilterPredicate();
                    this.applyCombinedFilter();

                    this._cdr.markForCheck();
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
            .subscribe(() => this.openTVChannelDialog());
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
        this.dataSource.filterPredicate = (ch: any, raw: string) => {
            let f: any = {};
            try { f = raw ? JSON.parse(raw) : {}; } catch { f = {}; }

            const q = (f.q || '').trim().toLowerCase();
            const isActive = f.isActive;

            const passActive = isActive == null || Boolean(ch?.isPublished) === Boolean(isActive);
            if (!passActive) return false;

            if (!q) return true;

            const bag = [
                ch?.name,
                ch?.code,
                String(ch?.id ?? ''),
                ch?.isPublished ? 'published' : 'unpublished',
            ].filter(Boolean).join(' ').toLowerCase();

            return bag.includes(q);
        };
    }

    applyCombinedFilter(): void {
        const payload = {
            q: (this.searchInputControl.value || '').toString(),
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
        this.filterActive.setValue(null);
    }

    hasAnyFilter(): boolean {
        return !!(this.searchInputControl.value || this.filterActive.value !== null);
    }

    openTVChannelDialog(channel?: TVChannel): void {
        const ref = this._dialog.open(TVChannelUpsertDialogComponent, {
            width: '900px',
            maxWidth: '95vw',
            panelClass: ['fuse-mat-dialog', 'rounded-2xl'],
            data: channel
                ? { mode: 'edit', tvChannel: channel }
                : { mode: 'create' },
            autoFocus: false,
        });

        ref.afterClosed()
            .pipe(
                takeUntil(this._unsubscribeAll),
                filter((res) => !!res?.ok)
            )
            .subscribe();
    }

}
