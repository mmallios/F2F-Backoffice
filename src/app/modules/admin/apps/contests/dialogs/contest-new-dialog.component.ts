import { CommonModule } from '@angular/common';
import {
    ChangeDetectionStrategy,
    ChangeDetectorRef,
    Component,
    inject,
    signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';

import { ContestCreateDto, ContestsAdminService } from '@fuse/services/contests/contests-admin.service';

@Component({
    selector: 'app-contest-new-dialog',
    standalone: true,
    imports: [
        CommonModule,
        ReactiveFormsModule,
        MatButtonModule,
        MatDialogModule,
        MatFormFieldModule,
        MatIconModule,
        MatInputModule,
        MatSlideToggleModule,
    ],
    templateUrl: './contest-new-dialog.component.html',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ContestNewDialogComponent {
    private dialogRef = inject(MatDialogRef<ContestNewDialogComponent>);
    private api = inject(ContestsAdminService);
    private fb = inject(FormBuilder);
    private cdr = inject(ChangeDetectorRef);

    saving = signal(false);
    error = signal<string | null>(null);

    form = this.fb.group({
        title: ['', Validators.required],
        description: [''],
        image: [''],
        isActive: [true],
        publishDate: ['', Validators.required],
        startDate: ['', Validators.required],
        endDate: ['', Validators.required],
        maxEntriesPerUser: [1, [Validators.required, Validators.min(1)]],
        maxTotalEntries: [100, [Validators.required, Validators.min(1)]],
        totalWinners: [1 as number | null],
        sendNotificationsToWinners: [true],
    });

    save(): void {
        if (this.form.invalid) return;
        const v = this.form.value;
        const dto: ContestCreateDto = {
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
        this.error.set(null);
        this.api.create(dto).subscribe({
            next: () => {
                this.saving.set(false);
                this.dialogRef.close(true);
            },
            error: () => {
                this.error.set('Σφάλμα δημιουργίας. Δοκιμάστε ξανά.');
                this.saving.set(false);
                this.cdr.markForCheck();
            },
        });
    }

    cancel(): void {
        this.dialogRef.close(false);
    }
}
