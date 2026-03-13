import { CommonModule } from '@angular/common';
import {
    ChangeDetectionStrategy,
    ChangeDetectorRef,
    Component,
    OnInit,
    inject,
    signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import {
    MAT_DIALOG_DATA,
    MatDialog,
    MatDialogModule,
    MatDialogRef,
} from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatTooltipModule } from '@angular/material/tooltip';

import {
    ContestDetailsDto,
    ContestUpdateDto,
    ContestsAdminService,
} from '@fuse/services/contests/contests-admin.service';
import { WinnerPickerDialogComponent } from './winner-picker-dialog.component';

export interface ContestDetailsDialogData {
    contestId: number;
}

@Component({
    selector: 'app-contest-details-dialog',
    standalone: true,
    imports: [
        CommonModule,
        ReactiveFormsModule,
        MatButtonModule,
        MatDialogModule,
        MatFormFieldModule,
        MatIconModule,
        MatInputModule,
        MatSelectModule,
        MatSlideToggleModule,
        MatTooltipModule,
    ],
    templateUrl: './contest-details-dialog.component.html',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ContestDetailsDialogComponent implements OnInit {
    private dialogRef = inject(MatDialogRef<ContestDetailsDialogComponent>);
    private data: ContestDetailsDialogData = inject(MAT_DIALOG_DATA);
    private api = inject(ContestsAdminService);
    private dialog = inject(MatDialog);
    private fb = inject(FormBuilder);
    private cdr = inject(ChangeDetectorRef);

    loading = signal(true);
    saving = signal(false);
    editMode = signal(false);
    error = signal<string | null>(null);
    saveError = signal<string | null>(null);

    contest = signal<ContestDetailsDto | null>(null);

    form = this.fb.group({
        title: ['', Validators.required],
        description: [''],
        image: [''],
        isActive: [false],
        publishDate: ['', Validators.required],
        startDate: ['', Validators.required],
        endDate: ['', Validators.required],
        maxEntriesPerUser: [1, [Validators.required, Validators.min(1)]],
        maxTotalEntries: [100, [Validators.required, Validators.min(1)]],
        totalWinners: [1],
        sendNotificationsToWinners: [false],
    });

    ngOnInit(): void {
        this.loadDetails();
    }

    loadDetails(): void {
        this.loading.set(true);
        this.api.getDetails(this.data.contestId).subscribe({
            next: (c) => {
                this.contest.set(c);
                this.patchForm(c);
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

    private patchForm(c: ContestDetailsDto): void {
        this.form.patchValue({
            title: c.title,
            description: c.description ?? '',
            image: c.image ?? '',
            isActive: c.isActive,
            publishDate: this.toDateInputValue(c.publishDate),
            startDate: this.toDateInputValue(c.startDate),
            endDate: this.toDateInputValue(c.endDate),
            maxEntriesPerUser: c.maxEntriesPerUser,
            maxTotalEntries: c.maxTotalEntries,
            totalWinners: c.totalWinners ?? 1,
            sendNotificationsToWinners: c.sendNotificationsToWinners,
        });
    }

    private toDateInputValue(iso: string): string {
        if (!iso) return '';
        return iso.substring(0, 16); // "YYYY-MM-DDTHH:mm"
    }

    toggleEdit(): void {
        if (this.editMode()) {
            // cancel — revert
            const c = this.contest();
            if (c) this.patchForm(c);
            this.saveError.set(null);
        }
        this.editMode.update((v) => !v);
    }

    save(): void {
        if (this.form.invalid) return;
        const v = this.form.value;
        const dto: ContestUpdateDto = {
            title: v.title!,
            description: v.description || null,
            image: v.image || null,
            isActive: v.isActive!,
            publishDate: new Date(v.publishDate!).toISOString(),
            startDate: new Date(v.startDate!).toISOString(),
            endDate: new Date(v.endDate!).toISOString(),
            maxEntriesPerUser: v.maxEntriesPerUser!,
            maxTotalEntries: v.maxTotalEntries!,
            totalWinners: v.totalWinners ?? null,
            sendNotificationsToWinners: v.sendNotificationsToWinners!,
        };

        this.saving.set(true);
        this.saveError.set(null);
        this.api.update(this.data.contestId, dto).subscribe({
            next: () => {
                this.saving.set(false);
                this.editMode.set(false);
                this.loadDetails();
            },
            error: () => {
                this.saveError.set('Σφάλμα αποθήκευσης. Δοκιμάστε ξανά.');
                this.saving.set(false);
                this.cdr.markForCheck();
            },
        });
    }

    openWinnerPicker(): void {
        const c = this.contest();
        if (!c) return;

        const ref = this.dialog.open(WinnerPickerDialogComponent, {
            data: { contestId: c.id, entries: c.entries },
            width: '600px',
            maxWidth: '95vw',
            maxHeight: '92vh',
            disableClose: true,
            panelClass: 'winner-picker-panel',
        });

        ref.afterClosed().subscribe((didPickWinners: boolean) => {
            if (didPickWinners) {
                this.dialogRef.close(true);
            }
        });
    }

    close(): void {
        this.dialogRef.close(false);
    }

    get winnersCount(): number {
        return this.contest()?.entries?.filter((e) => e.isWinner).length ?? 0;
    }

    get entriesCount(): number {
        return this.contest()?.entriesCount ?? 0;
    }
}
