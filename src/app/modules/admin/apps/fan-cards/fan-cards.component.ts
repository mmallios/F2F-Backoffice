import {
    ChangeDetectionStrategy,
    ChangeDetectorRef,
    Component,
    OnDestroy,
    OnInit,
    ViewChild,
    ViewEncapsulation,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, FormsModule, ReactiveFormsModule, UntypedFormControl } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { combineLatest, debounceTime, distinctUntilChanged, merge, Subject, takeUntil } from 'rxjs';
import {
    FanCardListItem,
    FanCardSeason,
    FanCardStats,
    FanCardsAdminService,
} from '@fuse/services/fan-cards/fan-cards-admin.service';
import { User, UsersService } from '@fuse/services/users/users.service';
import { FanCardDetailsDialogComponent } from './fan-card-details-dialog/fan-card-details-dialog.component';
import { FanCardEditDialogComponent, FanCardEditDialogData } from './fan-card-edit-dialog/fan-card-edit-dialog.component';

@Component({
    selector: 'fan-cards',
    templateUrl: './fan-cards.component.html',
    encapsulation: ViewEncapsulation.None,
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: true,
    imports: [
        CommonModule,
        FormsModule,
        ReactiveFormsModule,
        MatButtonModule,
        MatDialogModule,
        MatFormFieldModule,
        MatIconModule,
        MatInputModule,
        MatPaginatorModule,
        MatProgressBarModule,
        MatSelectModule,
        MatSortModule,
        MatTableModule,
        MatTooltipModule,
    ],
})
export class FanCardsComponent implements OnInit, OnDestroy {
    @ViewChild(MatPaginator) paginator!: MatPaginator;
    @ViewChild(MatSort) sort!: MatSort;

    loading = true;
    stats: FanCardStats | null = null;
    users: User[] = [];
    seasons: FanCardSeason[] = [];

    get selectedUser(): User | null {
        return this.users.find(u => u.id === this.filterOwner.value) ?? null;
    }

    displayedColumns = ['id', 'cardCode', 'owner', 'usageCount', 'reportsCount', 'lastUsedAt', 'lastUsageTeam', 'isActive', 'actions'];

    dataSource = new MatTableDataSource<FanCardListItem>([]);
    total = 0;
    pageSize = 20;
    currentPage = 1;

    searchCtrl = new UntypedFormControl('');
    filterOwner = new FormControl<number | null>(null);
    filterHasReports = new FormControl<string | null>(null);
    filterIsActive = new FormControl<string | null>(null);

    private _destroy$ = new Subject<void>();

    constructor(
        private _service: FanCardsAdminService,
        private _usersService: UsersService,
        private _dialog: MatDialog,
        private _cdr: ChangeDetectorRef,
    ) { }

    ngOnInit(): void {
        this._loadStats();
        this._loadCards();
        this._usersService.loadUsers().subscribe({
            next: (u) => { this.users = u; this._cdr.markForCheck(); },
        });
        this._service.getSeasons().subscribe({
            next: (s) => { this.seasons = s; this._cdr.markForCheck(); },
        });

        merge(
            this.searchCtrl.valueChanges.pipe(debounceTime(350), distinctUntilChanged()),
            this.filterOwner.valueChanges,
            this.filterHasReports.valueChanges,
            this.filterIsActive.valueChanges,
        ).pipe(takeUntil(this._destroy$))
            .subscribe(() => {
                this.currentPage = 1;
                this._loadCards();
            });
    }

    ngOnDestroy(): void {
        this._destroy$.next();
        this._destroy$.complete();
    }

    private _loadStats(): void {
        this._service.getStats().subscribe({
            next: (s) => {
                this.stats = s;
                this._cdr.markForCheck();
            },
        });
    }

    _loadCards(): void {
        this.loading = true;
        this._cdr.markForCheck();

        this._service
            .getCards(
                this.searchCtrl.value || undefined,
                this.currentPage,
                this.pageSize,
                undefined,
                undefined,
                this.filterHasReports.value != null ? this.filterHasReports.value === 'true' : undefined,
                undefined,
                this.filterOwner.value ?? undefined,
                this.filterIsActive.value != null ? this.filterIsActive.value === 'true' : undefined,
            )
            .subscribe({
                next: (res) => {
                    this.dataSource.data = res.items;
                    this.total = res.total;
                    this.loading = false;
                    this._cdr.markForCheck();
                },
                error: () => {
                    this.loading = false;
                    this._cdr.markForCheck();
                },
            });
    }

    onPage(event: { pageIndex: number; pageSize: number }): void {
        this.currentPage = event.pageIndex + 1;
        this.pageSize = event.pageSize;
        this._loadCards();
    }

    clearFilters(): void {
        this.searchCtrl.setValue('', { emitEvent: false });
        this.filterOwner.setValue(null, { emitEvent: false });
        this.filterHasReports.setValue(null, { emitEvent: false });
        this.filterIsActive.setValue(null, { emitEvent: false });
        this.currentPage = 1;
        this._loadCards();
    }

    openDetails(card: FanCardListItem): void {
        this._dialog.open(FanCardDetailsDialogComponent, {
            data: card,
            width: '1200px',
            maxWidth: '96vw',
            maxHeight: '92vh',
            panelClass: 'fan-card-details-dialog',
        });
    }

    openEdit(card: FanCardListItem): void {
        const ref = this._dialog.open(FanCardEditDialogComponent, {
            data: { card } as FanCardEditDialogData,
            width: '480px',
            maxWidth: '96vw',
        });
        ref.afterClosed().subscribe(result => {
            if (result?.saved) { this._loadCards(); }
        });
    }

    openCreate(): void {
        const ref = this._dialog.open(FanCardEditDialogComponent, {
            data: { card: null } as FanCardEditDialogData,
            width: '480px',
            maxWidth: '96vw',
        });
        ref.afterClosed().subscribe(result => {
            if (result?.saved) { this._loadCards(); }
        });
    }
}
