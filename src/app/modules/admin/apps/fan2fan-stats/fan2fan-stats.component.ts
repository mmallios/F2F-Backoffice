import { CommonModule } from '@angular/common';
import {
    ChangeDetectionStrategy,
    ChangeDetectorRef,
    Component,
    OnDestroy,
    OnInit,
    inject,
    signal,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Subject, finalize, takeUntil } from 'rxjs';

import {
    AppStatsService,
    AppStatsOverviewDto,
    RecentConnectionDto,
    CountryStatsDto,
} from '@fuse/services/app-stats/app-stats.service';

import {
    ActiveConnectionsDialogComponent,
    ActiveConnectionsDialogData,
} from './dialogs/active-connections-dialog.component';

@Component({
    selector: 'app-fan2fan-stats',
    standalone: true,
    imports: [
        CommonModule,
        MatButtonModule,
        MatDialogModule,
        MatIconModule,
        MatTableModule,
        MatTooltipModule,
    ],
    templateUrl: './fan2fan-stats.component.html',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Fan2fanStatsComponent implements OnInit, OnDestroy {
    private api = inject(AppStatsService);
    private dialog = inject(MatDialog);
    private cdr = inject(ChangeDetectorRef);
    private destroy$ = new Subject<void>();

    loading = signal(false);
    error = signal<string | null>(null);
    overview = signal<AppStatsOverviewDto | null>(null);
    connections = signal<RecentConnectionDto[]>([]);
    countries = signal<CountryStatsDto[]>([]);

    readonly connectionColumns = ['user', 'loginTime', 'lastSeen'];
    readonly countryColumns = ['country', 'total', 'today'];

    ngOnInit(): void {
        this.load();
    }

    ngOnDestroy(): void {
        this.destroy$.next();
        this.destroy$.complete();
    }

    load(): void {
        this.loading.set(true);
        this.error.set(null);

        // Parallel load overview + connections + countries
        const overview$ = this.api.getOverview();
        const connections$ = this.api.getRecentConnections(10);
        const countries$ = this.api.getCountries();

        let done = 0;
        const checkDone = () => { if (++done === 3) this.loading.set(false); };

        overview$.pipe(takeUntil(this.destroy$), finalize(checkDone)).subscribe({
            next: v => { this.overview.set(v); this.cdr.markForCheck(); },
            error: _ => { this.error.set('Σφάλμα φόρτωσης στατιστικών.'); },
        });

        connections$.pipe(takeUntil(this.destroy$), finalize(checkDone)).subscribe({
            next: v => { this.connections.set(v.items); this.cdr.markForCheck(); },
            error: _ => { },
        });

        countries$.pipe(takeUntil(this.destroy$), finalize(checkDone)).subscribe({
            next: v => { this.countries.set(v); this.cdr.markForCheck(); },
            error: _ => { },
        });
    }

    openConnectionsDialog(): void {
        const data: ActiveConnectionsDialogData = {};
        this.dialog.open(ActiveConnectionsDialogComponent, {
            width: '900px',
            maxWidth: '95vw',
            maxHeight: '90vh',
            data,
        });
    }

    platformIcon(platform?: string | null): string {
        const p = (platform ?? '').toLowerCase();
        if (p.includes('android')) return 'android';
        if (p.includes('ios')) return 'phone_iphone';
        if (p.includes('web')) return 'public';
        return 'devices';
    }
}
