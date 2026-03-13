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
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatPaginator, MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { finalize } from 'rxjs';

import {
    SupportTicketsAdminService,
    SupportTicketAdminDto,
    SupportTicketStatus,
} from '@fuse/services/support/support-tickets-admin.service';

export interface AdminTicketsDialogData {
    boUserId: number;
    adminName: string;
}

@Component({
    selector: 'app-admin-tickets-dialog',
    standalone: true,
    imports: [
        CommonModule,
        MatDialogModule,
        MatButtonModule,
        MatIconModule,
        MatTableModule,
        MatPaginatorModule,
        MatChipsModule,
        MatTooltipModule,
    ],
    template: `
    <div class="flex flex-col min-w-0" style="width: 720px; max-width: 95vw;">
      <!-- Header -->
      <div class="flex items-center justify-between px-6 py-4 border-b">
        <div>
          <h2 class="text-xl font-extrabold tracking-tight">Tickets Διαχειριστή</h2>
          <p class="text-secondary text-sm mt-0.5">{{ data.adminName }}</p>
        </div>
        <button mat-icon-button (click)="close()">
          <mat-icon>close</mat-icon>
        </button>
      </div>

      <!-- Loading -->
      @if (loading()) {
        <div class="flex items-center justify-center py-16">
          <div class="animate-pulse space-y-3">
            <div class="h-4 w-1/3 rounded bg-gray-200 dark:bg-gray-700"></div>
            <div class="h-4 w-2/3 rounded bg-gray-200 dark:bg-gray-700"></div>
            <div class="h-4 w-1/2 rounded bg-gray-200 dark:bg-gray-700"></div>
          </div>
        </div>
      }

      <!-- Table -->
      @if (!loading()) {
        <div class="overflow-auto">
          <table mat-table [dataSource]="dataSource" class="w-full">

            <!-- ID -->
            <ng-container matColumnDef="id">
              <th mat-header-cell *matHeaderCellDef class="!text-xs !font-semibold !text-secondary">#</th>
              <td mat-cell *matCellDef="let row" class="!text-sm font-mono text-secondary">#{{ row.id }}</td>
            </ng-container>

            <!-- Date -->
            <ng-container matColumnDef="createdAt">
              <th mat-header-cell *matHeaderCellDef class="!text-xs !font-semibold !text-secondary">Ημερομηνία</th>
              <td mat-cell *matCellDef="let row" class="!text-sm">{{ row.createdAt | date:'dd/MM/yyyy HH:mm' }}</td>
            </ng-container>

            <!-- Subject -->
            <ng-container matColumnDef="subject">
              <th mat-header-cell *matHeaderCellDef class="!text-xs !font-semibold !text-secondary">Θέμα</th>
              <td mat-cell *matCellDef="let row" class="!text-sm max-w-xs truncate">
                <span [matTooltip]="row.subject ?? ''" matTooltipShowDelay="500">{{ row.subject }}</span>
              </td>
            </ng-container>

            <!-- Category -->
            <ng-container matColumnDef="category">
              <th mat-header-cell *matHeaderCellDef class="!text-xs !font-semibold !text-secondary">Κατηγορία</th>
              <td mat-cell *matCellDef="let row">
                <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300">
                  {{ row.category }}
                </span>
              </td>
            </ng-container>

            <!-- Status -->
            <ng-container matColumnDef="status">
              <th mat-header-cell *matHeaderCellDef class="!text-xs !font-semibold !text-secondary">Κατάσταση</th>
              <td mat-cell *matCellDef="let row">
                <mat-chip-set>
                  <mat-chip [class]="statusChipClass(row.status)" disableRipple>
                    {{ statusLabel(row.status) }}
                  </mat-chip>
                </mat-chip-set>
              </td>
            </ng-container>

            <tr mat-header-row *matHeaderRowDef="columns"></tr>
            <tr mat-row *matRowDef="let row; columns: columns;" class="hover:bg-hover cursor-default"></tr>

            <!-- Empty state -->
            <tr class="mat-row" *matNoDataRow>
              <td class="mat-cell text-center py-8 text-secondary" [colSpan]="columns.length">
                Δεν βρέθηκαν tickets για αυτόν τον διαχειριστή.
              </td>
            </tr>
          </table>
        </div>

        <mat-paginator
          [length]="total()"
          [pageSize]="pageSize"
          [pageSizeOptions]="[5, 10, 20]"
          (page)="onPage($event)"
          class="border-t">
        </mat-paginator>
      }
    </div>
    `,
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminTicketsDialogComponent implements OnInit {
    private api = inject(SupportTicketsAdminService);
    private cdr = inject(ChangeDetectorRef);

    loading = signal(true);
    total = signal(0);
    dataSource = new MatTableDataSource<SupportTicketAdminDto>([]);

    pageIndex = 0;
    pageSize = 10;

    readonly columns = ['id', 'createdAt', 'subject', 'category', 'status'];

    constructor(
        @Inject(MAT_DIALOG_DATA) public data: AdminTicketsDialogData,
        private ref: MatDialogRef<AdminTicketsDialogComponent>,
    ) { }

    ngOnInit(): void {
        this.load();
    }

    load(): void {
        this.loading.set(true);
        this.api.getAdminTickets(this.data.boUserId, {
            page: this.pageIndex + 1,
            pageSize: this.pageSize,
            sort: 'createdAt:desc',
        }).pipe(finalize(() => this.loading.set(false)))
            .subscribe({
                next: (result) => {
                    this.dataSource.data = result.items;
                    this.total.set(result.total);
                    this.cdr.markForCheck();
                },
                error: () => {
                    this.dataSource.data = [];
                    this.cdr.markForCheck();
                },
            });
    }

    onPage(e: PageEvent): void {
        this.pageIndex = e.pageIndex;
        this.pageSize = e.pageSize;
        this.load();
    }

    close(): void {
        this.ref.close();
    }

    statusLabel(status: SupportTicketStatus): string {
        switch (status) {
            case SupportTicketStatus.Pending: return 'Εκκρεμεί';
            case SupportTicketStatus.Answered: return 'Απαντήθηκε';
            case SupportTicketStatus.Completed: return 'Ολοκληρώθηκε';
            case SupportTicketStatus.Deleted: return 'Διεγράφη';
            default: return String(status);
        }
    }

    statusChipClass(status: SupportTicketStatus): string {
        switch (status) {
            case SupportTicketStatus.Pending: return '!bg-amber-100 !text-amber-800 dark:!bg-amber-900 dark:!text-amber-200';
            case SupportTicketStatus.Answered: return '!bg-blue-100 !text-blue-800 dark:!bg-blue-900 dark:!text-blue-200';
            case SupportTicketStatus.Completed: return '!bg-green-100 !text-green-800 dark:!bg-green-900 dark:!text-green-200';
            case SupportTicketStatus.Deleted: return '!bg-red-100 !text-red-800 dark:!bg-red-900 dark:!text-red-200';
            default: return '';
        }
    }
}
