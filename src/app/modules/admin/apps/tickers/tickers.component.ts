import {
    ChangeDetectionStrategy,
    ChangeDetectorRef,
    Component,
    DestroyRef,
    OnInit,
    ViewChild,
    ViewEncapsulation,
    computed,
    inject,
    signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { trigger, transition, style, animate } from '@angular/animations';

import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatChipsModule } from '@angular/material/chips';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { MatSort, MatSortModule } from '@angular/material/sort';

import { forkJoin } from 'rxjs';
import { FuseConfirmationService } from '@fuse/services/confirmation';
import { TickersService, TickerDto } from '@fuse/services/tickers/tickers.service';
import { ClaimsService } from '@fuse/services/claims/claims.service';
import { BoPermissionDirective } from '@fuse/directives/permission/bo-permission.directive';
import { AnnouncementsService } from '@fuse/services/announcements/announcements.service';
import { NewsService } from '@fuse/services/news/news.service';

export interface DynamicTickerItem {
    label: string;
    title: string;
    icon: string;
    badgeClass: string;
}

export interface TickerTypeConfig {
    value: number;
    label: string;
    icon: string;
    badgeClass: string;
    isDynamic: boolean;
}

@Component({
    selector: 'tickers',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    encapsulation: ViewEncapsulation.None,
    animations: [
        trigger('slideDown', [
            transition(':enter', [
                style({ opacity: 0, transform: 'translateY(-10px)' }),
                animate('200ms ease-out', style({ opacity: 1, transform: 'translateY(0)' })),
            ]),
            transition(':leave', [
                animate('150ms ease-in', style({ opacity: 0, transform: 'translateY(-10px)' })),
            ]),
        ]),
    ],
    imports: [
        CommonModule,
        ReactiveFormsModule,
        MatButtonModule,
        MatIconModule,
        MatFormFieldModule,
        MatInputModule,
        MatSelectModule,
        MatTooltipModule,
        MatSlideToggleModule,
        MatDatepickerModule,
        MatNativeDateModule,
        MatChipsModule,
        MatTableModule,
        MatPaginatorModule,
        MatSortModule,
        BoPermissionDirective,
    ],
    templateUrl: './tickers.component.html',
})
export class TickersComponent implements OnInit {
    @ViewChild(MatPaginator) paginator: MatPaginator;
    @ViewChild(MatSort) sort: MatSort;

    readonly claimsService = inject(ClaimsService);
    private _service = inject(TickersService);
    private _announcements = inject(AnnouncementsService);
    private _news = inject(NewsService);
    private _confirm = inject(FuseConfirmationService);
    private _destroyRef = inject(DestroyRef);
    private _cdr = inject(ChangeDetectorRef);

    dataSource = new MatTableDataSource<TickerDto>([]);
    tableColumns: string[] = ['rank', 'type', 'title', 'status', 'dates', 'actions'];

    private _allItems: TickerDto[] = [];

    dynamicItems = signal<DynamicTickerItem[]>([]);
    dynamicLoading = signal(true);
    loading = signal(true);
    saving = signal(false);
    showForm = signal(false);
    editingId = signal<number | null>(null);
    reordering = signal(false);

    activeCount = computed(() => this._allItems.filter(i => i.isActive).length);
    dynamicCount = computed(() => this._allItems.filter(i => i.type === 1 || i.type === 2).length);
    totalCount = computed(() => this._allItems.length);

