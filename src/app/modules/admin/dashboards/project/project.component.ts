import { AsyncPipe, CurrencyPipe, NgClass, NgIf } from '@angular/common';
import {
    ChangeDetectionStrategy,
    ChangeDetectorRef,
    Component,
    OnDestroy,
    OnInit,
    ViewEncapsulation,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTableModule } from '@angular/material/table';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Router } from '@angular/router';
import { TranslocoModule } from '@ngneat/transloco';
import { BOAnnouncementsService } from '@fuse/services/announcements/bo-announcements.service';
import { AppStatsService } from '@fuse/services/app-stats/app-stats.service';
import { AdminRowDto, RolesService } from '@fuse/services/roles/roles.service';
import { SupportStatsResponse, SupportTicketsAdminService } from '@fuse/services/support/support-tickets-admin.service';
import { AuthService } from 'app/core/auth/auth.service';
import { UserService } from 'app/core/user/user.service';
import { NotificationsService } from 'app/layout/common/notifications/notifications.service';
import { ChatService } from 'app/modules/admin/apps/chat/chat.service';
import { ProjectService } from 'app/modules/admin/dashboards/project/project.service';
import { ApexOptions, NgApexchartsModule } from 'ng-apexcharts';
import { Subject, catchError, forkJoin, of, takeUntil } from 'rxjs';

@Component({
    selector: 'project',
    templateUrl: './project.component.html',
    encapsulation: ViewEncapsulation.None,
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: true,
    imports: [
        TranslocoModule,
        MatIconModule,
        MatButtonModule,
        MatMenuModule,
        MatTabsModule,
        MatButtonToggleModule,
        MatProgressSpinnerModule,
        MatTooltipModule,
        NgApexchartsModule,
        MatTableModule,
        NgClass,
        NgIf,
        CurrencyPipe,
        AsyncPipe,
    ],
})
export class ProjectComponent implements OnInit, OnDestroy {
    chartTaskDistribution: ApexOptions = {};
    chartBudgetDistribution: ApexOptions = {};
    chartWeeklyExpenses: ApexOptions = {};
    chartMonthlyExpenses: ApexOptions = {};
    chartYearlyExpenses: ApexOptions = {};
    data: any;
    unreadCount: number = 0;

    // Home stats
    announcementTotal = 0;
    announcementToday = 0;
    hqMessagesTotal = 0;
    hqMessagesToday = 0;
    ticketsToday = 0;
    ticketsTodayMine = 0;
    regPending = 0;
    regToday = 0;
    ticketStats: SupportStatsResponse | null = null;
    statsLoading = false;

    // Team
    admins: AdminRowDto[] = [];
    adminsLoading = false;

    private _unsubscribeAll: Subject<any> = new Subject<any>();

    /**
     * Constructor
     */
    constructor(
        private _changeDetectorRef: ChangeDetectorRef,
        private _projectService: ProjectService,
        private _router: Router,
        public userService: UserService,
        private _notificationsService: NotificationsService,
        private _authService: AuthService,
        private _boAnnouncementsService: BOAnnouncementsService,
        private _chatService: ChatService,
        private _supportTicketsService: SupportTicketsAdminService,
        private _appStatsService: AppStatsService,
        private _rolesService: RolesService,
    ) { }

    // -----------------------------------------------------------------------------------------------------
    // @ Lifecycle hooks
    // -----------------------------------------------------------------------------------------------------

    /**
     * On init
     */
    ngOnInit(): void {
        this._projectService.data$
            .pipe(takeUntil(this._unsubscribeAll))
            .subscribe((data) => {
                this.data = data;
                this._prepareChartData();
            });

        this._notificationsService.notifications$
            .pipe(takeUntil(this._unsubscribeAll))
            .subscribe((notifications) => {
                this.unreadCount = notifications.filter((n) => !n.read).length;
            });

        window['Apex'] = {
            chart: {
                events: {
                    mounted: (chart: any): void => {
                        this._fixSvgFill(chart.el);
                    },
                    updated: (chart: any): void => {
                        this._fixSvgFill(chart.el);
                    },
                },
            },
        };

        this._loadHomeStats();
        this._loadTeamAdmins();
    }

    /**
     * On destroy
     */
    ngOnDestroy(): void {
        this._unsubscribeAll.next(null);
        this._unsubscribeAll.complete();
    }

