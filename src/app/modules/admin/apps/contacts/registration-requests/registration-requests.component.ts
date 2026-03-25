import { CommonModule } from '@angular/common';
import {
    AfterViewInit,
    ChangeDetectionStrategy,
    ChangeDetectorRef,
    Component,
    OnDestroy,
    OnInit,
    ViewChild,
    inject,
} from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTableModule, MatTableDataSource } from '@angular/material/table';
import { MatPaginatorModule, MatPaginator } from '@angular/material/paginator';
import { MatSortModule, MatSort } from '@angular/material/sort';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatTabsModule, MatTabGroup } from '@angular/material/tabs';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { TextFieldModule } from '@angular/cdk/text-field';

import { Subject, combineLatest, debounceTime, startWith, takeUntil } from 'rxjs';
import {
    RegistrationRequest,
    RegistrationStats,
    UsersService,
    User,
} from '@fuse/services/users/users.service';
import { AuthService } from 'app/core/auth/auth.service';
import { ClaimsService } from '@fuse/services/claims/claims.service';
import { BoPermissionDirective } from '@fuse/directives/permission/bo-permission.directive';

@Component({
    selector: 'registration-requests',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    styles: [`
        ::ng-deep registration-requests .mat-mdc-tab-header {
            background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
            border-radius: 12px 12px 0 0;
            padding: 0 8px;
        }
        ::ng-deep registration-requests .mat-mdc-tab .mdc-tab__text-label {
            color: rgba(255,255,255,0.6);
            font-weight: 600;
        }
        ::ng-deep registration-requests .mat-mdc-tab.mdc-tab--active .mdc-tab__text-label {
            color: #fff;
        }
        ::ng-deep registration-requests .mat-mdc-tab-indicator .mdc-tab-indicator__content--underline {
            border-color: #e11d48;
        }
        ::ng-deep registration-requests .mat-mdc-tab:not(.mdc-tab--active):hover .mdc-tab__text-label {
            color: rgba(255,255,255,0.85);
        }
    `],
    imports: [
        CommonModule,
        ReactiveFormsModule,
        MatButtonModule,
        MatIconModule,
        MatInputModule,
        MatFormFieldModule,
        MatProgressBarModule,
        MatTableModule,
        MatPaginatorModule,
        MatSortModule,
        MatSelectModule,
        MatTooltipModule,
        MatTabsModule,
        MatDatepickerModule,
        MatNativeDateModule,
        TextFieldModule,
        BoPermissionDirective,
    ],
    templateUrl: './registration-requests.component.html',
})
export class RegistrationRequestsComponent implements OnInit, AfterViewInit, OnDestroy {
    readonly claimsService = inject(ClaimsService);

    @ViewChild('pendingPaginator') paginator!: MatPaginator;
    @ViewChild('pendingSort') sort!: MatSort;
    @ViewChild('completedPaginator') completedPaginator!: MatPaginator;
    @ViewChild('completedSort') completedSort!: MatSort;
    @ViewChild('tabGroup') tabGroup!: MatTabGroup;

    loading = true;
    loadingCompleted = false;

    stats: RegistrationStats | null = null;

    dataSource = new MatTableDataSource<RegistrationRequest>([]);
    columns = ['name', 'createdOn', 'linkedUser', 'social', 'actions'];

    completedDataSource = new MatTableDataSource<RegistrationRequest>([]);
    completedColumns = ['name', 'createdOn', 'result', 'reviewedBy', 'reviewedAt', 'actions'];

