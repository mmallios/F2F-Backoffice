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
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';

import {
    ContestDetailsDto,
    ContestUpdateDto,
    ContestsAdminService,
} from '@fuse/services/contests/contests-admin.service';

@Component({
    selector: 'app-contest-edit-dialog',
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
    templateUrl: './contest-edit-dialog.component.html',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ContestEditDialogComponent implements OnInit {
    private dialogRef = inject(MatDialogRef<ContestEditDialogComponent>);
    contest: ContestDetailsDto = inject(MAT_DIALOG_DATA);
    private api = inject(ContestsAdminService);
    private fb = inject(FormBuilder);
    private cdr = inject(ChangeDetectorRef);

    saving = signal(false);
    error = signal<string | null>(null);

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
        totalWinners: [1 as number | null],
        sendNotificationsToWinners: [false],
    });

    ngOnInit(): void {
        const c = this.contest;
        this.form.patchValue({
            title: c.title,
            description: c.description ?? '',
            image: c.image ?? '',
            isActive: c.isActive,
            publishDate: c.publishDate?.substring(0, 16) ?? '',
            startDate: c.startDate?.substring(0, 16) ?? '',
            endDate: c.endDate?.substring(0, 16) ?? '',
            maxEntriesPerUser: c.maxEntriesPerUser,
            maxTotalEntries: c.maxTotalEntries,
            totalWinners: c.totalWinners ?? 1,
            sendNotificationsToWinners: c.sendNotificationsToWinners,
        });
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
        this.error.set(null);
        this.api.update(this.contest.id, dto).subscribe({
            next: () => {
                this.saving.set(false);
                this.dialogRef.close(true);
            },
            error: () => {
                this.error.set('Σφάλμα αποθήκευσης. Δοκιμάστε ξανά.');
                this.saving.set(false);
                this.cdr.markForCheck();
            },
        });
    }

    cancel(): void {
        this.dialogRef.close(false);
    }
}
