import {
    ChangeDetectionStrategy,
    ChangeDetectorRef,
    Component,
    OnDestroy,
    OnInit,
    ViewEncapsulation,
} from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { NgClass } from '@angular/common';
import { BOHubService, BOHubNotificationDto } from 'app/core/signalr/bo-hub.service';
import { BONotifIcon, BONotifLabel } from 'app/layout/common/notifications/notifications.types';
import { Subject, takeUntil } from 'rxjs';

interface ToastItem {
    id: number;
    dto: BOHubNotificationDto;
    icon: string;
    label: string;
    /** hides the progress bar growing; used to trigger the transition */
    leaving: boolean;
}

let _nextId = 0;

@Component({
    selector: 'bo-toast',
    standalone: true,
    encapsulation: ViewEncapsulation.None,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [MatIconModule, NgClass],
    template: `
        <!-- Fixed container — bottom-right corner, above everything -->
        <div class="fixed bottom-4 right-4 z-[9999] flex flex-col gap-3 pointer-events-none"
             style="max-width: 26rem; width: 26rem;">
            @for (toast of toasts; track toast.id) {
                <div
                    class="pointer-events-auto relative flex flex-col overflow-hidden rounded-2xl bg-gray-900 px-5 pb-2 pt-4 shadow-2xl text-white"
                    [ngClass]="{ 'opacity-0 translate-x-10 transition-all duration-300': toast.leaving,
                                 'opacity-100 translate-x-0 transition-all duration-300': !toast.leaving }">
                    <!-- Header row -->
                    <div class="flex items-center gap-4">
                        <!-- Text (left side) -->
                        <div class="flex min-w-0 flex-1 flex-col">
                            <span class="text-sm font-bold uppercase tracking-widest text-primary-300">
                                {{ toast.label }}
                            </span>
                            <span class="mt-1 truncate text-base font-bold leading-snug text-white">
                                {{ toast.dto.title }}
                            </span>
                            @if (toast.dto.description) {
                                <span class="mt-1 line-clamp-2 text-sm text-gray-300">
                                    {{ toast.dto.description }}
                                </span>
                            }
                        </div>
                        <!-- Big icon on the right -->
                        <div class="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-primary-600">
                            <mat-icon class="text-white" style="font-size:2rem;width:2rem;height:2rem;"
                                      [svgIcon]="toast.icon"></mat-icon>
                        </div>
                    </div>

                    <!-- Close button (top-right corner) -->
                    <button class="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full text-gray-400 hover:text-white"
                            (click)="dismiss(toast)">
                        <mat-icon class="icon-size-4" svgIcon="heroicons_mini:x-mark"></mat-icon>
                    </button>

                    <!-- 10-second progress bar -->
                    <div class="relative mt-3 h-1 w-full overflow-hidden rounded-full bg-gray-700">
                        <div class="absolute left-0 top-0 h-full rounded-full bg-primary-500"
                             [style.animation]="'bo-toast-shrink 10s linear forwards'"></div>
                    </div>
                </div>
            }
        </div>

        <style>
            @keyframes bo-toast-shrink {
                from { width: 100%; }
                to   { width: 0%;   }
            }
        </style>
    `,
})
export class BOToastComponent implements OnInit, OnDestroy {
    toasts: ToastItem[] = [];

    private _unsubscribeAll = new Subject<void>();
    private _timers = new Map<number, ReturnType<typeof setTimeout>>();

    constructor(
        private _hub: BOHubService,
        private _cdr: ChangeDetectorRef
    ) { }

    ngOnInit(): void {
        this._hub.notification$
            .pipe(takeUntil(this._unsubscribeAll))
            .subscribe((dto) => this._add(dto));
    }

    ngOnDestroy(): void {
        this._unsubscribeAll.next();
        this._unsubscribeAll.complete();
        this._timers.forEach((t) => clearTimeout(t));
    }

    dismiss(toast: ToastItem): void {
        this._startLeave(toast);
    }

    private _add(dto: BOHubNotificationDto): void {
        const toast: ToastItem = {
            id: ++_nextId,
            dto,
            icon: BONotifIcon[dto.type] ?? 'heroicons_outline:bell',
            label: BONotifLabel[dto.type] ?? 'Ειδοποίηση',
            leaving: false,
        };
        this.toasts = [...this.toasts, toast];
        this._cdr.markForCheck();

        // auto-dismiss after 10 s
        const t = setTimeout(() => this._startLeave(toast), 10_000);
        this._timers.set(toast.id, t);
    }

    private _startLeave(toast: ToastItem): void {
        const existing = this.toasts.find((t) => t.id === toast.id);
        if (!existing || existing.leaving) return;

        clearTimeout(this._timers.get(toast.id));
        this._timers.delete(toast.id);

        existing.leaving = true;
        this._cdr.markForCheck();

        // remove from DOM after the CSS transition (300 ms)
        setTimeout(() => {
            this.toasts = this.toasts.filter((t) => t.id !== toast.id);
            this._cdr.markForCheck();
        }, 320);
    }
}