    readonly TYPES: TickerTypeConfig[] = [
        { value: 1, label: 'Ανακοίνωση', icon: 'heroicons_outline:megaphone',    badgeClass: 'bg-purple-100 text-purple-800 dark:bg-purple-500/20 dark:text-purple-300', isDynamic: true  },
        { value: 2, label: 'Ενημέρωση',  icon: 'heroicons_outline:newspaper',    badgeClass: 'bg-blue-100 text-blue-800 dark:bg-blue-500/20 dark:text-blue-300',           isDynamic: true  },
        { value: 3, label: 'Store',      icon: 'heroicons_outline:shopping-bag', badgeClass: 'bg-orange-100 text-orange-800 dark:bg-orange-500/20 dark:text-orange-300',   isDynamic: false },
        { value: 4, label: 'Tickets',    icon: 'heroicons_outline:ticket',       badgeClass: 'bg-green-100 text-green-800 dark:bg-green-500/20 dark:text-green-300',       isDynamic: false },
        { value: 5, label: 'Live Score', icon: 'heroicons_outline:signal',       badgeClass: 'bg-red-100 text-red-800 dark:bg-red-500/20 dark:text-red-300',               isDynamic: false },
        { value: 6, label: 'Custom',     icon: 'heroicons_outline:tag',          badgeClass: 'bg-gray-100 text-gray-700 dark:bg-white/10 dark:text-gray-300',              isDynamic: false },
    ];

    form = new FormGroup({
        title:   new FormControl('', [Validators.required, Validators.minLength(2)]),
        type:    new FormControl<number>(6, [Validators.required]),
        isActive: new FormControl(true),
        startAt: new FormControl<Date | null>(null),
        endAt:   new FormControl<Date | null>(null),
        linkUrl: new FormControl(''),
    });

    ngOnInit(): void {
        this.load();
        this.loadDynamic();
    }

