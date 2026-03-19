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
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';

import { ContestCreateDto, ContestsAdminService } from '@fuse/services/contests/contests-admin.service';

type DateMode = 'now' | 'custom';
type EndMode = 'custom' | 'indefinite';

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
        MatSelectModule,
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

    // Mode signals — publishDate defaults to 'now', dates not required when mode != 'custom'
    publishMode = signal<DateMode>('now');
    startMode = signal<DateMode>('custom');
    endMode = signal<EndMode>('custom');

    form = this.fb.group({
        title: ['', Validators.required],
        description: [''],
        image: [''],
        isActive: [true],
        publishDate: [''],                          // no required — default mode is 'now'
        startDate: ['', Validators.required],
        endDate: ['', Validators.required],
        maxEntriesPerUser: [1, [Validators.required, Validators.min(1)]],
        maxTotalEntries: [100, [Validators.required, Validators.min(1)]],
        totalWinners: [1 as number | null],
        sendNotificationsToWinners: [true],
    });

    setPublishMode(mode: DateMode): void {
        this.publishMode.set(mode);
        const ctrl = this.form.get('publishDate')!;
        if (mode === 'now') {
            ctrl.clearValidators();
            ctrl.setValue('');
        } else {
            ctrl.setValidators(Validators.required);
        }
        ctrl.updateValueAndValidity();
        this.cdr.markForCheck();
    }

    setStartMode(mode: DateMode): void {
        this.startMode.set(mode);
        const ctrl = this.form.get('startDate')!;
        if (mode === 'now') {
            ctrl.clearValidators();
            ctrl.setValue('');
        } else {
            ctrl.setValidators(Validators.required);
        }
        ctrl.updateValueAndValidity();
        this.cdr.markForCheck();
    }

    setEndMode(mode: EndMode): void {
        this.endMode.set(mode);
        const ctrl = this.form.get('endDate')!;
        if (mode === 'indefinite') {
            ctrl.clearValidators();
            ctrl.setValue('');
        } else {
            ctrl.setValidators(Validators.required);
        }
        ctrl.updateValueAndValidity();
        this.cdr.markForCheck();
    }

    save(): void {
        if (this.form.invalid) return;
        const v = this.form.value;

        const publishDate = this.publishMode() === 'now'
            ? new Date().toISOString()
            : new Date(v.publishDate!).toISOString();

        const startDate = this.startMode() === 'now'
            ? new Date().toISOString()
            : new Date(v.startDate!).toISOString();

        const endDate = this.endMode() === 'indefinite'
            ? new Date('2050-01-01T00:00:00').toISOString()
            : new Date(v.endDate!).toISOString();

        const dto: ContestCreateDto = {
            title: v.title!,
            description: v.description || null,
            image: v.image || null,
            isActive: v.isActive!,
            publishDate,
            startDate,
            endDate,
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
