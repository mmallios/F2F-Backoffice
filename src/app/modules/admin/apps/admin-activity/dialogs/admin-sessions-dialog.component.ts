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
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatNativeDateModule } from '@angular/material/core';
import { MatPaginator, MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { finalize } from 'rxjs';

import {
    AdminActivityService,
    AdminLoginSessionDto,
} from '@fuse/services/admin-activity/admin-activity.service';

export interface AdminSessionsDialogData {
    boUserId: number;
    adminName: string;
}

@Component({
    selector: 'app-admin-sessions-dialog',
    standalone: true,
    imports: [
        CommonModule,
        ReactiveFormsModule,
        MatDialogModule,
        MatButtonModule,
        MatChipsModule,
        MatDatepickerModule,
        MatFormFieldModule,
        MatIconModule,
        MatInputModule,
        MatNativeDateModule,
        MatTableModule,
        MatPaginatorModule,
        MatTooltipModule,
    ],
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
<div class="flex flex-col min-w-0" style="width: 820px; max-width: 96vw;">

    <!-- Header -->
    <div class="flex items-center justify-between px-6 py-4 border-b">
        <div>
            <h2 class="text-xl font-extrabold tracking-tight">Συνεδρίες Σύνδεσης</h2>
            <p class="text-secondary text-sm mt-0.5">{{ data.adminName }}</p>
        </div>
        <button mat-icon-button (click)="close()">
            <mat-icon>close</mat-icon>
        </button>
    </div>

    <!-- Date filter -->
    @if (!loading() && !error()) {
        <div class="flex items-center gap-3 px-6 py-3 border-b bg-gray-50 dark:bg-gray-900/40 flex-wrap">
            <mat-icon class="text-secondary !w-5 !h-5 !text-xl shrink-0">filter_list</mat-icon>
            <form [formGroup]="dateFilter" class="flex items-center gap-3 flex-wrap">
                <mat-form-field appearance="outline" class="!w-40 !text-sm" subscriptSizing="dynamic">
                    <mat-label>Από</mat-label>
                    <input matInput [matDatepicker]="pickerFrom" formControlName="from" readonly>
                    <mat-datepicker-toggle matIconSuffix [for]="pickerFrom"></mat-datepicker-toggle>
                    <mat-datepicker #pickerFrom></mat-datepicker>
                </mat-form-field>

                <mat-form-field appearance="outline" class="!w-40 !text-sm" subscriptSizing="dynamic">
                    <mat-label>Έως</mat-label>
                    <input matInput [matDatepicker]="pickerTo" formControlName="to" readonly>
                    <mat-datepicker-toggle matIconSuffix [for]="pickerTo"></mat-datepicker-toggle>
                    <mat-datepicker #pickerTo></mat-datepicker>
                </mat-form-field>
            </form>

            <button mat-flat-button color="primary" class="!rounded-xl !h-9 !text-sm" (click)="applyFilter(0)">
                Εφαρμογή
            </button>

            @if (dateFilter.value.from || dateFilter.value.to) {
                <button mat-icon-button class="!w-8 !h-8" matTooltip="Εκκαθάριση φίλτρων" (click)="clearFilter()">
                    <mat-icon class="!text-base">close</mat-icon>
                </button>
            }

            <span class="ml-auto text-xs text-secondary">
                {{ filteredRows.length }} αποτελέσματα
            </span>
        </div>
    }

    <!-- Loading -->
    @if (loading()) {
        <div class="flex items-center justify-center py-16">
            <div class="animate-pulse space-y-3 w-full px-8">
                <div class="h-4 w-1/3 rounded bg-gray-200 dark:bg-gray-700"></div>
                <div class="h-4 w-2/3 rounded bg-gray-200 dark:bg-gray-700"></div>
                <div class="h-4 w-1/2 rounded bg-gray-200 dark:bg-gray-700"></div>
            </div>
        </div>
    }

    <!-- Error -->
    @if (!loading() && error()) {
        <div class="mx-6 my-4 flex items-center gap-3 rounded-2xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/50 px-5 py-4 text-red-700 dark:text-red-300">
            <mat-icon class="text-red-500 shrink-0">error_outline</mat-icon>
            <span>{{ error() }}</span>
        </div>
    }

    <!-- Table -->
    @if (!loading() && !error()) {
        @if (!dataSource.data.length && !filteredRows.length) {
            <div class="p-10 text-center">
                <mat-icon class="text-secondary !w-12 !h-12 !text-5xl">login</mat-icon>
                <div class="text-lg font-semibold mt-3">Δεν βρέθηκαν συνεδρίες</div>
                <div class="text-secondary text-sm mt-1">Ο διαχειριστής δεν έχει καταγεγραμμένες συνεδρίες.</div>
            </div>
        } @else {
            <div class="overflow-auto">
                <table mat-table [dataSource]="dataSource" class="w-full min-w-[640px]">

                    <!-- Login -->
                    <ng-container matColumnDef="loginAt">
                        <th mat-header-cell *matHeaderCellDef class="!text-xs !font-semibold !text-secondary pl-6">Σύνδεση</th>
                        <td mat-cell *matCellDef="let row" class="!text-sm pl-6 py-3">
                            {{ row.loginAt | date:'dd/MM/yyyy HH:mm' }}
                        </td>
                    </ng-container>

                    <!-- Logout -->
                    <ng-container matColumnDef="logoutAt">
                        <th mat-header-cell *matHeaderCellDef class="!text-xs !font-semibold !text-secondary">Αποσύνδεση</th>
                        <td mat-cell *matCellDef="let row" class="!text-sm py-3">
                            @if (row.logoutAt) {
                                {{ row.logoutAt | date:'dd/MM/yyyy HH:mm' }}
                            } @else {
                                <span class="text-secondary italic">—</span>
                            }
                        </td>
                    </ng-container>

                    <!-- Duration -->
                    <ng-container matColumnDef="duration">
                        <th mat-header-cell *matHeaderCellDef class="!text-xs !font-semibold !text-secondary !text-center">Διάρκεια</th>
                        <td mat-cell *matCellDef="let row" class="!text-sm !text-center py-3">
                            @if (row.durationMinutes != null) {
                                {{ formatDuration(row.durationMinutes) }}
                            } @else {
                                <span class="text-secondary text-xs">—</span>
                            }
                        </td>
                    </ng-container>

                    <!-- Device -->
                    <ng-container matColumnDef="device">
                        <th mat-header-cell *matHeaderCellDef class="!text-xs !font-semibold !text-secondary">Συσκευή</th>
                        <td mat-cell *matCellDef="let row" class="!text-sm py-3">
                            @if (row.deviceType === 'Mobile') {
                                <span class="inline-flex items-center gap-1.5 text-blue-600 dark:text-blue-400">
                                    <mat-icon class="!w-4 !h-4 !text-base">smartphone</mat-icon>
                                    <span>Mobile</span>
                                </span>
                            } @else {
                                <span class="inline-flex items-center gap-1.5 text-gray-600 dark:text-gray-400">
                                    <mat-icon class="!w-4 !h-4 !text-base">computer</mat-icon>
                                    <span>Desktop</span>
                                </span>
                            }
                        </td>
                    </ng-container>

                    <!-- Status -->
                    <ng-container matColumnDef="status">
                        <th mat-header-cell *matHeaderCellDef class="!text-xs !font-semibold !text-secondary !text-center pr-6">Κατάσταση</th>
                        <td mat-cell *matCellDef="let row" class="!text-center pr-4 py-3">
                            @if (row.isActive) {
                                <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-200">
                                    <span class="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
                                    Ενεργή
                                </span>
                            } @else {
                                <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300">
                                    Ολοκληρωμένη
                                </span>
                            }
                        </td>
                    </ng-container>

                    <tr mat-header-row *matHeaderRowDef="columns"></tr>
                    <tr mat-row *matRowDef="let row; columns: columns;" class="hover:bg-hover cursor-default"></tr>

                    <tr class="mat-row" *matNoDataRow>
                        <td class="mat-cell text-secondary p-6 text-center" [attr.colspan]="columns.length">
                            Δεν βρέθηκαν αποτελέσματα για το επιλεγμένο διάστημα.
                        </td>
                    </tr>
                </table>
            </div>

            <mat-paginator
                [length]="filteredRows.length"
                [pageSize]="pageSize"
                [pageSizeOptions]="[5, 10, 25]"
                (page)="onPage($event)"
                class="border-t">
            </mat-paginator>
        }
    }

    <!-- Footer -->
    <div class="flex justify-end px-6 py-4 border-t">
        <button mat-flat-button color="primary" class="!rounded-xl" (click)="close()">Κλείσιμο</button>
    </div>
</div>
    `,
})
export class AdminSessionsDialogComponent implements OnInit {
    private api = inject(AdminActivityService);
    private cdr = inject(ChangeDetectorRef);

    loading = signal(true);
    error = signal<string | null>(null);

    allRows: AdminLoginSessionDto[] = [];
    filteredRows: AdminLoginSessionDto[] = [];
    dataSource = new MatTableDataSource<AdminLoginSessionDto>([]);
    @ViewChild(MatPaginator) paginator?: MatPaginator;

    readonly columns = ['loginAt', 'logoutAt', 'duration', 'device', 'status'];
    readonly pageSize = 10;

    dateFilter = new FormGroup({
        from: new FormControl<Date | null>(null),
        to: new FormControl<Date | null>(null),
    });

    constructor(
        public dialogRef: MatDialogRef<AdminSessionsDialogComponent>,
        @Inject(MAT_DIALOG_DATA) public data: AdminSessionsDialogData,
    ) { }

    ngOnInit(): void {
        this.api.getSessions(this.data.boUserId)
            .pipe(finalize(() => this.loading.set(false)))
            .subscribe({
                next: rows => {
                    this.allRows = rows;
                    this.applyFilter(0);
                    this.cdr.markForCheck();
                },
                error: () => {
                    this.error.set('Σφάλμα φόρτωσης συνεδριών.');
                    this.cdr.markForCheck();
                },
            });
    }

    applyFilter(pageIndex: number): void {
        const rawFrom = this.dateFilter.value.from;
        const rawTo = this.dateFilter.value.to;

        // Material datepicker can hand us a string on some locales — force to Date
        const from = rawFrom ? new Date(rawFrom) : null;
        const to = rawTo ? new Date(rawTo) : null;

        const dayStartUTC = (d: Date) =>
            new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));

        this.filteredRows = this.allRows.filter(row => {
            const d = new Date(row.loginAt);
            if (from && d < dayStartUTC(from)) return false;
            if (to) {
                const toEnd = dayStartUTC(to);
                toEnd.setUTCDate(toEnd.getUTCDate() + 1);
                if (d >= toEnd) return false;
            }
            return true;
        });

        const start = pageIndex * this.pageSize;
        this.dataSource.data = this.filteredRows.slice(start, start + this.pageSize);
        // Use setTimeout to avoid ExpressionChangedAfterItHasBeenChecked when
        // applyFilter is called from inside ngOnInit's subscribe callback
        setTimeout(() => {
            if (this.paginator) this.paginator.firstPage();
            this.cdr.markForCheck();
        });
    }

    onPage(e: PageEvent): void {
        const start = e.pageIndex * e.pageSize;
        this.dataSource.data = this.filteredRows.slice(start, start + e.pageSize);
        this.cdr.markForCheck();
    }

    clearFilter(): void {
        this.dateFilter.reset();
    }

    formatDuration(minutes: number): string {
        if (minutes < 60) return `${minutes}λ`;
        const h = Math.floor(minutes / 60);
        const m = minutes % 60;
        return m > 0 ? `${h}ω ${m}λ` : `${h}ω`;
    }

    close(): void {
        this.dialogRef.close();
    }
}
