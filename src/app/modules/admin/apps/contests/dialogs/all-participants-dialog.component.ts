import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, Inject, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ContestEntryDto, ContestsAdminService } from '@fuse/services/contests/contests-admin.service';

@Component({
    selector: 'all-participants-dialog',
    standalone: true,
    imports: [
        CommonModule,
        FormsModule,
        MatDialogModule,
        MatButtonModule,
        MatIconModule,
        MatFormFieldModule,
        MatInputModule,
        MatProgressSpinnerModule,
    ],
    templateUrl: './all-participants-dialog.component.html',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AllParticipantsDialogComponent {
    private api = inject(ContestsAdminService);
    private cdr = inject(ChangeDetectorRef);

    search = '';
    removing = signal<number | null>(null);
    entries = signal<ContestEntryDto[]>([...this.data.entries]);
    private changed = false;

    constructor(
        @Inject(MAT_DIALOG_DATA) public data: { contestId: number; entries: ContestEntryDto[] },
        private dialogRef: MatDialogRef<AllParticipantsDialogComponent>,
    ) { }

    get filteredEntries(): ContestEntryDto[] {
        const q = this.search.toLowerCase().trim();
        if (!q) return this.entries();
        return this.entries().filter(
            (e) =>
                this.entryName(e).toLowerCase().includes(q) ||
                (e.user?.code ?? '').toLowerCase().includes(q) ||
                String(e.id).includes(q),
        );
    }

    removeEntry(entryId: number): void {
        if (!confirm('Αφαίρεση συμμετοχής;')) return;
        this.removing.set(entryId);
        this.api.removeEntry(this.data.contestId, entryId).subscribe({
            next: () => {
                this.entries.update((arr) => arr.filter((e) => e.id !== entryId));
                this.changed = true;
                this.removing.set(null);
                this.cdr.markForCheck();
            },
            error: () => {
                this.removing.set(null);
                this.cdr.markForCheck();
            },
        });
    }

    close(): void {
        this.dialogRef.close(this.changed);
    }

    entryName(e: ContestEntryDto): string {
        return e.user?.fullName?.trim() || e.user?.email || `#${e.userId}`;
    }

    entryCode(e: ContestEntryDto): string {
        return e.user?.code || `#${e.userId}`;
    }

    entryAvatar(e: ContestEntryDto): string | null {
        return e.user?.image ?? null;
    }

    initials(name: string): string {
        return name
            .split(' ')
            .filter(Boolean)
            .slice(0, 2)
            .map((w) => w[0].toUpperCase())
            .join('');
    }
}

