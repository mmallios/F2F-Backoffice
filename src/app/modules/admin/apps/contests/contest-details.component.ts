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
import { MatTooltipModule } from '@angular/material/tooltip';
import { Router, RouterModule, ActivatedRoute } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';

import {
    ContestDetailsDto,
    ContestEntryDto,
    ContestsAdminService,
} from '@fuse/services/contests/contests-admin.service';
import { ContestEditDialogComponent } from './dialogs/contest-edit-dialog.component';
import { WinnerPickerDialogComponent } from './dialogs/winner-picker-dialog.component';

@Component({
    selector: 'app-contest-details',
    standalone: true,
    imports: [
        CommonModule,
        RouterModule,
        MatButtonModule,
        MatDialogModule,
        MatIconModule,
        MatTooltipModule,
    ],
    templateUrl: './contest-details.component.html',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ContestDetailsComponent implements OnInit, OnDestroy {
    private route = inject(ActivatedRoute);
    private router = inject(Router);
    private api = inject(ContestsAdminService);
    private dialog = inject(MatDialog);
    private cdr = inject(ChangeDetectorRef);
    private destroy$ = new Subject<void>();

    loading = signal(true);
    deleting = signal(false);
    error = signal<string | null>(null);
    contest = signal<ContestDetailsDto | null>(null);

    contestId!: number;

    ngOnInit(): void {
        this.contestId = Number(this.route.snapshot.paramMap.get('id'));
        this.load();
    }

    load(): void {
        this.loading.set(true);
        this.api.getDetails(this.contestId).subscribe({
            next: (c) => {
                this.contest.set(c);
                this.loading.set(false);
                this.cdr.markForCheck();
            },
            error: () => {
                this.error.set('Σφάλμα φόρτωσης διαγωνισμού.');
                this.loading.set(false);
                this.cdr.markForCheck();
            },
        });
    }

    openEdit(): void {
        const c = this.contest();
        if (!c) return;
        this.dialog
            .open(ContestEditDialogComponent, {
                data: c,
                width: '640px',
                maxWidth: '95vw',
                maxHeight: '90vh',
                disableClose: true,
            })
            .afterClosed()
            .pipe(takeUntil(this.destroy$))
            .subscribe((saved) => { if (saved) this.load(); });
    }

    openWinnerPicker(): void {
        const c = this.contest();
        if (!c) return;
        this.dialog
            .open(WinnerPickerDialogComponent, {
                data: { contestId: c.id, entries: c.entries },
                width: '600px',
                maxWidth: '95vw',
                maxHeight: '92vh',
                disableClose: true,
                panelClass: 'winner-picker-panel',
            })
            .afterClosed()
            .pipe(takeUntil(this.destroy$))
            .subscribe((accepted) => { if (accepted) this.load(); });
    }

    deleteContest(): void {
        const c = this.contest();
        if (!c) return;
        if (!confirm(`Διαγραφή διαγωνισμού "${c.title}";`)) return;
        this.deleting.set(true);
        this.api.delete(c.id).subscribe({
            next: () => this.router.navigate(['/apps/contests']),
            error: () => {
                this.deleting.set(false);
                this.cdr.markForCheck();
            },
        });
    }

    get winners(): ContestEntryDto[] {
        return this.contest()?.entries?.filter((e) => e.isWinner) ?? [];
    }

    get participants(): ContestEntryDto[] {
        return this.contest()?.entries?.filter((e) => !e.isWinner) ?? [];
    }

    entryName(e: ContestEntryDto): string {
        return e.user?.fullName?.trim() || e.user?.email || `#${e.userId}`;
    }

    entryCode(e: ContestEntryDto): string {
        return e.user?.email ? e.user.email : `#${e.userId}`;
    }

    entryAvatar(e: ContestEntryDto): string | null {
        return e.user?.image ?? null;
    }

    initials(name: string): string {
        return name.split(' ').filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('');
    }

    getStatus(): 'active' | 'upcoming' | 'ended' {
        const c = this.contest();
        if (!c) return 'ended';
        const now = new Date();
        if (!c.isActive || new Date(c.endDate) < now) return 'ended';
        if (new Date(c.startDate) > now) return 'upcoming';
        return 'active';
    }

    ngOnDestroy(): void {
        this.destroy$.next();
        this.destroy$.complete();
    }
}
