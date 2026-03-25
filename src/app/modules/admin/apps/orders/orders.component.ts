import { AsyncPipe, CommonModule, DOCUMENT, I18nPluralPipe, NgClass } from '@angular/common';
import {
    AfterViewInit,
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
import { FormControl, FormsModule, ReactiveFormsModule, UntypedFormControl } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatDrawer, MatSidenavModule } from '@angular/material/sidenav';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatChipsModule } from '@angular/material/chips';
import { Router, RouterLink, RouterOutlet } from '@angular/router';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSelectModule } from '@angular/material/select';
import { FuseMediaWatcherService } from '@fuse/services/media-watcher';
import { Subject, filter, fromEvent, takeUntil } from 'rxjs';
import { Order, StoreService } from '@fuse/services/store/store.service';
import { ClaimsService } from '@fuse/services/claims/claims.service';
import { BoPermissionDirective } from '@fuse/directives/permission/bo-permission.directive';

type UserOptionVm = { id: number; fullname: string; image?: string | null };

@Component({
    selector: 'orders-list',
    templateUrl: './orders.component.html',
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
        MatSelectModule,
        BoPermissionDirective,
    ],
})
export class OrdersListComponent implements OnInit, AfterViewInit, OnDestroy {
    readonly claimsService = inject(ClaimsService);

    @ViewChild('matDrawer', { static: true }) matDrawer!: MatDrawer;
    @ViewChild(MatPaginator) paginator?: MatPaginator;
    @ViewChild(MatSort) sort?: MatSort;

    drawerMode: 'side' | 'over' = 'over';
    loading = true;

    ordersCount = 0;
    filteredCount = 0;

    // filters
    searchInputControl = new UntypedFormControl('');
    filterStatus = new FormControl<number | null>(null);
    filterPayment = new FormControl<number | null>(null);
    filterUser = new FormControl<number | null>(null);

    // user dropdown options built from returned orders
    usersOptions: UserOptionVm[] = [];

    // ✅ include user column
    ordersTableColumns: string[] = ['code', 'user', 'submittedAt', 'totalAmount', 'status', 'actions'];

    // ✅ one datasource only
    dataSource = new MatTableDataSource<Order>([]);

    private _unsubscribeAll = new Subject<void>();

    constructor(
        private _api: StoreService,
        private _cdr: ChangeDetectorRef,
        private _fuseMediaWatcher: FuseMediaWatcherService,
        private _router: Router,
        @Inject(DOCUMENT) private _document: any
    ) { }

    ngOnInit(): void {
        // ✅ one predicate (supports user filter + user search)
        this.dataSource.filterPredicate = (o: any, raw: string) => {
            let f: any = {};
            try {
                f = raw ? JSON.parse(raw) : {};
            } catch {
                f = {};
            }

            const q = (f.q || '').trim().toLowerCase();
            const status = f.status;
            const payment = f.payment;
            const userId = f.userId;

            const passStatus = status == null || Number(o.status) === Number(status);
            const passPayment = payment == null || Number(o.paymentMethod ?? -1) === Number(payment);

            const oUserId = o?.userId ?? o?.user?.id ?? o?.user?.Id ?? o?.user?.userId ?? null;
            const passUser = userId == null || Number(oUserId) === Number(userId);

            if (!passStatus || !passPayment || !passUser) return false;
            if (!q) return true;

            const userName =
                o?.userFullname ??
                o?.user?.fullname ??
                o?.user?.fullName ??
                o?.user?.Fullname ??
                (((o?.user?.firstname || o?.user?.Firstname)
                    ? (o?.user?.firstname || o?.user?.Firstname) +
                    ' ' +
                    (o?.user?.lastname || o?.user?.Lastname || '')
                    : ''));

            const bag = [o.code, String(o.id), userName].filter(Boolean).join(' ').toLowerCase();
            return bag.includes(q);
        };

        // fetch
        this.getOrders();

        // filters subscriptions
        this.searchInputControl.valueChanges
            .pipe(takeUntil(this._unsubscribeAll))
            .subscribe(() => this.applyCombinedFilter());

        this.filterStatus.valueChanges
            .pipe(takeUntil(this._unsubscribeAll))
            .subscribe(() => this.applyCombinedFilter());

        this.filterPayment.valueChanges
            .pipe(takeUntil(this._unsubscribeAll))
            .subscribe(() => this.applyCombinedFilter());

        this.filterUser.valueChanges
            .pipe(takeUntil(this._unsubscribeAll))
            .subscribe(() => this.applyCombinedFilter());

        // media watcher
        this._fuseMediaWatcher.onMediaChange$
            .pipe(takeUntil(this._unsubscribeAll))
            .subscribe(({ matchingAliases }) => {
                this.drawerMode = matchingAliases.includes('lg') ? 'side' : 'over';
                this._cdr.markForCheck();
            });

        fromEvent(this._document, 'keydown')
            .pipe(
                takeUntil(this._unsubscribeAll),
                filter<KeyboardEvent>((e) => (e.ctrlKey || e.metaKey) && e.key === '/')
            )
            .subscribe(() => this.searchInputControl.setValue(''));
    }

