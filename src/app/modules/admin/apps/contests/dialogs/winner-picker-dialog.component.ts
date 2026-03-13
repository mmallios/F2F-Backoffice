import { CommonModule } from '@angular/common';
import {
    ChangeDetectionStrategy,
    ChangeDetectorRef,
    Component,
    OnDestroy,
    inject,
    signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatTooltipModule } from '@angular/material/tooltip';

import {
    ContestEntryDto,
    ContestsAdminService,
} from '@fuse/services/contests/contests-admin.service';

export interface WinnerPickerDialogData {
    contestId: number;
    entries: ContestEntryDto[];
}

type DrawState = 'idle' | 'drawing' | 'done';

@Component({
    selector: 'app-winner-picker-dialog',
    standalone: true,
    imports: [
        CommonModule,
        ReactiveFormsModule,
        MatButtonModule,
        MatDialogModule,
        MatFormFieldModule,
        MatIconModule,
        MatInputModule,
        MatTooltipModule,
    ],
    templateUrl: './winner-picker-dialog.component.html',
    styles: [`
        .slot-drum {
            transition: background 0.3s;
        }

        .slot-drum.spinning {
            animation: drum-pulse 0.15s ease-in-out infinite alternate;
        }

        .slot-drum.settling {
            animation: drum-settle 0.4s cubic-bezier(.22,.61,.36,1) forwards;
        }

        @keyframes drum-pulse {
            from { transform: scaleY(0.97); opacity: 0.8; }
            to   { transform: scaleY(1.03); opacity: 1; }
        }

        @keyframes drum-settle {
            0%   { transform: translateY(-6px) scale(1.04); opacity: 0.7; }
            60%  { transform: translateY(2px) scale(0.99); opacity: 1; }
            100% { transform: translateY(0) scale(1); opacity: 1; }
        }

        .winner-card {
            animation: winner-in 0.4s cubic-bezier(.22,.61,.36,1) forwards;
        }

        @keyframes winner-in {
            from { transform: translateY(12px) scale(0.95); opacity: 0; }
            to   { transform: translateY(0) scale(1); opacity: 1; }
        }
    `],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WinnerPickerDialogComponent implements OnDestroy {
    private dialogRef = inject(MatDialogRef<WinnerPickerDialogComponent>);
    data: WinnerPickerDialogData = inject(MAT_DIALOG_DATA);
    private api = inject(ContestsAdminService);
    private fb = inject(FormBuilder);
    private cdr = inject(ChangeDetectorRef);

    /** Unique-user eligible entries (not yet winners) */
    eligibleEntries: ContestEntryDto[] = this.buildEligiblePool();

    form = this.fb.group({
        winnerCount: [
            1,
            [
                Validators.required,
                Validators.min(1),
                Validators.max(this.eligibleEntries.length),
            ],
        ],
    });

    state = signal<DrawState>('idle');
    /** Name cycling in the slot drum */
    drumDisplay = signal<string>('');
    /** Drum animation class */
    drumClass = signal<'spinning' | 'settling' | ''>('');
    /** Which winner index is currently being drawn (0-based) */
    currentDrawIndex = signal(0);

    drawnWinners = signal<ContestEntryDto[]>([]);

    saving = signal(false);
    saveError = signal<string | null>(null);

    private drawPool: ContestEntryDto[] = [];
    private timeouts: ReturnType<typeof setTimeout>[] = [];

    private buildEligiblePool(): ContestEntryDto[] {
        const seen = new Set<number>();
        const pool: ContestEntryDto[] = [];
        for (const e of this.data.entries) {
            if (!e.isWinner && !seen.has(e.userId)) {
                seen.add(e.userId);
                pool.push(e);
            }
        }
        return pool;
    }

    get winnerCountValid(): boolean {
        const v = this.form.value.winnerCount ?? 0;
        return v >= 1 && v <= this.eligibleEntries.length;
    }

    startDraw(): void {
        const count = this.form.value.winnerCount ?? 1;
        if (count < 1 || count > this.eligibleEntries.length) return;

        // Shuffle pool
        this.drawPool = this.shuffleArray([...this.eligibleEntries]).slice(0, count);
        this.drawnWinners.set([]);
        this.currentDrawIndex.set(0);
        this.state.set('drawing');
        this.cdr.markForCheck();

        this.drawWinner(0);
    }

    private drawWinner(index: number): void {
        if (index >= this.drawPool.length) {
            // All done
            this.drumClass.set('');
            this.state.set('done');
            this.cdr.markForCheck();
            return;
        }

        const winner = this.drawPool[index];
        this.currentDrawIndex.set(index);
        this.drumClass.set('spinning');
        this.cdr.markForCheck();

        // Spin for ~2.5 seconds with increasing delays (slot slowdown effect)
        const totalFrames = 28;
        let frame = 0;

        const tick = () => {
            frame++;
            const progress = frame / totalFrames;

            if (progress < 1) {
                // Show a random entry name during spin
                const rand = this.eligibleEntries[Math.floor(Math.random() * this.eligibleEntries.length)];
                this.drumDisplay.set(this.entryName(rand));
                this.cdr.markForCheck();

                // Ease delay: starts at 60ms, grows to ~450ms (quadratic easing)
                const delay = Math.round(60 + progress * progress * 390);
                const t = setTimeout(tick, delay);
                this.timeouts.push(t);
            } else {
                // Settle on winner
                this.drumClass.set('settling');
                this.drumDisplay.set(this.entryName(winner));
                this.cdr.markForCheck();

                const t = setTimeout(() => {
                    // Add to winners list and move on
                    this.drawnWinners.update((list) => [...list, winner]);
                    this.cdr.markForCheck();

                    // Short pause before next draw
                    const next = setTimeout(() => this.drawWinner(index + 1), 600);
                    this.timeouts.push(next);
                }, 500);
                this.timeouts.push(t);
            }
        };

        const t = setTimeout(tick, 60);
        this.timeouts.push(t);
    }

    confirmWinners(): void {
        const entryIds = this.drawnWinners().map((e) => e.id);
        this.saving.set(true);
        this.saveError.set(null);

        this.api.markWinners(this.data.contestId, entryIds).subscribe({
            next: () => {
                this.saving.set(false);
                this.dialogRef.close(true);
            },
            error: () => {
                this.saveError.set('Σφάλμα αποθήκευσης νικητών. Δοκιμάστε ξανά.');
                this.saving.set(false);
                this.cdr.markForCheck();
            },
        });
    }

    resetDraw(): void {
        this.clearTimeouts();
        this.drawPool = [];
        this.drawnWinners.set([]);
        this.drumDisplay.set('');
        this.drumClass.set('');
        this.state.set('idle');
        this.saveError.set(null);
        this.cdr.markForCheck();
    }

    close(): void {
        this.clearTimeouts();
        this.dialogRef.close(false);
    }

    entryName(entry: ContestEntryDto): string {
        return entry.user?.fullName?.trim() || entry.user?.email || `#${entry.userId}`;
    }

    entryAvatar(entry: ContestEntryDto): string | null {
        return entry.user?.image ?? null;
    }

    initials(name: string): string {
        return name
            .split(' ')
            .filter(Boolean)
            .slice(0, 2)
            .map((w) => w[0].toUpperCase())
            .join('');
    }

    private shuffleArray<T>(arr: T[]): T[] {
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        return arr;
    }

    private clearTimeouts(): void {
        for (const t of this.timeouts) clearTimeout(t);
        this.timeouts = [];
    }

    ngOnDestroy(): void {
        this.clearTimeouts();
    }
}
