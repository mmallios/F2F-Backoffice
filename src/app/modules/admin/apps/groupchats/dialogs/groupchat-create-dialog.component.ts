import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, Inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatDividerModule } from '@angular/material/divider';
import { finalize } from 'rxjs';

import { GroupChatsService, CreateGroupChatDto } from '@fuse/services/groupchats/groupchats.service';
import { ImageUploadService } from '@fuse/services/general/image-upload.service';

@Component({
    selector: 'groupchat-create-dialog',
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
            Νέο Group Chat
          </div>
          <div class="text-secondary mt-1">
            Συμπληρώστε τα στοιχεία για να δημιουργηθεί το group chat.
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
                <div class="font-semibold">Εικόνα</div>
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

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">

          <mat-form-field class="fuse-mat-dense fuse-mat-rounded w-full" subscriptSizing="dynamic">
            <mat-icon matPrefix class="icon-size-5" [svgIcon]="'heroicons_outline:hashtag'"></mat-icon>
            <mat-label>Code</mat-label>
            <input matInput formControlName="code" placeholder="π.χ. OLY_EURO_2026" />
            <mat-error *ngIf="form.get('code')?.hasError('required')">Απαιτείται</mat-error>
          </mat-form-field>

          <mat-form-field class="fuse-mat-dense fuse-mat-rounded w-full" subscriptSizing="dynamic">
            <mat-icon matPrefix class="icon-size-5" [svgIcon]="'heroicons_outline:chat-bubble-left-right'"></mat-icon>
            <mat-label>Name</mat-label>
            <input matInput formControlName="name" placeholder="π.χ. Ολυμπιακός - Παναθηναϊκός chat" />
            <mat-error *ngIf="form.get('name')?.hasError('required')">Απαιτείται</mat-error>
          </mat-form-field>

          <mat-form-field class="fuse-mat-dense fuse-mat-rounded w-full md:col-span-2" subscriptSizing="dynamic">
            <mat-icon matPrefix class="icon-size-5" [svgIcon]="'heroicons_outline:document-text'"></mat-icon>
            <mat-label>Description</mat-label>
            <textarea matInput rows="3" formControlName="description" placeholder="Περιγραφή..."></textarea>
          </mat-form-field>

          <mat-form-field class="fuse-mat-dense fuse-mat-rounded w-full" subscriptSizing="dynamic">
            <mat-icon matPrefix class="icon-size-5" [svgIcon]="'heroicons_outline:star'"></mat-icon>
            <mat-label>Main</mat-label>
            <mat-select formControlName="isMain">
              <mat-option [value]="true">Main</mat-option>
              <mat-option [value]="false">Normal</mat-option>
            </mat-select>
          </mat-form-field>

          <mat-form-field class="fuse-mat-dense fuse-mat-rounded w-full" subscriptSizing="dynamic">
            <mat-icon matPrefix class="icon-size-5" [svgIcon]="'heroicons_outline:check-badge'"></mat-icon>
            <mat-label>Active</mat-label>
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
          {{ saving ? 'Αποθήκευση...' : 'Δημιουργία' }}
        </button>
      </div>
    </div>
  `,
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GroupChatCreateDialogComponent {
    saving = false;

    uploadingImage = false;
    uploadImageError: string | null = null;

    form = this._fb.group({
        code: ['', Validators.required],
        name: ['', Validators.required],
        description: [''],

        // for now create without eventId (you can add it later)
        eventId: [null as number | null],

        isMain: [false],
        isActive: [true],
        image: [''],
    });

    constructor(
        @Inject(MAT_DIALOG_DATA) public data: any,
        private _dialogRef: MatDialogRef<GroupChatCreateDialogComponent>,
        private _fb: FormBuilder,
        private _service: GroupChatsService,
        private _imageUpload: ImageUploadService
    ) { }

    close(): void {
        this._dialogRef.close(null);
    }

    triggerFileInput(input: HTMLInputElement): void {
        input.click();
    }

    onFileSelected(ev: Event): void {
        const input = ev.target as HTMLInputElement;
        const file = input.files?.[0];
        input.value = '';
        if (!file) return;

        // validation
        const maxMb = 3;
        if (!file.type.startsWith('image/')) {
            this.uploadImageError = 'Επιτρέπονται μόνο εικόνες.';
            return;
        }
        if (file.size > maxMb * 1024 * 1024) {
            this.uploadImageError = `Μέγιστο μέγεθος ${maxMb}MB.`;
            return;
        }

        this.uploadingImage = true;
        this.uploadImageError = null;

        const folder = 'groupchats';

        // ✅ subfolder = code (from form)
        const code = (this.form.value.code || '').trim();
        const subfolder = code || undefined; // if empty, only folder

        this._imageUpload.uploadImage(file, folder, subfolder)
            .pipe(finalize(() => (this.uploadingImage = false)))
            .subscribe({
                next: (res) => {
                    this.form.patchValue({ image: res.publicUrl });
                },
                error: (err) => {
                    console.error('uploadImage failed', err);
                    this.uploadImageError = 'Αποτυχία μεταφόρτωσης εικόνας.';
                },
            });
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
        const payload: CreateGroupChatDto = {
            ...(this.form.getRawValue() as any),
        };

        this._service.create(payload)
            .pipe(finalize(() => (this.saving = false)))
            .subscribe({
                next: () => this._dialogRef.close({ ok: true }),
                error: () => { },
            });
    }
}
