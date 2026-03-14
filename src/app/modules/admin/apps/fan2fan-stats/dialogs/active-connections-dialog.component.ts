import { CommonModule } from '@angular/common';
import {
    ChangeDetectionStrategy,
    ChangeDetectorRef,
    Component,
    Inject,
    OnInit,
    ViewChild,
    inject,
    signal,
} from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatPaginator, MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { finalize } from 'rxjs';

import {
    AppStatsService,
    RecentConnectionDto,
} from '@fuse/services/app-stats/app-stats.service';

export interface ActiveConnectionsDialogData {
    // empty – no required context
}

@Component({
    selector: 'app-active-connections-dialog',
    standalone: true,
    imports: [
        CommonModule,
        MatDialogModule,
        MatButtonModule,
        MatIconModule,
        MatPaginatorModule,
        MatTableModule,
        MatTooltipModule,
    ],
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
<div class="flex flex-col min-w-0" style="width: 860px; max-width: 96vw;">

    <!-- Header -->
    <div class="flex items-center justify-between px-6 py-4 border-b">
        <div>
            <h2 class="text-lg font-bold leading-none">Σύνδεσεις Χρηστών</h2>
            <p class="text-secondary text-sm mt-1">Πρόσφατες συνδεδεμένες συσκευές ανά χρήστη</p>
        </div>
        <button mat-icon-button (click)="close()">
            <mat-icon>close</mat-icon>
        </button>
    </div>

    <!-- Loading / error -->
    @if (loading()) {
    <div class="flex justify-center items-center py-10 text-secondary gap-2">
        <mat-icon class="animate-spin">autorenew</mat-icon>
        <span>Φόρτωση…</span>
    </div>
    } @else if (error()) {
    <div class="mx-6 mt-4 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 dark:bg-red-950/50 px-4 py-3 text-red-700 dark:text-red-300 text-sm">
        <mat-icon class="text-red-500 shrink-0">error_outline</mat-icon>
        {{ error() }}
    </div>
    } @else {

    <!-- Table -->
    <div class="overflow-x-auto">
        <table mat-table [dataSource]="rows()" class="w-full">

            <!-- # -->
            <ng-container matColumnDef="index">
                <th mat-header-cell *matHeaderCellDef class="!pl-4 w-12">#</th>
                <td mat-cell *matCellDef="let row; let i = index" class="!pl-4 text-secondary text-sm">
                    {{ (paginator?.pageIndex ?? 0) * pageSize + i + 1 }}
                </td>
            </ng-container>

            <!-- User -->
            <ng-container matColumnDef="user">
                <th mat-header-cell *matHeaderCellDef>Χρήστης</th>
                <td mat-cell *matCellDef="let row">
                    <div class="flex items-center gap-3 py-1.5">
                        <div class="w-9 h-9 rounded-full overflow-hidden shrink-0 bg-primary/10 flex items-center justify-center">
                            @if (row.image) {
                                <img [src]="row.image" [alt]="row.fullname" class="w-full h-full object-cover">
                            } @else {
                                <mat-icon class="text-primary" style="font-size:20px;width:20px;height:20px;">person</mat-icon>
                            }
                        </div>
                        <div class="min-w-0">
                            <div class="font-medium text-sm leading-tight truncate">{{ row.fullname }}</div>
                            <div class="text-secondary text-xs font-mono mt-0.5">{{ row.code ?? '—' }}</div>
                        </div>
                    </div>
                </td>
            </ng-container>

            <!-- Login time -->
            <ng-container matColumnDef="loginTime">
                <th mat-header-cell *matHeaderCellDef>Σύνδεση</th>
                <td mat-cell *matCellDef="let row" class="text-sm">
                    {{ row.loginTime ? (row.loginTime | date:'dd/MM/yyyy HH:mm') : '—' }}
                </td>
            </ng-container>

            <!-- Last activity -->
            <ng-container matColumnDef="lastSeen">
                <th mat-header-cell *matHeaderCellDef class="!pr-4">Τελ. Ενέργεια</th>
                <td mat-cell *matCellDef="let row" class="text-sm !pr-4">
                    {{ row.lastSeen ? (row.lastSeen | date:'dd/MM/yyyy HH:mm') : '—' }}
                </td>
            </ng-container>

            <tr mat-header-row *matHeaderRowDef="columns"></tr>
            <tr mat-row *matRowDef="let row; columns: columns;"></tr>

            <tr class="mat-row" *matNoDataRow>
                <td class="mat-cell text-center py-8 text-secondary" [attr.colspan]="columns.length">
                    Δεν υπάρχουν δεδομένα
                </td>
            </tr>
        </table>
    </div>

    <!-- Paginator -->
    <mat-paginator
        #paginator
        [length]="total()"
        [pageSize]="pageSize"
        [pageSizeOptions]="[10, 20, 50]"
        [showFirstLastButtons]="true"
        (page)="onPage($event)"
        class="border-t">
    </mat-paginator>

    }
</div>
`,
})
export class ActiveConnectionsDialogComponent implements OnInit {
    private api = inject(AppStatsService);
    private cdr = inject(ChangeDetectorRef);
    private ref = inject(MatDialogRef<ActiveConnectionsDialogComponent>);

    @ViewChild('paginator') paginator?: MatPaginator;

    loading = signal(false);
    error = signal<string | null>(null);
    rows = signal<RecentConnectionDto[]>([]);
    total = signal(0);

    readonly columns = ['index', 'user', 'loginTime', 'lastSeen'];
    readonly pageSize = 20;
    private currentPage = 1;

    constructor(
        @Inject(MAT_DIALOG_DATA) public data: ActiveConnectionsDialogData
    ) { }

    ngOnInit(): void {
        this.fetchPage(1);
    }

    private fetchPage(page: number): void {
        this.loading.set(true);
        this.error.set(null);

        this.api.getAllConnections(page, this.pageSize)
            .pipe(finalize(() => { this.loading.set(false); this.cdr.markForCheck(); }))
            .subscribe({
                next: result => {
                    this.rows.set(result.items);
                    this.total.set(result.total);
                    this.currentPage = page;
                    this.cdr.markForCheck();
                },
                error: () => this.error.set('Σφάλμα κατά τη φόρτωση των συνδέσεων.'),
            });
    }

    onPage(event: PageEvent): void {
        this.fetchPage(event.pageIndex + 1);
    }

    close(): void {
        this.ref.close();
    }

    platformIcon(platform?: string | null): string {
        const p = (platform ?? '').toLowerCase();
        if (p.includes('android')) return 'android';
        if (p.includes('ios')) return 'phone_iphone';
        if (p.includes('web')) return 'public';
        return 'devices';
    }
}