    private readonly _dialToIso2: Record<string, string> = {
        '1': 'us', '7': 'ru', '20': 'eg', '27': 'za', '30': 'gr', '31': 'nl', '32': 'be', '33': 'fr',
        '34': 'es', '36': 'hu', '39': 'it', '40': 'ro', '41': 'ch', '43': 'at', '44': 'gb', '45': 'dk',
        '46': 'se', '47': 'no', '48': 'pl', '49': 'de', '51': 'pe', '52': 'mx', '54': 'ar', '55': 'br',
        '56': 'cl', '57': 'co', '58': 've', '60': 'my', '61': 'au', '62': 'id', '63': 'ph', '64': 'nz',
        '65': 'sg', '66': 'th', '81': 'jp', '82': 'kr', '84': 'vn', '86': 'cn', '90': 'tr', '91': 'in',
        '92': 'pk', '94': 'lk', '98': 'ir', '212': 'ma', '213': 'dz', '216': 'tn', '218': 'ly',
        '220': 'gm', '221': 'sn', '233': 'gh', '234': 'ng', '250': 'rw', '251': 'et', '254': 'ke',
        '255': 'tz', '256': 'ug', '263': 'zw', '297': 'aw', '350': 'gi', '351': 'pt', '352': 'lu',
        '353': 'ie', '354': 'is', '355': 'al', '356': 'mt', '357': 'cy', '358': 'fi', '359': 'bg',
        '370': 'lt', '371': 'lv', '372': 'ee', '373': 'md', '374': 'am', '375': 'by', '376': 'ad',
        '377': 'mc', '378': 'sm', '380': 'ua', '381': 'rs', '382': 'me', '385': 'hr', '386': 'si',
        '387': 'ba', '389': 'mk', '420': 'cz', '421': 'sk', '500': 'fk', '501': 'bz', '502': 'gt',
        '503': 'sv', '504': 'hn', '505': 'ni', '506': 'cr', '507': 'pa', '509': 'ht', '591': 'bo',
        '592': 'gy', '593': 'ec', '595': 'py', '597': 'sr', '598': 'uy', '670': 'tl', '673': 'bn',
        '675': 'pg', '679': 'fj', '686': 'ki', '691': 'fm', '850': 'kp', '852': 'hk', '853': 'mo',
        '855': 'kh', '856': 'la', '880': 'bd', '886': 'tw', '960': 'mv', '961': 'lb', '962': 'jo',
        '963': 'sy', '964': 'iq', '965': 'kw', '966': 'sa', '967': 'ye', '968': 'om', '971': 'ae',
        '972': 'il', '973': 'bh', '974': 'qa', '975': 'bt', '976': 'mn', '977': 'np', '992': 'tj',
        '993': 'tm', '994': 'az', '995': 'ge', '996': 'kg', '998': 'uz',
    };

    // Pending tab filters
    searchCtrl = new FormControl('', { nonNullable: true });
    fromDateCtrl = new FormControl<Date | null>(null);
    toDateCtrl = new FormControl<Date | null>(null);

    // Completed tab filters
    completedSearchCtrl = new FormControl('', { nonNullable: true });
    completedFromDateCtrl = new FormControl<Date | null>(null);
    completedToDateCtrl = new FormControl<Date | null>(null);
    adminFilterCtrl = new FormControl<number | null>(null);
    reviewerAdmins: { id: number; name: string }[] = [];

    private _pendingRaw: RegistrationRequest[] = [];
    private _completedRaw: RegistrationRequest[] = [];
    private _completedLoaded = false;
    private _pendingOpenId: number | null = null;

    // Modal state
    modalOpen = false;
    modalRequest: RegistrationRequest | null = null;
    rejectCommentCtrl = new FormControl('', { nonNullable: true });

    // Reject confirmation modal
    rejectModalOpen = false;

    // Success modal state
    successModalOpen = false;
    successCode: string | null = null;

    // All users for linking search
    allUsers: User[] = [];
    userSearchCtrl = new FormControl('', { nonNullable: true });
    filteredUsers: User[] = [];
    selectedLinkedUser: User | null = null;

    // Admin id from auth service
    get adminUserId(): number | null {
        return this._authService.currentUserId;
    }

    private _unsubscribeAll = new Subject<void>();

    constructor(
        private _usersService: UsersService,
        private _cdr: ChangeDetectorRef,
        private _authService: AuthService
    ) { }