    // -----------------------------------------------------------------------------------------------------
    // @ Public methods
    // -----------------------------------------------------------------------------------------------------

    /**
     * Track by function for ngFor loops
     */
    trackByFn(index: number, item: any): any {
        return item.id || index;
    }

    /**
     * Open or create a BO private chat with another admin
     */
    openChatWith(boUserId: number): void {
        this._chatService.openOrCreateChat(boUserId).subscribe((res) => {
            this._chatService.requestOpenQuickChat(res.id);
        });
    }

    // -----------------------------------------------------------------------------------------------------
    // @ Private methods
    // -----------------------------------------------------------------------------------------------------

    private _isToday(dateStr: string): boolean {
        if (!dateStr) return false;
        const d = new Date(dateStr);
        const now = new Date();
        return (
            d.getFullYear() === now.getFullYear() &&
            d.getMonth() === now.getMonth() &&
            d.getDate() === now.getDate()
        );
    }

    private _loadHomeStats(): void {
        this.statsLoading = true;
        const boUserId = this._authService.currentUser?.id ?? 0;
        const myBoUserId = this._authService.currentUser?.boUserId ?? boUserId;
        const today = new Date().toISOString().split('T')[0];

        forkJoin({
            announcements: this._boAnnouncementsService
                .getAll(boUserId)
                .pipe(catchError(() => of([]))),
            chats: this._chatService.loadAll().pipe(catchError(() => of([]))),
            ticketsTotal: this._supportTicketsService
                .list({ from: today, to: today, pageSize: 1 })
                .pipe(catchError(() => of({ items: [], total: 0 }))),
            ticketsMine: this._supportTicketsService
                .list({ from: today, to: today, assigneeAdminId: myBoUserId, pageSize: 1 })
                .pipe(catchError(() => of({ items: [], total: 0 }))),
            appStats: this._appStatsService.getOverview().pipe(catchError(() => of(null))),
            ticketStats: this._supportTicketsService.getStats().pipe(catchError(() => of(null))),
        }).subscribe((res) => {
            this.announcementTotal = res.announcements.filter((x: any) => !x.isRead).length;
            this.announcementToday = res.announcements.filter(
                (x: any) => !x.isRead && this._isToday(x.createdOn)
            ).length;

            this.hqMessagesTotal = (res.chats as any[]).reduce(
                (sum: number, c: any) => sum + (c.unreadCount ?? 0),
                0
            );
            this.hqMessagesToday = (res.chats as any[])
                .filter((c: any) => c.lastMessageAt && this._isToday(c.lastMessageAt))
                .reduce((sum: number, c: any) => sum + (c.unreadCount ?? 0), 0);

            this.ticketsToday = res.ticketsTotal.total;
            this.ticketsTodayMine = res.ticketsMine.total;
            this.regPending = res.appStats?.pendingRegistrations ?? 0;
            this.regToday = res.appStats?.newRegistrationsToday ?? 0;
            this.ticketStats = res.ticketStats;
            this.statsLoading = false;
            this._changeDetectorRef.markForCheck();
        });
    }

    private _loadTeamAdmins(): void {
        this.adminsLoading = true;
        this._rolesService.getAdministrators().subscribe({
            next: (admins) => {
                this.admins = [...admins].sort((a, b) => {
                    const aSuper = a.roleName.toLowerCase().includes('super') ? 0 : 1;
                    const bSuper = b.roleName.toLowerCase().includes('super') ? 0 : 1;
                    return aSuper - bSuper;
                });
                this.adminsLoading = false;
                this._changeDetectorRef.markForCheck();
            },
            error: () => {
                this.adminsLoading = false;
                this._changeDetectorRef.markForCheck();
            },
        });
    }

    /**
     * Fix the SVG fill references. This fix must be applied to all ApexCharts
     * charts in order to fix 'black color on gradient fills on certain browsers'
     * issue caused by the '<base>' tag.
     *
     * Fix based on https://gist.github.com/Kamshak/c84cdc175209d1a30f711abd6a81d472
     */
    private _fixSvgFill(element: Element): void {
        const currentURL = this._router.url;

        Array.from(element.querySelectorAll('*[fill]'))
            .filter((el) => el.getAttribute('fill').indexOf('url(') !== -1)
            .forEach((el) => {
                const attrVal = el.getAttribute('fill');
                el.setAttribute(
                    'fill',
                    `url(${currentURL}${attrVal.slice(attrVal.indexOf('#'))}`
                );
            });
    }

