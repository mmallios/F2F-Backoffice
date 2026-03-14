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
import { MatChipsModule } from '@angular/material/chips';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatPaginator, MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatSelectModule } from '@angular/material/select';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { finalize } from 'rxjs';

import {
    AdminActivityService,
    AdminActionLogDto,
    AdminActionType,
    ADMIN_ACTION_LABELS,
} from '@fuse/services/admin-activity/admin-activity.service';

export interface AdminActionsDialogData {
    boUserId: number;
    adminName: string;
}

@Component({
    selector: 'app-admin-actions-dialog',
    standalone: true,
    imports: [
        CommonModule,
        ReactiveFormsModule,
        MatDialogModule,
        MatButtonModule,
        MatChipsModule,
        MatFormFieldModule,
        MatIconModule,
        MatInputModule,
        MatPaginatorModule,
        MatSelectModule,
        MatTableModule,
        MatTooltipModule,
    ],
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
<div class="flex flex-col min-w-0" style="width: 820px; max-width: 96vw;">

    <!-- Header -->
    <div class="flex items-center justify-between px-6 py-4 border-b">
        <div>
            <h2 class="text-xl font-extrabold tracking-tight">Ιστορικό Ενεργειών</h2>
            <p class="text-secondary text-sm mt-0.5">{{ data.adminName }}</p>
        </div>
        <button mat-icon-button (click)="close()"><mat-icon>close</mat-icon></button>
    </div>

    <!-- Filter -->
    <div class="px-6 py-4 border-b bg-gray-50/70 dark:bg-white/5">
        <div class="flex items-center gap-3 flex-wrap" [formGroup]="filterForm">
            <mat-form-field class="fuse-mat-dense fuse-mat-rounded flex-1 min-w-[200px]" subscriptSizing="dynamic">
                <mat-icon matPrefix class="icon-size-5" svgIcon="heroicons_outline:funnel"></mat-icon>
                <mat-label>Τύπος Ενέργειας</mat-label>
                <mat-select formControlName="actionType">
                    <mat-option [value]="null">Όλες οι Ενέργειες</mat-option>
                    @for (opt of actionTypeOptions; track opt.value) {
                        <mat-option [value]="opt.value">{{ opt.label }}</mat-option>
                    }
                </mat-select>
            </mat-form-field>
            <button mat-icon-button matTooltip="Ανανέωση" (click)="load()">
                <mat-icon>refresh</mat-icon>
            </button>
        </div>
    </div>

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
        @if (!dataSource.data.length) {
            <div class="p-10 text-center">
                <mat-icon class="text-secondary !w-12 !h-12 !text-5xl">history</mat-icon>
                <div class="text-lg font-semibold mt-3">Δεν βρέθηκαν ενέργειες</div>
                <div class="text-secondary text-sm mt-1">Δεν υπάρχουν καταγεγραμμένες ενέργειες για αυτόν τον διαχειριστή.</div>
            </div>
        } @else {
            <div class="overflow-auto">
                <table mat-table [dataSource]="dataSource" class="w-full min-w-[640px]">

                    <!-- Date -->
                    <ng-container matColumnDef="createdAt">
                        <th mat-header-cell *matHeaderCellDef class="!text-xs !font-semibold !text-secondary pl-6">Ημερομηνία</th>
                        <td mat-cell *matCellDef="let row" class="!text-sm pl-6 py-3 whitespace-nowrap">
                            {{ row.createdAt | date:'dd/MM/yyyy HH:mm' }}
                        </td>
                    </ng-container>

                    <!-- Action type -->
                    <ng-container matColumnDef="actionType">
                        <th mat-header-cell *matHeaderCellDef class="!text-xs !font-semibold !text-secondary">Τύπος</th>
                        <td mat-cell *matCellDef="let row" class="py-3">
                            <span [class]="actionChipClass(row.actionType)"
                                class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold">
                                <mat-icon class="icon-size-3.5">{{ actionIcon(row.actionType) }}</mat-icon>
                                {{ actionLabel(row.actionType) }}
                            </span>
                        </td>
                    </ng-container>

                    <!-- Entity -->
                    <ng-container matColumnDef="entity">
                        <th mat-header-cell *matHeaderCellDef class="!text-xs !font-semibold !text-secondary">Οντότητα</th>
                        <td mat-cell *matCellDef="let row" class="!text-sm text-secondary py-3">
                            @if (row.entityType) {
                                <span class="font-medium text-on-surface">{{ row.entityType }}</span>
                                @if (row.entityId) {
                                    <span class="ml-1 font-mono text-xs text-secondary">#{{ row.entityId }}</span>
                                }
                            } @else {
                                <span class="text-secondary">—</span>
                            }
                        </td>
                    </ng-container>

                    <!-- Description -->
                    <ng-container matColumnDef="description">
                        <th mat-header-cell *matHeaderCellDef class="!text-xs !font-semibold !text-secondary">Περιγραφή</th>
                        <td mat-cell *matCellDef="let row" class="!text-sm py-3 max-w-xs pr-6">
                            <span [matTooltip]="row.description" matTooltipShowDelay="400" class="line-clamp-2">
                                {{ row.description }}
                            </span>
                        </td>
                    </ng-container>

                    <tr mat-header-row *matHeaderRowDef="columns"></tr>
                    <tr mat-row *matRowDef="let row; columns: columns;" class="hover:bg-hover cursor-default"></tr>

                    <tr class="mat-row" *matNoDataRow>
                        <td class="mat-cell text-secondary p-6 text-center" [attr.colspan]="columns.length">
                            Δεν βρέθηκαν αποτελέσματα.
                        </td>
                    </tr>
                </table>
            </div>

            <mat-paginator
                [length]="total()"
                [pageSize]="pageSize()"
                [pageSizeOptions]="[10, 25, 50]"
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
export class AdminActionsDialogComponent implements OnInit {
    private api = inject(AdminActivityService);
    private fb = inject(FormBuilder);
    private cdr = inject(ChangeDetectorRef);

    loading = signal(true);
    error = signal<string | null>(null);
    total = signal(0);
    pageIndex = signal(0);
    pageSize = signal(10);

    dataSource = new MatTableDataSource<AdminActionLogDto>([]);
    @ViewChild(MatPaginator) paginator?: MatPaginator;

    readonly columns = ['createdAt', 'actionType', 'entity', 'description'];

    readonly actionTypeOptions = (Object.keys(ADMIN_ACTION_LABELS) as AdminActionType[]).map(k => ({
        value: k,
        label: ADMIN_ACTION_LABELS[k],
    }));

    filterForm = this.fb.group({
        actionType: [null as AdminActionType | null],
    });

    constructor(
        public dialogRef: MatDialogRef<AdminActionsDialogComponent>,
        @Inject(MAT_DIALOG_DATA) public data: AdminActionsDialogData,
    ) { }

    ngOnInit(): void {
        this.load();
        this.filterForm.valueChanges.subscribe(() => {
            this.pageIndex.set(0);
            this.load();
        });
    }

    load(): void {
        this.loading.set(true);
        this.error.set(null);
        this.api.getActions({
            boUserId: this.data.boUserId,
            actionType: this.filterForm.value.actionType ?? null,
            page: this.pageIndex() + 1,
            pageSize: this.pageSize(),
        })
            .pipe(finalize(() => this.loading.set(false)))
            .subscribe({
                next: res => {
                    this.total.set(res.total);
                    this.dataSource.data = res.items;
                    this.cdr.markForCheck();
                },
                error: () => {
                    this.error.set('Σφάλμα φόρτωσης ενεργειών.');
                    this.cdr.markForCheck();
                },
            });
    }

    onPage(e: PageEvent): void {
        this.pageIndex.set(e.pageIndex);
        this.pageSize.set(e.pageSize);
        this.load();
    }

    actionLabel(type: AdminActionType): string {
        return ADMIN_ACTION_LABELS[type] ?? type;
    }

    actionIcon(type: AdminActionType): string {
        const map: Record<AdminActionType, string> = {
            SUPPORT_REPLY: 'reply',
            ENTITY_CREATE: 'add_circle',
            ENTITY_EDIT: 'edit',
            ENTITY_DELETE: 'delete',
            ANNOUNCEMENT_CREATE: 'campaign',
            ANNOUNCEMENT_EDIT: 'edit_note',
            LOGIN: 'login',
            LOGOUT: 'logout',
            OTHER: 'more_horiz',
        };
        return map[type] ?? 'more_horiz';
    }

    actionChipClass(type: AdminActionType): string {
        const map: Partial<Record<AdminActionType, string>> = {
            SUPPORT_REPLY: 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-200',
            ENTITY_CREATE: 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-200',
            ENTITY_EDIT: 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200',
            ENTITY_DELETE: 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-200',
            ANNOUNCEMENT_CREATE: 'bg-violet-100 text-violet-800 dark:bg-violet-900/50 dark:text-violet-200',
            ANNOUNCEMENT_EDIT: 'bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-200',
            LOGIN: 'bg-teal-100 text-teal-800 dark:bg-teal-900/50 dark:text-teal-200',
            LOGOUT: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
            OTHER: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400',
        };
        return map[type] ?? 'bg-gray-100 text-gray-600';
    }

    close(): void {
        this.dialogRef.close();
    }
}