    ngOnInit(): void {
        // Check if we were navigated here to open a specific completed request
        const navState = (typeof history !== 'undefined' && history.state) || {};
        if (navState['openRequestId']) {
            this._pendingOpenId = Number(navState['openRequestId']);
        }

        this.loadStats();
        this.loadRequests();

        // If we need to open a specific completed request, pre-load the completed tab
        if (this._pendingOpenId) {
            this.loadCompleted();
        }

        // Load all users for linking
        this._usersService.loadUsers().subscribe({
            next: (users) => { this.allUsers = users ?? []; this._cdr.markForCheck(); },
        });

        this._usersService.users$.pipe(takeUntil(this._unsubscribeAll)).subscribe((users) => {
            this.allUsers = users ?? [];
            this._cdr.markForCheck();
        });

        // User search for linking
        this.userSearchCtrl.valueChanges
            .pipe(debounceTime(200), takeUntil(this._unsubscribeAll))
            .subscribe((q) => {
                const term = (q || '').toLowerCase().trim();
                this.filteredUsers = term
                    ? this.allUsers
                        .filter((u) => `${u.firstname} ${u.lastname} ${u.code || ''}`.toLowerCase().includes(term))
                        .slice(0, 20)
                    : [];
                this._cdr.markForCheck();
            });

        // Pending filters
        combineLatest([
            this.searchCtrl.valueChanges.pipe(startWith('')),
            this.fromDateCtrl.valueChanges.pipe(startWith(null as Date | null)),
            this.toDateCtrl.valueChanges.pipe(startWith(null as Date | null)),
        ]).pipe(debounceTime(200), takeUntil(this._unsubscribeAll))
            .subscribe(() => this.applyPendingFilters());

        // Completed filters
        combineLatest([
            this.completedSearchCtrl.valueChanges.pipe(startWith('')),
            this.completedFromDateCtrl.valueChanges.pipe(startWith(null as Date | null)),
            this.completedToDateCtrl.valueChanges.pipe(startWith(null as Date | null)),
            this.adminFilterCtrl.valueChanges.pipe(startWith(null as number | null)),
        ]).pipe(debounceTime(200), takeUntil(this._unsubscribeAll))
            .subscribe(() => this.applyCompletedFilters());
    }

    ngAfterViewInit(): void {
        this.dataSource.paginator = this.paginator;
        this.dataSource.sort = this.sort;
        this.completedDataSource.paginator = this.completedPaginator;
        this.completedDataSource.sort = this.completedSort;
        this._cdr.detectChanges();
    }

    ngOnDestroy(): void {
        this._unsubscribeAll.next();
        this._unsubscribeAll.complete();
    }

    loadStats(): void {
        this._usersService.getRegistrationStats().subscribe({
            next: (s) => {
                this.stats = s;
                this._cdr.markForCheck();
            },
        });
    }

    loadRequests(): void {
        this.loading = true;
        this._cdr.markForCheck();
        this._usersService.getRegistrationRequests().subscribe({
            next: (list) => {
                this._pendingRaw = list ?? [];
                this.applyPendingFilters();
                this.loading = false;
                this._cdr.markForCheck();
            },
            error: () => {
                this.loading = false;
                this._cdr.markForCheck();
            },
        });
    }

    loadCompleted(): void {
        if (this._completedLoaded) return;
        this.loadingCompleted = true;
        this._cdr.markForCheck();
        this._usersService.getCompletedRequests().subscribe({
            next: (list) => {
                this._completedRaw = list ?? [];
                const seen = new Set<number>();
                this.reviewerAdmins = [];
                for (const r of this._completedRaw) {
                    if (r.reviewedByAdminId != null && !seen.has(r.reviewedByAdminId)) {
                        seen.add(r.reviewedByAdminId);
                        this.reviewerAdmins.push({
                            id: r.reviewedByAdminId,
                            name: r.reviewedByAdminName || `Admin #${r.reviewedByAdminId}`,
                        });
                    }
                }
                this.applyCompletedFilters();
                this._completedLoaded = true;
                this.loadingCompleted = false;
                this._cdr.markForCheck();

                // If navigated here to open a specific request, find and open it
                if (this._pendingOpenId) {
                    const target = this._completedRaw.find(r => r.id === this._pendingOpenId);
                    this._pendingOpenId = null;
                    if (target) {
                        setTimeout(() => {
                            if (this.tabGroup) this.tabGroup.selectedIndex = 1;
                            this.openModal(target);
                            this._cdr.markForCheck();
                        }, 50);
                    }
                }
            },
            error: () => { this.loadingCompleted = false; this._cdr.markForCheck(); },
        });
    }

    onTabChange(index: number): void {
        if (index === 1) this.loadCompleted();
    }

    applyPendingFilters(): void {
        const q = this.searchCtrl.value.toLowerCase().trim();
        const from = this.fromDateCtrl.value;
        const to = this.toDateCtrl.value;
        let filtered = this._pendingRaw;
        if (q) {
            filtered = filtered.filter((row) => {
                const bag = [row.firstname, row.lastname, row.email, row.mobile, row.code].filter(Boolean).join(' ').toLowerCase();
                return bag.includes(q);
            });
        }
        if (from || to) {
            filtered = filtered.filter((row) => {
                const d = new Date(row.createdOn);
                if (from && d < from) return false;
                if (to) { const e = new Date(to); e.setHours(23, 59, 59, 999); if (d > e) return false; }
                return true;
            });
        }
        this.dataSource.data = filtered;
        this._cdr.markForCheck();
    }