    ngAfterViewInit(): void {
        if (this.paginator) this.dataSource.paginator = this.paginator;
        if (this.sort) this.dataSource.sort = this.sort;
        this._cdr.markForCheck();
    }

    ngOnDestroy(): void {
        this._unsubscribeAll.next();
        this._unsubscribeAll.complete();
    }

    reload(): void {
        this.getOrders();
    }

    openNewOrderDialog(): void {
        this._router.navigate(['/apps/orders/new']);
    }

    getOrders(): void {
        this.loading = true;
        this._cdr.markForCheck();

        this._api.getOrders().subscribe({
            next: (orders) => {
                const data = (orders ?? []) as any[];

                this.ordersCount = data.length;
                this.dataSource.data = data;

                if (this.paginator) this.dataSource.paginator = this.paginator;
                if (this.sort) this.dataSource.sort = this.sort;

                // build usersOptions from returned orders (unique by id)
                const map = new Map<number, UserOptionVm>();

                for (const o of data) {
                    const id = o?.userId ?? o?.user?.id ?? o?.user?.Id;
                    if (id == null) continue;

                    const fullname =
                        o?.userFullname ??
                        o?.user?.fullname ??
                        o?.user?.fullName ??
                        o?.user?.Fullname ??
                        (((o?.user?.firstname || o?.user?.Firstname)
                            ? (o?.user?.firstname || o?.user?.Firstname) +
                            ' ' +
                            (o?.user?.lastname || o?.user?.Lastname || '')
                            : null));

                    const image = o?.userImage ?? o?.user?.image ?? o?.user?.Image ?? null;

                    const key = Number(id);
                    if (!map.has(key)) {
                        map.set(key, { id: key, fullname: fullname || `User #${key}`, image });
                    }
                }

                this.usersOptions = Array.from(map.values()).sort((a, b) => a.fullname.localeCompare(b.fullname));

                // if selected user no longer exists in list, reset
                if (this.filterUser.value != null && !map.has(Number(this.filterUser.value))) {
                    this.filterUser.setValue(null, { emitEvent: false });
                }

                this.applyCombinedFilter();
            },
            error: (err) => {
                console.error('getOrders failed', err);
                this.loading = false;
                this._cdr.markForCheck();
            },
            complete: () => {
                this.loading = false;
                this._cdr.markForCheck();
            },
        });
    }

    applyCombinedFilter(): void {
        const payload = {
            q: (this.searchInputControl.value || '').toString(),
            status: this.filterStatus.value,
            payment: this.filterPayment.value,
            userId: this.filterUser.value,
        };

        this.dataSource.filter = JSON.stringify(payload);

        if (this.dataSource.paginator) this.dataSource.paginator.firstPage();
        this.filteredCount = this.dataSource.filteredData?.length ?? 0;

        this._cdr.markForCheck();
    }

    clearFilters(): void {
        this.searchInputControl.setValue('');
        this.filterStatus.setValue(null);
        this.filterPayment.setValue(null);
        this.filterUser.setValue(null);
    }

    getStatusLabel(status: number | null | undefined): string {
        switch (status) {
            case 0:
                return 'Σε εκκρεμότητα';
            case 1:
                return 'Υποβλήθηκε';
            case 2:
                return 'Πληρώθηκε';
            case 3:
                return 'Απεστάλη';
            case 4:
                return 'Ολοκληρώθηκε';
            case 5:
                return 'Ακυρώθηκε';
            default:
                return 'Άγνωστη κατάσταση';
        }
    }

    getStatusChipClass(status: number | null | undefined): any {
        switch (status) {
            case 2:
            case 4:
                return 'bg-green-100 text-green-800 dark:bg-green-500/10 dark:text-green-300';
            case 0:
            case 1:
                return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-500/10 dark:text-yellow-300';
            case 5:
                return 'bg-red-100 text-red-800 dark:bg-red-500/10 dark:text-red-300';
            default:
                return 'bg-indigo-100 text-indigo-800 dark:bg-indigo-500/10 dark:text-indigo-300';
        }
    }
}