    loadDynamic(): void {
        this.dynamicLoading.set(true);
        forkJoin({ announcements: this._announcements.getAll(), news: this._news.getAll() })
            .pipe(takeUntilDestroyed(this._destroyRef))
            .subscribe({
                next: ({ announcements, news }) => {
                    const annItems: DynamicTickerItem[] = (announcements ?? [])
                        .filter(a => a.status === 1 && !a.isDeleted)
                        .sort((a, b) => new Date(b.createdOn ?? 0).getTime() - new Date(a.createdOn ?? 0).getTime())
                        .slice(0, 2)
                        .map(a => ({ label: 'ΑΝΑΚΟΙΝΩΣΗ', title: a.title, icon: 'heroicons_outline:megaphone', badgeClass: 'bg-purple-100 text-purple-800 dark:bg-purple-500/20 dark:text-purple-300' }));

                    const newsItems: DynamicTickerItem[] = (news ?? [])
                        .filter(n => !n.isHidden)
                        .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())
                        .slice(0, 2)
                        .map(n => ({ label: 'ΝΕΑ', title: n.title, icon: 'heroicons_outline:newspaper', badgeClass: 'bg-blue-100 text-blue-800 dark:bg-blue-500/20 dark:text-blue-300' }));

                    this.dynamicItems.set([...annItems, ...newsItems]);
                    this.dynamicLoading.set(false);
                    this._cdr.markForCheck();
                },
                error: () => { this.dynamicLoading.set(false); this._cdr.markForCheck(); },
            });
    }

    load(): void {
        this.loading.set(true);
        this._service.getAll()
            .pipe(takeUntilDestroyed(this._destroyRef))
            .subscribe({
                next: data => {
                    this._allItems = data;
                    this.dataSource.data = data;
                    this.dataSource.paginator = this.paginator;
                    this.dataSource.sort = this.sort;
                    this.loading.set(false);
                    this._cdr.markForCheck();
                },
                error: () => { this.loading.set(false); this._cdr.markForCheck(); },
            });
    }

    typeFor(typeId: number): TickerTypeConfig {
        return this.TYPES.find(t => t.value === typeId) ?? this.TYPES[5];
    }

    isDynamic(typeId: number): boolean {
        return typeId === 1 || typeId === 2;
    }

    rankOf(item: TickerDto): number {
        return this._allItems.indexOf(item) + 1;
    }

    isFirst(item: TickerDto): boolean {
        return this._allItems.indexOf(item) === 0;
    }

    isLast(item: TickerDto): boolean {
        return this._allItems.indexOf(item) === this._allItems.length - 1;
    }

    moveUp(item: TickerDto): void {
        const idx = this._allItems.indexOf(item);
        if (idx <= 0) return;
        this._move(idx, idx - 1);
    }

    moveDown(item: TickerDto): void {
        const idx = this._allItems.indexOf(item);
        if (idx < 0 || idx >= this._allItems.length - 1) return;
        this._move(idx, idx + 1);
    }

    private _move(from: number, to: number): void {
        const arr = [...this._allItems];
        const [item] = arr.splice(from, 1);
        arr.splice(to, 0, item);
        this._allItems = arr;
        this.dataSource.data = [...arr];
        this._cdr.markForCheck();

        this.reordering.set(true);
        this._service.reorder(arr.map(i => i.id))
            .pipe(takeUntilDestroyed(this._destroyRef))
            .subscribe({
                next: () => this.reordering.set(false),
                error: () => {
                    // revert
                    const reverted = [...this._allItems];
                    const [ri] = reverted.splice(to, 1);
                    reverted.splice(from, 0, ri);
                    this._allItems = reverted;
                    this.dataSource.data = [...reverted];
                    this.reordering.set(false);
                    this._cdr.markForCheck();
                },
            });
    }

    openCreate(): void {
        this.editingId.set(null);
        this.form.reset({ title: '', type: 6, isActive: true, startAt: null, endAt: null, linkUrl: '' });
        this.showForm.set(true);
    }

    openEdit(item: TickerDto): void {
        this.editingId.set(item.id);
        this.form.reset({
            title: item.title, type: item.type, isActive: item.isActive,
            startAt: item.startAt ? new Date(item.startAt) : null,
            endAt:   item.endAt   ? new Date(item.endAt)   : null,
            linkUrl: item.linkUrl ?? '',
        });
        this.showForm.set(true);
    }

    cancelForm(): void {
        this.showForm.set(false);
        this.editingId.set(null);
        this.form.reset();
    }

    save(): void {
        if (this.form.invalid) { this.form.markAllAsTouched(); return; }

        this.saving.set(true);
        const v = this.form.getRawValue();
        const startAt = v.startAt ? this._toUtcMidnight(v.startAt) : undefined;
        const endAt   = v.endAt   ? this._toUtcMidnight(v.endAt)   : undefined;
        const linkUrl = v.type === 6 && v.linkUrl?.trim() ? v.linkUrl.trim() : null;

        if (this.editingId() === null) {
            this._service.create({ title: v.title!.trim(), type: v.type!, isActive: v.isActive ?? true, linkUrl, startAt, endAt, priority: 0 })
                .pipe(takeUntilDestroyed(this._destroyRef))
                .subscribe({ next: () => { this.cancelForm(); this.load(); }, error: () => this.saving.set(false) });
        } else {
            const priority = this._allItems.find(i => i.id === this.editingId())?.priority ?? 0;
            this._service.update(this.editingId()!, { title: v.title!.trim(), type: v.type!, isActive: v.isActive ?? true, linkUrl, priority, startAt: startAt ?? new Date().toISOString(), endAt })
                .pipe(takeUntilDestroyed(this._destroyRef))
                .subscribe({ next: () => { this.cancelForm(); this.load(); }, error: () => this.saving.set(false) });
        }
    }

    delete(item: TickerDto): void {
        this._confirm.open({
            title: 'Διαγραφή ticker item',
            message: `Είστε σίγουροι ότι θέλετε να διαγράψετε το "<strong>${item.title}</strong>";`,
            icon: { show: true, name: 'heroicons_outline:trash', color: 'warn' },
            actions: { confirm: { label: 'Διαγραφή', color: 'warn' }, cancel: { label: 'Ακύρωση' } },
        })
        .afterClosed()
        .pipe(takeUntilDestroyed(this._destroyRef))
        .subscribe(result => {
            if (result !== 'confirmed') return;
            this._service.delete(item.id)
                .pipe(takeUntilDestroyed(this._destroyRef))
                .subscribe(() => {
                    this._allItems = this._allItems.filter(i => i.id !== item.id);
                    this.dataSource.data = [...this._allItems];
                    this._cdr.markForCheck();
                });
        });
    }

    private _toUtcMidnight(date: Date): string {
        return new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())).toISOString();
    }
}
