import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, Inject, OnDestroy } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatDividerModule } from '@angular/material/divider';
import { finalize, Subject } from 'rxjs';

import { EventsService } from '@fuse/services/events/events.service';

type TVChannel = {
    id: number;
    name: string;
    image?: string | null;
    isActive: boolean;
};

type DialogData =
    | { mode: 'create' }
    | { mode: 'edit'; tvChannel: TVChannel };

@Component({
    selector: 'tv-channel-upsert-dialog',
    standalone: true,
    imports: [
        CommonModule,
        ReactiveFormsModule,
        MatDialogModule,
        MatButtonModule,
        MatFormFieldModule,
        MatIconModule,
        MatInputModule,
        MatSelectModule,
        MatDividerModule,
    ],
    template: `
    <div class="p-2 sm:p-4">
      <div class="flex items-start justify-between gap-4">
        <div class="min-w-0">
          <div class="text-2xl sm:text-3xl font-extrabold tracking-tight">
            {{ isEdit ? 'Επεξεργασία καναλιού' : 'Προσθήκη νέου καναλιού' }}
          </div>
          <div class="text-secondary mt-1">
            {{ isEdit ? 'Ενημερώστε τα στοιχεία και αποθηκεύστε τις αλλαγές.' : 'Συμπληρώστε τα στοιχεία για να δημιουργηθεί το κανάλι.' }}
          </div>
        </div>

        <button mat-icon-button (click)="close()">
          <mat-icon [svgIcon]="'heroicons_outline:x-mark'"></mat-icon>
        </button>
      </div>

      <mat-divider class="my-6"></mat-divider>

      <form [formGroup]="form" class="space-y-6">

        <!-- Image uploader -->
        <div class="rounded-2xl border p-4 sm:p-5 bg-gray-50 dark:bg-white/5">
          <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">

            <div class="flex items-center gap-3">
              <div class="h-14 w-14 rounded-full overflow-hidden bg-gray-200 dark:bg-gray-800 flex items-center justify-center">
                <img *ngIf="form.value.image" [src]="form.value.image" class="h-full w-full object-contain" alt="image" />
                <span *ngIf="!form.value.image" class="font-bold uppercase text-gray-700 dark:text-gray-200">
                  {{ (form.value.name?.charAt(0) || '?') }}
                </span>
              </div>

              <div class="min-w-0">
                <div class="font-semibold">Λογότυπο καναλιού</div>
                <div class="text-secondary text-sm">PNG/JPG έως 3MB.</div>
              </div>
            </div>

            <div class="flex items-center gap-2 justify-end">
              <input #fileInput type="file" accept="image/*" class="hidden" (change)="onFileSelected($event)" />

              <button mat-stroked-button class="!rounded-xl" type="button"
                      (click)="triggerFileInput(fileInput)" [disabled]="saving">
                <mat-icon class="mr-2" [svgIcon]="'heroicons_outline:arrow-up-tray'"></mat-icon>
                Μεταφόρτωση
              </button>

              <button *ngIf="form.value.image" mat-button class="!rounded-xl" type="button"
                      (click)="removeImage()" [disabled]="saving">
                <mat-icon class="mr-2" [svgIcon]="'heroicons_outline:trash'"></mat-icon>
                Αφαίρεση
              </button>
            </div>

          </div>
        </div>

        <!-- Fields -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">

          <mat-form-field class="fuse-mat-dense fuse-mat-rounded w-full" subscriptSizing="dynamic">
            <mat-icon matPrefix class="icon-size-5" [svgIcon]="'heroicons_outline:tv'"></mat-icon>
            <mat-label>Όνομα</mat-label>
            <input matInput formControlName="name" placeholder="π.χ. NOVA Sports" />
            <mat-error *ngIf="form.get('name')?.hasError('required')">Απαιτείται</mat-error>
          </mat-form-field>

          <mat-form-field class="fuse-mat-dense fuse-mat-rounded w-full" subscriptSizing="dynamic">
            <mat-icon matPrefix class="icon-size-5" [svgIcon]="'heroicons_outline:check-badge'"></mat-icon>
            <mat-label>Ενεργό</mat-label>
            <mat-select formControlName="isActive">
              <mat-option [value]="true">Active</mat-option>
              <mat-option [value]="false">Inactive</mat-option>
            </mat-select>
          </mat-form-field>

        </div>

      </form>

      <mat-divider class="my-6"></mat-divider>

      <div class="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3">
        <button mat-stroked-button class="!rounded-xl" (click)="close()" [disabled]="saving">Άκυρο</button>

        <button mat-flat-button color="primary" class="!rounded-xl"
                (click)="save()" [disabled]="saving || form.invalid">
          <mat-icon class="mr-2" [svgIcon]="'heroicons_outline:check'"></mat-icon>
          {{ saving ? 'Αποθήκευση...' : (isEdit ? 'Αποθήκευση αλλαγών' : 'Δημιουργία καναλιού') }}
        </button>
      </div>
    </div>
  `,
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TVChannelUpsertDialogComponent implements OnDestroy {

    saving = false;
    private readonly _destroy$ = new Subject<void>();

    isEdit = this.data?.mode === 'edit';

    form = this._fb.group({
        id: [0],
        name: ['', Validators.required],
        isActive: [true],
        image: [''],
    });

    constructor(
        @Inject(MAT_DIALOG_DATA) public data: DialogData,
        private _dialogRef: MatDialogRef<TVChannelUpsertDialogComponent>,
        private _fb: FormBuilder,
        private _eventsService: EventsService
    ) {
        if (this.isEdit) {
            const ch = (this.data as any).tvChannel as TVChannel;
            this.form.patchValue({
                id: ch.id,
                name: ch.name ?? '',
                isActive: !!ch.isActive,
                image: ch.image ?? '',
            });
        }
    }

    ngOnDestroy(): void {
        this._destroy$.next();
        this._destroy$.complete();
    }

    close(): void {
        this._dialogRef.close(null);
    }

    triggerFileInput(input: HTMLInputElement): void {
        input.click();
    }

    onFileSelected(ev: Event): void {
        const input = ev.target as HTMLInputElement;
        const file = input.files?.[0];
        if (file) this.readImageFile(file);
        input.value = '';
    }

    removeImage(): void {
        this.form.patchValue({ image: '' });
    }

    private readImageFile(file: File): void {
        const maxMb = 3;
        if (!file.type.startsWith('image/')) return;
        if (file.size > maxMb * 1024 * 1024) return;

        const reader = new FileReader();
        reader.onload = () => this.form.patchValue({ image: String(reader.result || '') });
        reader.readAsDataURL(file);
    }

    save(): void {
        if (this.form.invalid) return;

        this.saving = true;
        const payload: any = { ...this.form.getRawValue() };

        const req$ = this.isEdit
            ? (this._eventsService as any).updateTVChannel(payload)
            : (this._eventsService as any).createTVChannel(payload);

        req$
            .pipe(finalize(() => (this.saving = false)))
            .subscribe({
                next: () => this._dialogRef.close({ ok: true }),
                error: () => { },
            });
    }
}
