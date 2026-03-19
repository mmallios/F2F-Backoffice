import { CommonModule } from '@angular/common';
import {
    ChangeDetectionStrategy,
    ChangeDetectorRef,
    Component,
    ViewChild,
    inject,
    signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatStepperModule, MatStepper } from '@angular/material/stepper';
import { MatDividerModule } from '@angular/material/divider';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { finalize } from 'rxjs';

import { ContestCreateDto, ContestsAdminService } from '@fuse/services/contests/contests-admin.service';
import { ImageUploadService } from '@fuse/services/general/image-upload.service';

type DateMode = 'now' | 'custom';
type EndMode = 'custom' | 'indefinite';

@Component({
    selector: 'contest-wizard-dialog',
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
        MatDatepickerModule,
        MatNativeDateModule,
        MatProgressBarModule,
        MatStepperModule,
        MatDividerModule,
        MatSnackBarModule,
    ],
    templateUrl: './contest-wizard-dialog.component.html',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ContestWizardDialogComponent {
    @ViewChild('stepper') stepper!: MatStepper;
    private snack = inject(MatSnackBar);

    private dialogRef = inject(MatDialogRef<ContestWizardDialogComponent>);
    private api = inject(ContestsAdminService);
    private fb = inject(FormBuilder);
    private cdr = inject(ChangeDetectorRef);
    private imageUpload = inject(ImageUploadService);

    saving = signal(false);
    error = signal<string | null>(null);
    uploading = signal(false);
    imagePreview: string | null = null;

    // Date mode signals
    publishMode = signal<DateMode>('now');
    startMode = signal<DateMode>('custom');
    endMode = signal<EndMode>('custom');

    step1 = this.fb.group({
        title: ['', Validators.required],
        description: [''],
        image: [''],
    });

    step2 = this.fb.group({
        publishDate: [null as Date | null],       // no required — default mode is 'now'
        publishTime: ['00:00'],
        startDate: [null as Date | null, Validators.required],
        startTime: ['00:00'],
        endDate: [null as Date | null, Validators.required],
        endTime: ['00:00'],
        totalWinners: [1],
        maxEntriesPerUser: [1, [Validators.required, Validators.min(1)]],
        maxTotalEntries: [100, [Validators.required, Validators.min(1)]],
        isActive: [true],
        sendNotificationsToWinners: [true],
    });

    // ── Mode setters ─────────────────────────────────────────────
    setPublishMode(mode: DateMode): void {
        this.publishMode.set(mode);
        const dateCtrl = this.step2.get('publishDate')!;
        if (mode === 'now') {
            dateCtrl.clearValidators();
            dateCtrl.setValue(null);
        } else {
            dateCtrl.setValidators(Validators.required);
        }
        dateCtrl.updateValueAndValidity();
        this.cdr.markForCheck();
    }

    setStartMode(mode: DateMode): void {
        this.startMode.set(mode);
        const dateCtrl = this.step2.get('startDate')!;
        if (mode === 'now') {
            dateCtrl.clearValidators();
            dateCtrl.setValue(null);
        } else {
            dateCtrl.setValidators(Validators.required);
        }
        dateCtrl.updateValueAndValidity();
        this.cdr.markForCheck();
    }

    setEndMode(mode: EndMode): void {
        this.endMode.set(mode);
        const dateCtrl = this.step2.get('endDate')!;
        if (mode === 'indefinite') {
            dateCtrl.clearValidators();
            dateCtrl.setValue(null);
        } else {
            dateCtrl.setValidators(Validators.required);
        }
        dateCtrl.updateValueAndValidity();
        this.cdr.markForCheck();
    }

    // ── Summary helpers ──────────────────────────────────────────
    get summaryTitle(): string { return this.step1.value.title || '—'; }
    get summaryDescription(): string { return this.step1.value.description || '—'; }

    get summaryPublishDate(): string {
        if (this.publishMode() === 'now') return 'Τώρα';
        return this.fmtDt(this.step2.value.publishDate, this.step2.value.publishTime!);
    }
    get summaryStartDate(): string {
        if (this.startMode() === 'now') return 'Τώρα';
        return this.fmtDt(this.step2.value.startDate, this.step2.value.startTime!);
    }
    get summaryEndDate(): string {
        if (this.endMode() === 'indefinite') return 'Αόριστου';
        return this.fmtDt(this.step2.value.endDate, this.step2.value.endTime!);
    }

    private fmtDt(date: Date | null | undefined, time: string): string {
        if (!date) return '—';
        const d = new Date(date);
        const [h, m] = (time || '00:00').split(':').map(Number);
        d.setHours(h, m);
        return d.toLocaleDateString('el-GR') + ' ' + d.toLocaleTimeString('el-GR', { hour: '2-digit', minute: '2-digit' });
    }

    private combineDateTime(date: Date | null | undefined, time: string): string {
        const d = date ? new Date(date) : new Date();
        const [h, m] = (time || '00:00').split(':').map(Number);
        d.setHours(h, m, 0, 0);
        return d.toISOString();
    }

    // ── Image upload ─────────────────────────────────────────────
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
            .uploadImage(file, 'contests', 'new')
            .pipe(finalize(() => { this.uploading.set(false); this.cdr.markForCheck(); }))
            .subscribe({
                next: (res) => {
                    this.step1.patchValue({ image: res.publicUrl });
                    this.imagePreview = res.publicUrl;
                    this.cdr.markForCheck();
                },
            });
    }

    removeImage(): void {
        this.step1.patchValue({ image: '' });
        this.imagePreview = null;
        this.cdr.markForCheck();
    }

    // ── Save ─────────────────────────────────────────────────────
    save(): void {
        const v1 = this.step1.value;
        const v2 = this.step2.value;

        const publishDate = this.publishMode() === 'now'
            ? new Date().toISOString()
            : this.combineDateTime(v2.publishDate, v2.publishTime!);

        const startDate = this.startMode() === 'now'
            ? new Date().toISOString()
            : this.combineDateTime(v2.startDate, v2.startTime!);

        const endDate = this.endMode() === 'indefinite'
            ? new Date('2050-01-01T00:00:00').toISOString()
            : this.combineDateTime(v2.endDate, v2.endTime!);

        const dto: ContestCreateDto = {
            title: v1.title!,
            description: v1.description || null,
            image: v1.image || null,
            isActive: v2.isActive!,
            publishDate,
            startDate,
            endDate,
            maxEntriesPerUser: v2.maxEntriesPerUser!,
            maxTotalEntries: v2.maxTotalEntries!,
            totalWinners: v2.totalWinners ?? null,
            sendNotificationsToWinners: v2.sendNotificationsToWinners!,
        };

        this.saving.set(true);
        this.error.set(null);
        this.api.create(dto).subscribe({
            next: (res) => {
                this.saving.set(false);
                this.snack.open('✅ Ο διαγωνισμός δημιουργήθηκε επιτυχώς!', 'ΟΚ', {
                    duration: 3000,
                    horizontalPosition: 'right',
                    verticalPosition: 'bottom',
                    panelClass: ['f2f-toast-success'],
                });
                this.dialogRef.close(res.id);
            },
            error: () => {
                this.error.set('Σφάλμα δημιουργίας. Δοκιμάστε ξανά.');
                this.snack.open('❌ Σφάλμα δημιουργίας. Δοκιμάστε ξανά.', 'ΟΚ', {
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