    private _prepareChartData(): void {
        // Task distribution
        this.chartTaskDistribution = {
            chart: {
                fontFamily: 'inherit',
                foreColor: 'inherit',
                height: '100%',
                type: 'polarArea',
                toolbar: { show: false },
                zoom: { enabled: false },
            },
            labels: this.data.taskDistribution.labels,
            legend: { position: 'bottom' },
            plotOptions: {
                polarArea: {
                    spokes: { connectorColors: 'var(--fuse-border)' },
                    rings: { strokeColor: 'var(--fuse-border)' },
                },
            },
            series: this.data.taskDistribution.series,
            states: { hover: { filter: { type: 'darken', value: 0.75 } } },
            stroke: { width: 2 },
            theme: {
                monochrome: {
                    enabled: true,
                    color: '#93C5FD',
                    shadeIntensity: 0.75,
                    shadeTo: 'dark',
                },
            },
            tooltip: { followCursor: true, theme: 'dark' },
            yaxis: { labels: { style: { colors: 'var(--fuse-text-secondary)' } } },
        };

        // Budget distribution
        this.chartBudgetDistribution = {
            chart: {
                fontFamily: 'inherit',
                foreColor: 'inherit',
                height: '100%',
                type: 'radar',
                sparkline: { enabled: true },
            },
            colors: ['#818CF8'],
            dataLabels: {
                enabled: true,
                formatter: (val: number): string | number => `${val}%`,
                textAnchor: 'start',
                style: { fontSize: '13px', fontWeight: 500 },
                background: { borderWidth: 0, padding: 4 },
                offsetY: -15,
            },
            markers: { strokeColors: '#818CF8', strokeWidth: 4 },
            plotOptions: {
                radar: {
                    polygons: {
                        strokeColors: 'var(--fuse-border)',
                        connectorColors: 'var(--fuse-border)',
                    },
                },
            },
            series: this.data.budgetDistribution.series,
            stroke: { width: 2 },
            tooltip: {
                theme: 'dark',
                y: { formatter: (val: number): string => `${val}%` },
            },
            xaxis: {
                labels: { show: true, style: { fontSize: '12px', fontWeight: '500' } },
                categories: this.data.budgetDistribution.categories,
            },
            yaxis: {
                max: (max: number): number => parseInt((max + 10).toFixed(0), 10),
                tickAmount: 7,
            },
        };

        // Weekly expenses
        this.chartWeeklyExpenses = {
            chart: {
                animations: { enabled: false },
                fontFamily: 'inherit',
                foreColor: 'inherit',
                height: '100%',
                type: 'line',
                sparkline: { enabled: true },
            },
            colors: ['#22D3EE'],
            series: this.data.weeklyExpenses.series,
            stroke: { curve: 'smooth' },
            tooltip: { theme: 'dark' },
            xaxis: { type: 'category', categories: this.data.weeklyExpenses.labels },
            yaxis: { labels: { formatter: (val): string => `$${val}` } },
        };

        // Monthly expenses
        this.chartMonthlyExpenses = {
            chart: {
                animations: { enabled: false },
                fontFamily: 'inherit',
                foreColor: 'inherit',
                height: '100%',
                type: 'line',
                sparkline: { enabled: true },
            },
            colors: ['#4ADE80'],
            series: this.data.monthlyExpenses.series,
            stroke: { curve: 'smooth' },
            tooltip: { theme: 'dark' },
            xaxis: { type: 'category', categories: this.data.monthlyExpenses.labels },
            yaxis: { labels: { formatter: (val): string => `$${val}` } },
        };

        // Yearly expenses
        this.chartYearlyExpenses = {
            chart: {
                animations: { enabled: false },
                fontFamily: 'inherit',
                foreColor: 'inherit',
                height: '100%',
                type: 'line',
                sparkline: { enabled: true },
            },
            colors: ['#FB7185'],
            series: this.data.yearlyExpenses.series,
            stroke: { curve: 'smooth' },
            tooltip: { theme: 'dark' },
            xaxis: { type: 'category', categories: this.data.yearlyExpenses.labels },
            yaxis: { labels: { formatter: (val): string => `$${val}` } },
        };
    }
}
