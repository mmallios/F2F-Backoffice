import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, Inject, OnDestroy, OnInit, inject } from '@angular/core';
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
import { finalize, Subject, takeUntil } from 'rxjs';

import { Competition, EventsService } from '@fuse/services/events/events.service';
import { ImageUploadService } from '@fuse/services/general/image-upload.service';
import { FanCardsAdminService, FanCardSeason } from '@fuse/services/fan-cards/fan-cards-admin.service';

type SportOption = { id: number; name: string };

type DialogData =
  | { mode: 'create'; sports: SportOption[] }
  | { mode: 'edit'; competition: Competition; sports: SportOption[] };

@Component({
  selector: 'competition-upsert-dialog',
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
            {{ isEdit ? 'Επεξεργασία διοργάνωσης' : 'Προσθήκη νέας διοργάνωσης' }}
          </div>
          <div class="text-secondary mt-1">
            {{ isEdit ? 'Ενημερώστε τα στοιχεία και αποθηκεύστε τις αλλαγές.' : 'Συμπληρώστε τα στοιχεία για να δημιουργηθεί η διοργάνωση.' }}
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
                <div class="font-semibold">Εικόνα διοργάνωσης</div>
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
            <mat-icon matPrefix class="icon-size-5" [svgIcon]="'heroicons_outline:trophy'"></mat-icon>
            <mat-label>Όνομα</mat-label>
            <input matInput formControlName="name" placeholder="π.χ. Euroleague" />
            <mat-error *ngIf="form.get('name')?.hasError('required')">Απαιτείται</mat-error>
          </mat-form-field>

          <mat-form-field class="fuse-mat-dense fuse-mat-rounded w-full" subscriptSizing="dynamic">
            <mat-icon matPrefix class="icon-size-5" [svgIcon]="'heroicons_outline:identification'"></mat-icon>
            <mat-label>Code</mat-label>
            <input matInput formControlName="code" placeholder="π.χ. EUROLEAGUE" />
          </mat-form-field>

          <mat-form-field class="fuse-mat-dense fuse-mat-rounded w-full" subscriptSizing="dynamic">
            <mat-icon matPrefix class="icon-size-5" [svgIcon]="'heroicons_outline:bolt'"></mat-icon>
            <mat-label>Άθλημα</mat-label>
            <mat-select formControlName="sportId">
              <mat-option *ngFor="let s of sports" [value]="s.id">{{ s.name }}</mat-option>
            </mat-select>
            <mat-error *ngIf="form.get('sportId')?.hasError('required')">Απαιτείται</mat-error>
          </mat-form-field>

          <mat-form-field class="fuse-mat-dense fuse-mat-rounded w-full" subscriptSizing="dynamic">
            <mat-icon matPrefix class="icon-size-5" [svgIcon]="'heroicons_outline:calendar-days'"></mat-icon>
            <mat-label>Σεζόν</mat-label>
            <mat-select formControlName="seasonId">
              <mat-option *ngFor="let s of seasons" [value]="s.id">{{ s.name }}</mat-option>
            </mat-select>
            <mat-error *ngIf="form.get('seasonId')?.hasError('required')">Απαιτείται</mat-error>
          </mat-form-field>

          <mat-form-field class="fuse-mat-dense fuse-mat-rounded w-full" subscriptSizing="dynamic">
            <mat-icon matPrefix class="icon-size-5" [svgIcon]="'heroicons_outline:check-badge'"></mat-icon>
            <mat-label>Ενεργή</mat-label>
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
                (click)="save()" [disabled]="saving || uploading || form.invalid">
          <mat-icon class="mr-2" [svgIcon]="'heroicons_outline:check'"></mat-icon>
          {{ saving ? 'Αποθήκευση...' : (isEdit ? 'Αποθήκευση αλλαγών' : 'Δημιουργία διοργάνωσης') }}
        </button>
      </div>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CompetitionUpsertDialogComponent implements OnInit, OnDestroy {

  saving = false;
  uploading = false;
  imagePreview: string | null = null;
  seasons: FanCardSeason[] = [];
  private readonly _destroy$ = new Subject<void>();
  private readonly _snack = inject(MatSnackBar);

  isEdit = this.data?.mode === 'edit';
  sports: SportOption[] = this.data?.sports ?? [];


  form = this._fb.group({
    id: [0],
    name: ['', Validators.required],
    code: [''],
    sportId: [null as number | null, Validators.required],
    seasonId: [null as number | null, Validators.required],
    isActive: [true],
    image: [''],
  });

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: DialogData,
    private _dialogRef: MatDialogRef<CompetitionUpsertDialogComponent>,
    private _fb: FormBuilder,
    private _imageUpload: ImageUploadService,
    private _eventsService: EventsService,
    private _fanCardsService: FanCardsAdminService,
    private _cdr: ChangeDetectorRef,
  ) {
    if (this.isEdit) {
      const c = (this.data as any).competition as Competition;
      this.form.patchValue({
        id: c.id,
        name: c.name ?? '',
        code: (c as any).code ?? '',
        sportId: c.sportId ?? null,
        seasonId: c.seasonId ?? null,
        isActive: !!c.isActive,
        image: c.image ?? '',
      });
      this.imagePreview = c.image ?? null;
    }
  }

  ngOnInit(): void {
    this._fanCardsService.getSeasons()
      .pipe(takeUntil(this._destroy$))
      .subscribe(seasons => {
        this.seasons = seasons ?? [];
        this._cdr.markForCheck();
      });
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

  save(): void {
    if (this.form.invalid) return;

    this.saving = true;
    const payload: any = { ...this.form.getRawValue() };

    const req$ = this.isEdit
      ? this._eventsService.updateCompetition(payload.id, payload)
      : this._eventsService.createCompetition(payload);

    req$
      .pipe(finalize(() => { this.saving = false; this._cdr.markForCheck(); }))
      .subscribe({
        next: (competition) => {
          this._snack.open(
            this.isEdit ? 'Η διοργάνωση ενημερώθηκε!' : 'Η διοργάνωση δημιουργήθηκε!',
            'OK',
            { duration: 3000, panelClass: ['snack-success'] }
          );
          this._dialogRef.close({ ok: true, competition });
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

    // Upload to server: folder = competitions/{competitionId} or competitions/new
    const compId = this.form.get('id')?.value;
    const subfolder = compId ? String(compId) : 'new';
    this.uploading = true;
    this._cdr.markForCheck();

    this._imageUpload.uploadImage(file, 'competitions', subfolder)
      .pipe(takeUntil(this._destroy$), finalize(() => {
        this.uploading = false;
        this._cdr.markForCheck();
      }))
      .subscribe({
        next: (res) => {
          this.form.patchValue({ image: res.publicUrl });
          this.imagePreview = res.publicUrl;
          this._cdr.markForCheck();
        },
        error: () => { /* preview stays as base64 until retry */ },
      });
  }

}