    applyCompletedFilters(): void {
        const q = this.completedSearchCtrl.value.toLowerCase().trim();
        const from = this.completedFromDateCtrl.value;
        const to = this.completedToDateCtrl.value;
        const adminId = this.adminFilterCtrl.value;
        let filtered = this._completedRaw;
        if (q) {
            filtered = filtered.filter((row) => {
                const bag = [row.firstname, row.lastname, row.email, row.mobile, row.code, row.reviewedByAdminName].filter(Boolean).join(' ').toLowerCase();
                return bag.includes(q);
            });
        }
        if (from || to) {
            filtered = filtered.filter((row) => {
                const d = new Date(row.createdOn);
                if (from && d < from) return false;
                if (to) { const e = new Date(to); e.setHours(23, 59, 59, 999); if (d > e) return false; }
                return true;
            });
        }
        if (adminId != null) {
            filtered = filtered.filter((row) => row.reviewedByAdminId === adminId);
        }
        this.completedDataSource.data = filtered;
        this._cdr.markForCheck();
    }

    openModal(req: RegistrationRequest): void {
        this.modalRequest = req;
        this.selectedLinkedUser = null;
        this.userSearchCtrl.setValue('');
        this.rejectCommentCtrl.setValue('');
        this.filteredUsers = [];
        this.rejectModalOpen = false;
        this.modalOpen = true;
        this._cdr.markForCheck();
    }

    closeModal(): void {
        this.modalOpen = false;
        this.rejectModalOpen = false;
        this.modalRequest = null;
        this.selectedLinkedUser = null;
        this.rejectCommentCtrl.setValue('');
        this._cdr.markForCheck();
    }

    closeSuccessModal(): void {
        this.successModalOpen = false;
        this.successCode = null;
        this.closeModal();
    }

    selectLinkedUser(u: User): void {
        this.selectedLinkedUser = u;
        this.userSearchCtrl.setValue(`${u.firstname} ${u.lastname}`);
        this.filteredUsers = [];
        this._cdr.markForCheck();
    }

    clearLinkedUser(): void {
        this.selectedLinkedUser = null;
        this.userSearchCtrl.setValue('');
        this.filteredUsers = [];
        this._cdr.markForCheck();
    }

    accept(): void {
        if (!this.modalRequest) return;
        this._usersService
            .acceptRegistrationRequest(
                this.modalRequest.id,
                this.adminUserId,
                this.selectedLinkedUser?.id ?? null
            )
            .subscribe({
                next: (res: any) => {
                    this.successCode = res?.code ?? null;
                    this.successModalOpen = true;
                    this.loadStats();
                    this._completedLoaded = false;
                    this.loadRequests();
                    this._cdr.markForCheck();
                },
            });
    }

    reject(): void {
        if (!this.modalRequest) return;
        this._usersService
            .rejectRegistrationRequest(this.modalRequest.id, this.adminUserId, this.rejectCommentCtrl.value || null)
            .subscribe({
                next: () => {
                    this.rejectModalOpen = false;
                    this.closeModal();
                    this.loadStats();
                    this._completedLoaded = false;
                    this.loadRequests();
                },
            });
    }

    openRejectModal(): void {
        this.rejectCommentCtrl.setValue('');
        this.rejectModalOpen = true;
        this._cdr.markForCheck();
    }

    closeRejectModal(): void {
        this.rejectModalOpen = false;
        this._cdr.markForCheck();
    }

    socialUrl(req: RegistrationRequest): string | null {
        if (!req.socialMediaAccount) return null;
        const acc = req.socialMediaAccount.trim().replace(/^@/, '');
        if (req.socialMediaPlatform === 1) return `https://facebook.com/${acc}`;
        if (req.socialMediaPlatform === 2) return `https://instagram.com/${acc}`;
        return null;
    }

    socialLabel(platform?: number | null): string {
        if (platform === 1) return 'Facebook';
        if (platform === 2) return 'Instagram';
        return 'Social Media';
    }

    flagUrl(dialCode?: string | number | null): string {
        if (dialCode == null || dialCode === '') return '';
        const iso2 = this._dialToIso2[String(dialCode).replace(/\D/g, '')];
        return iso2 ? `https://flagcdn.com/w20/${iso2}.png` : '';
    }
}
