import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, Inject, OnDestroy, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatDividerModule } from '@angular/material/divider';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { finalize, Subject } from 'rxjs';

import { TvChannel, UpdateTVChannelDto, EventsService } from '@fuse/services/events/events.service';
import { ImageUploadService } from '@fuse/services/general/image-upload.service';

type DialogData =
  | { mode: 'create' }
  | { mode: 'edit'; tvChannel: TvChannel };

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
    MatProgressBarModule,
    MatSnackBarModule,
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
              <div class="h-14 w-14 rounded-xl overflow-hidden bg-gray-200 dark:bg-gray-800 flex items-center justify-center">
                <img *ngIf="imagePreview" [src]="imagePreview" class="h-full w-full object-contain" alt="image" />
                <span *ngIf="!imagePreview" class="font-bold uppercase text-gray-700 dark:text-gray-200">
                  {{ (form.get('name')?.value?.charAt(0) || '?') }}
                </span>
              </div>

              <div class="min-w-0">
                <div class="font-semibold">Λογότυπο καναλιού</div>
                <div class="text-secondary text-sm">
                  <ng-container *ngIf="uploading">Μεταφόρτωση...</ng-container>
                  <ng-container *ngIf="!uploading">PNG/JPG έως 3MB.</ng-container>
                </div>
                <mat-progress-bar *ngIf="uploading" mode="indeterminate" class="mt-1 w-32"></mat-progress-bar>
              </div>
            </div>

            <div class="flex items-center gap-2 justify-end">
              <input #fileInput type="file" accept="image/*" class="hidden" (change)="onFileSelected($event)" />

              <button mat-stroked-button class="!rounded-xl" type="button"
                      (click)="triggerFileInput(fileInput)" [disabled]="saving || uploading">
                <mat-icon class="mr-2" [svgIcon]="'heroicons_outline:arrow-up-tray'"></mat-icon>
                Μεταφόρτωση
              </button>

              <button *ngIf="imagePreview" mat-button class="!rounded-xl" type="button"
                      (click)="removeImage()" [disabled]="saving || uploading">
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
            <mat-icon matPrefix class="icon-size-5" [svgIcon]="'heroicons_outline:identification'"></mat-icon>
            <mat-label>Code</mat-label>
            <input matInput formControlName="code" placeholder="π.χ. NOVA_SPORTS" />
          </mat-form-field>

          <mat-form-field class="fuse-mat-dense fuse-mat-rounded w-full md:col-span-2" subscriptSizing="dynamic">
            <mat-icon matPrefix class="icon-size-5" [svgIcon]="'heroicons_outline:link'"></mat-icon>
            <mat-label>Stream URL</mat-label>
            <input matInput formControlName="streamUrl" placeholder="π.χ. https://stream.example.com/live" />
          </mat-form-field>

          <mat-form-field class="fuse-mat-dense fuse-mat-rounded w-full" subscriptSizing="dynamic">
            <mat-icon matPrefix class="icon-size-5" [svgIcon]="'heroicons_outline:check-badge'"></mat-icon>
            <mat-label>Δημοσιευμένο</mat-label>
            <mat-select formControlName="isPublished">
              <mat-option [value]="true">Δημοσιευμένο</mat-option>
              <mat-option [value]="false">Μη δημοσιευμένο</mat-option>
            </mat-select>
          </mat-form-field>

        </div>

      </form>

      <mat-divider class="my-6"></mat-divider>

      <div class="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3">
        <button mat-stroked-button class="!rounded-xl" (click)="close()" [disabled]="saving">Άκυρο</button>

        <button mat-flat-button color="primary" class="!rounded-xl"
                (click)="save()" [disabled]="saving || uploading || form.invalid">
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
  uploading = false;
  imagePreview: string | null = null;
  private readonly _destroy$ = new Subject<void>();
  private readonly _snack = inject(MatSnackBar);

  isEdit = this.data?.mode === 'edit';

  form = this._fb.group({
    id: [0],
    name: ['', Validators.required],
    code: [''],
    streamUrl: [''],
    isPublished: [true],
    image: [''],
  });

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: DialogData,
    private _dialogRef: MatDialogRef<TVChannelUpsertDialogComponent>,
    private _fb: FormBuilder,
    private _imageUpload: ImageUploadService,
    private _eventsService: EventsService,
    private _cdr: ChangeDetectorRef,
  ) {
    if (this.isEdit) {
      const ch = (this.data as any).tvChannel as TvChannel;
      this.form.patchValue({
        id: ch.id,
        name: ch.name ?? '',
        code: ch.code ?? '',
        streamUrl: ch.streamUrl ?? '',
        isPublished: !!ch.isPublished,
        image: ch.image ?? '',
      });
      this.imagePreview = ch.image ?? null;
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

  removeImage(): void {
    this.form.patchValue({ image: '' });
    this.imagePreview = null;
    this._cdr.markForCheck();
  }

  onFileSelected(ev: Event): void {
    const input = ev.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;

    if (!file.type.startsWith('image/')) return;
    if (file.size > 3 * 1024 * 1024) return;

    // Instant preview via FileReader
    const reader = new FileReader();
    reader.onload = () => {
      this.imagePreview = reader.result as string;
      this._cdr.markForCheck();
    };
    reader.readAsDataURL(file);

    // Upload to server: folder = tvchannels/{channelId} or tvchannels/new
    const chId = this.form.get('id')?.value;
    const subfolder = chId ? String(chId) : 'new';
    this.uploading = true;
    this._cdr.markForCheck();

    this._imageUpload.uploadImage(file, 'tvchannels', subfolder).subscribe({
      next: (res) => {
        this.form.patchValue({ image: res.publicUrl });
        this.imagePreview = res.publicUrl;
        this.uploading = false;
        this._cdr.markForCheck();
      },
      error: () => {
        this.uploading = false;
        this._cdr.markForCheck();
        this._snack.open('Σφάλμα κατά τη μεταφόρτωση εικόνας.', 'OK', { duration: 4000 });
      },
    });
  }

  save(): void {
    if (this.form.invalid) return;

    this.saving = true;
    const payload = this.form.getRawValue() as UpdateTVChannelDto;

    const req$ = this.isEdit
      ? this._eventsService.updateTVChannel(payload)
      : this._eventsService.createTVChannel(payload);

    req$
      .pipe(finalize(() => { this.saving = false; this._cdr.markForCheck(); }))
      .subscribe({
        next: (tvChannel) => {
          this._snack.open(
            this.isEdit ? 'Το κανάλι ενημερώθηκε!' : 'Το κανάλι δημιουργήθηκε!',
            'OK',
            { duration: 3000, panelClass: ['snack-success'] }
          );
          this._dialogRef.close({ ok: true, tvChannel });
        },
        error: () => {
          this._snack.open(
            'Σφάλμα κατά την αποθήκευση. Δοκιμάστε ξανά.',
            'OK',
            { duration: 4000, panelClass: ['snack-error'] }
          );
        },
      });
  }
}

