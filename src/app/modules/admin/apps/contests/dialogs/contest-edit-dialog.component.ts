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
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { finalize } from 'rxjs';

import {
    ContestDetailsDto,
    ContestUpdateDto,
    ContestsAdminService,
} from '@fuse/services/contests/contests-admin.service';
import { ImageUploadService } from '@fuse/services/general/image-upload.service';

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
        MatDatepickerModule,
        MatNativeDateModule,
        MatProgressBarModule,
        MatSnackBarModule,
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
    private imageUpload = inject(ImageUploadService);
    private snack = inject(MatSnackBar);

    saving = signal(false);
    error = signal<string | null>(null);
    uploading = signal(false);
    imagePreview: string | null = null;

    form = this.fb.group({
        title: ['', Validators.required],
        description: [''],
        image: [''],
        isActive: [false],
        publishDate: [null as Date | null, Validators.required],
        publishTime: ['00:00'],
        startDate: [null as Date | null, Validators.required],
        startTime: ['00:00'],
        endDate: [null as Date | null, Validators.required],
        endTime: ['00:00'],
        maxEntriesPerUser: [1, [Validators.required, Validators.min(1)]],
        maxTotalEntries: [100, [Validators.required, Validators.min(1)]],
        totalWinners: [1 as number | null],
        sendNotificationsToWinners: [false],
    });

    ngOnInit(): void {
        const c = this.contest;
        const pd = c.publishDate ? new Date(c.publishDate) : null;
        const sd = c.startDate ? new Date(c.startDate) : null;
        const ed = c.endDate ? new Date(c.endDate) : null;
        this.form.patchValue({
            title: c.title,
            description: c.description ?? '',
            image: c.image ?? '',
            isActive: c.isActive,
            publishDate: pd,
            publishTime: pd ? this.toTimeString(pd) : '00:00',
            startDate: sd,
            startTime: sd ? this.toTimeString(sd) : '00:00',
            endDate: ed,
            endTime: ed ? this.toTimeString(ed) : '00:00',
            maxEntriesPerUser: c.maxEntriesPerUser,
            maxTotalEntries: c.maxTotalEntries,
            totalWinners: c.totalWinners ?? 1,
            sendNotificationsToWinners: c.sendNotificationsToWinners,
        });
        this.imagePreview = c.image ?? null;
    }

    private toTimeString(d: Date): string {
        const hh = d.getHours().toString().padStart(2, '0');
        const mm = d.getMinutes().toString().padStart(2, '0');
        return `${hh}:${mm}`;
    }

    private combineDateTime(date: Date | null | undefined, time: string): string {
        const d = date ? new Date(date) : new Date();
        const [h, m] = (time || '00:00').split(':').map(Number);
        d.setHours(h, m, 0, 0);
        return d.toISOString();
    }

    triggerFileInput(input: HTMLInputElement): void {
        input.click();
    }

    onFileSelected(ev: Event): void {
        const input = ev.target as HTMLInputElement;
        const file = input.files?.[0];
        input.value = '';
        if (!file) return;
        if (!file.type.startsWith('image/')) return;
        if (file.size > 3 * 1024 * 1024) return;

        const reader = new FileReader();
        reader.onload = () => {
            this.imagePreview = reader.result as string;
            this.cdr.markForCheck();
        };
        reader.readAsDataURL(file);

        this.uploading.set(true);
        this.imageUpload
            .uploadImage(file, 'contests', String(this.contest.id))
            .pipe(finalize(() => { this.uploading.set(false); this.cdr.markForCheck(); }))
            .subscribe({
                next: (res) => {
                    this.form.patchValue({ image: res.publicUrl });
                    this.imagePreview = res.publicUrl;
                    this.cdr.markForCheck();
                },
            });
    }

    removeImage(): void {
        this.form.patchValue({ image: '' });
        this.imagePreview = null;
        this.cdr.markForCheck();
    }

    save(): void {
        if (this.form.invalid) return;
        const v = this.form.value;
        const dto: ContestUpdateDto = {
            title: v.title!,
            description: v.description || null,
            image: v.image || null,
            isActive: v.isActive!,
            publishDate: this.combineDateTime(v.publishDate, v.publishTime!),
            startDate: this.combineDateTime(v.startDate, v.startTime!),
            endDate: this.combineDateTime(v.endDate, v.endTime!),
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
                this.snack.open('✅ Οι αλλαγές αποθηκεύτηκαν επιτυχώς!', 'ΟΚ', {
                    duration: 3000,
                    horizontalPosition: 'right',
                    verticalPosition: 'bottom',
                    panelClass: ['f2f-toast-success'],
                });
                this.dialogRef.close(true);
            },
            error: () => {
                this.error.set('Σφάλμα αποθήκευσης. Δοκιμάστε ξανά.');
                this.snack.open('❌ Σφάλμα αποθήκευσης. Δοκιμάστε ξανά.', 'ΟΚ', {
                    duration: 4000,
                    horizontalPosition: 'right',
                    verticalPosition: 'bottom',
                    panelClass: ['f2f-toast-error'],
                });
                this.saving.set(false);
                this.cdr.markForCheck();
            },
        });
    }

    cancel(): void {
        this.dialogRef.close(false);
    }
}
