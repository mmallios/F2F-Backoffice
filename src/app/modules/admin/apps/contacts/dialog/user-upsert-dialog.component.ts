import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, Inject, OnDestroy } from '@angular/core';
import { FormBuilder, FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatDividerModule } from '@angular/material/divider';
import { MAT_DATE_FORMATS, MatNativeDateModule } from '@angular/material/core';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatAutocompleteModule } from '@angular/material/autocomplete';

import { finalize, Subject, takeUntil } from 'rxjs';
import { map, startWith } from 'rxjs/operators';

import { User, UsersService } from '@fuse/services/users/users.service';
import { StaticData, StaticDataService } from '@fuse/services/staticdata/static-data.service';
import { ImageUploadService } from '@fuse/services/general/image-upload.service';

type DialogData = { mode: 'create' } | { mode: 'edit'; user: User };

export const DD_MM_YYYY_FORMAT = {
  parse: { dateInput: 'DD/MM/YYYY' },
  display: {
    dateInput: 'dd/MM/yyyy',
    monthYearLabel: 'MMM yyyy',
    dateA11yLabel: 'dd/MM/yyyy',
    monthYearA11yLabel: 'MMMM yyyy',
  },
};

@Component({
  selector: 'user-upsert-dialog',
  standalone: true,
  providers: [{ provide: MAT_DATE_FORMATS, useValue: DD_MM_YYYY_FORMAT }],
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
    MatDatepickerModule,
    MatNativeDateModule,
    MatAutocompleteModule,
  ],
  template: `
    <div class="p-2 sm:p-4">
      <!-- Header -->
      <div class="flex items-start justify-between gap-4">
        <div class="min-w-0">
          <div class="text-2xl sm:text-3xl font-extrabold tracking-tight">
            {{ isEdit ? 'Επεξεργασία χρήστη' : 'Προσθήκη νέου χρήστη' }}
          </div>
          <div class="text-secondary mt-1">
            {{
              isEdit
                ? 'Ενημερώστε τα στοιχεία και αποθηκεύστε τις αλλαγές.'
                : 'Συμπληρώστε τα στοιχεία για να δημιουργηθεί ο χρήστης.'
            }}
          </div>
        </div>

        <button mat-icon-button (click)="close()">
          <mat-icon [svgIcon]="'heroicons_outline:x-mark'"></mat-icon>
        </button>
      </div>

      <mat-divider class="my-6"></mat-divider>

      <!-- Form -->
      <form [formGroup]="form" class="space-y-6">
        <!-- Image uploader -->
        <div class="rounded-2xl border p-4 sm:p-5 bg-gray-50 dark:bg-white/5">
          <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div class="flex items-center gap-3">
              <div
                class="h-14 w-14 rounded-full overflow-hidden bg-gray-200 dark:bg-gray-800 flex items-center justify-center"
              >
                <img
                  *ngIf="form.value.image"
                  [src]="form.value.image"
                  class="h-full w-full object-cover"
                  alt="avatar"
                />
                <span *ngIf="!form.value.image" class="font-bold uppercase text-gray-700 dark:text-gray-200">
                  {{ (form.value.firstname?.charAt(0) || '?') }}
                </span>
              </div>

              <div class="min-w-0">
                <div class="font-semibold">Εικόνα προφίλ</div>
                <div class="text-secondary text-sm">
                  <ng-container *ngIf="uploadingImage">Μεταφόρτωση...</ng-container>
                  <ng-container *ngIf="!uploadingImage">PNG/JPG έως 3MB.</ng-container>
                </div>
              </div>
            </div>

            <div class="flex items-center gap-2 justify-end">
              <input #fileInput type="file" accept="image/*" class="hidden" (change)="onPickFile($event)" />

              <button
                mat-stroked-button
                class="!rounded-xl"
                type="button"
                (click)="triggerFileInput(fileInput)"
                [disabled]="saving || uploadingImage"
              >
                <mat-icon class="mr-2" [svgIcon]="uploadingImage ? 'heroicons_outline:arrow-path' : 'heroicons_outline:arrow-up-tray'" [class.animate-spin]="uploadingImage"></mat-icon>
                {{ uploadingImage ? 'Μεταφόρτωση...' : 'Μεταφόρτωση' }}
              </button>

              <button
                *ngIf="form.value.image"
                mat-button
                class="!rounded-xl"
                type="button"
                (click)="removeImage()"
                [disabled]="saving"
              >
                <mat-icon class="mr-2" [svgIcon]="'heroicons_outline:trash'"></mat-icon>
                Αφαίρεση
              </button>
            </div>
          </div>
        </div>

        <!-- ✅ Grid (3 cols on xl) -->
        <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          <mat-form-field class="fuse-mat-dense fuse-mat-rounded w-full" subscriptSizing="dynamic">
            <mat-icon matPrefix class="icon-size-5" [svgIcon]="'heroicons_outline:user'"></mat-icon>
            <mat-label>Όνομα</mat-label>
            <input matInput formControlName="firstname" placeholder="π.χ. Γιώργος" />
            <mat-error *ngIf="form.get('firstname')?.hasError('required')">Απαιτείται</mat-error>
          </mat-form-field>

          <mat-form-field class="fuse-mat-dense fuse-mat-rounded w-full" subscriptSizing="dynamic">
            <mat-icon matPrefix class="icon-size-5" [svgIcon]="'heroicons_outline:user'"></mat-icon>
            <mat-label>Επώνυμο</mat-label>
            <input matInput formControlName="lastname" placeholder="π.χ. Παπαδόπουλος" />
            <mat-error *ngIf="form.get('lastname')?.hasError('required')">Απαιτείται</mat-error>
          </mat-form-field>

          <mat-form-field class="fuse-mat-dense fuse-mat-rounded w-full" subscriptSizing="dynamic">
            <mat-icon matPrefix class="icon-size-5" [svgIcon]="'heroicons_outline:at-symbol'"></mat-icon>
            <mat-label>Email</mat-label>
            <input matInput formControlName="email" placeholder="π.χ. name@mail.com" />
            <mat-error *ngIf="form.get('email')?.hasError('email')">Μη έγκυρο email</mat-error>
            <mat-error *ngIf="form.get('email')?.hasError('required')">Απαιτείται</mat-error>
          </mat-form-field>

          <mat-form-field class="fuse-mat-dense fuse-mat-rounded w-full" subscriptSizing="dynamic">
            <mat-icon matPrefix class="icon-size-5" [svgIcon]="'heroicons_outline:phone'"></mat-icon>
            <mat-label>Κινητό</mat-label>
            <input matInput formControlName="mobile" placeholder="π.χ. 69XXXXXXXX" />
          </mat-form-field>

          <mat-form-field class="fuse-mat-dense fuse-mat-rounded w-full" subscriptSizing="dynamic">
            <mat-icon matPrefix class="icon-size-5" [svgIcon]="'heroicons_outline:shield-check'"></mat-icon>
            <mat-label>Κατάσταση</mat-label>
            <mat-select formControlName="status">
              <mat-option *ngFor="let s of statusOptions" [value]="s.value">{{ s.label }}</mat-option>
            </mat-select>
          </mat-form-field>

          <mat-form-field class="fuse-mat-dense fuse-mat-rounded w-full" subscriptSizing="dynamic">
            <mat-icon matPrefix class="icon-size-5" [svgIcon]="'heroicons_outline:user'"></mat-icon>
            <mat-label>Φύλο</mat-label>
            <mat-select formControlName="gender">
              <mat-option *ngFor="let g of genderOptions" [value]="g.value">{{ g.label }}</mat-option>
            </mat-select>
          </mat-form-field>

          <mat-form-field class="fuse-mat-dense fuse-mat-rounded w-full" subscriptSizing="dynamic">
            <mat-icon matPrefix class="icon-size-5" [svgIcon]="'heroicons_outline:cake'"></mat-icon>
            <mat-label>Ημερομηνία Γέννησης</mat-label>
            <input matInput [matDatepicker]="birthPicker" formControlName="birthdate" placeholder="dd/mm/yyyy" />
            <mat-datepicker-toggle matSuffix [for]="birthPicker"></mat-datepicker-toggle>
            <mat-datepicker #birthPicker></mat-datepicker>
          </mat-form-field>

          <!-- ✅ Συνδεδεμένο Πρόσωπο -->
          <mat-form-field class="fuse-mat-dense fuse-mat-rounded w-full" subscriptSizing="dynamic">
            <mat-icon matPrefix class="icon-size-5" [svgIcon]="'heroicons_outline:link'"></mat-icon>
            <mat-label>Συνδεδεμένο Πρόσωπο</mat-label>

            <mat-select
              formControlName="linkedPerson"
              [disabled]="usersLoading"
              (openedChange)="onLinkedPersonOpened($event, linkedPersonSearchInput)"
            >
              <mat-select-trigger>
                {{ getLinkedPersonFullname(form.value.linkedPerson) }}
              </mat-select-trigger>

              <mat-option class="!h-auto !py-2" disabled>
                <input
                  #linkedPersonSearchInput
                  matInput
                  [formControl]="linkedPersonSearchCtrl"
                  placeholder="Αναζήτηση..."
                  (click)="$event.stopPropagation()"
                  (keydown)="$event.stopPropagation()"
                />
              </mat-option>

              <mat-option [value]="null">—</mat-option>

              <mat-option *ngFor="let u of (linkedPersonOptions$ | async)" [value]="u.id">
                <div class="flex items-center gap-3 py-1">
                  <div class="h-9 w-9 rounded-full overflow-hidden bg-gray-200 dark:bg-gray-800 flex items-center justify-center shrink-0">
                    <img *ngIf="u.image" [src]="u.image" class="h-full w-full object-cover" alt="avatar" />
                    <span *ngIf="!u.image" class="text-xs font-bold uppercase text-gray-700 dark:text-gray-200">
                      {{ (u.firstname?.charAt(0) || '?') }}
                    </span>
                  </div>

                  <div class="flex flex-col leading-tight min-w-0">
                    <div class="font-medium truncate">{{ u.firstname }} {{ u.lastname }}</div>
                    <div class="text-secondary text-xs truncate">{{ u.code }}</div>
                  </div>
                </div>
              </mat-option>
            </mat-select>
          </mat-form-field>

          <!-- ✅ Συνδεδεμένο Άτομο (Autocomplete searchable) -->
          <mat-form-field class="fuse-mat-dense fuse-mat-rounded w-full" subscriptSizing="dynamic">
            <mat-icon matPrefix class="icon-size-5" [svgIcon]="'heroicons_outline:user-circle'"></mat-icon>
            <mat-label>Συνδεδεμένο Άτομο</mat-label>

            <input
              matInput
              type="text"
              formControlName="linkedUser"
              [matAutocomplete]="linkedAuto"
              [placeholder]="usersLoading ? 'Φόρτωση χρηστών...' : 'Αναζήτηση χρήστη...'"
            />

            <mat-autocomplete
              #linkedAuto="matAutocomplete"
              [displayWith]="userDisplay"
              (optionSelected)="onLinkedUserSelected($event.option.value)"
            >
              <mat-option *ngIf="!usersLoading && (filteredUsers$ | async)?.length === 0" [disabled]="true">
                Δεν βρέθηκαν χρήστες
              </mat-option>

              <mat-option *ngFor="let u of (filteredUsers$ | async)" [value]="u">
                <div class="flex flex-col leading-tight">
                  <div class="font-medium">{{ u.firstname }} {{ u.lastname }}</div>
                  <div class="text-secondary text-xs">{{ u.email }}</div>
                </div>
              </mat-option>
            </mat-autocomplete>
          </mat-form-field>

          <!-- ✅ StaticData dropdowns -->
          <mat-form-field class="fuse-mat-dense fuse-mat-rounded w-full" subscriptSizing="dynamic">
            <mat-icon matPrefix class="icon-size-5" [svgIcon]="'heroicons_outline:map'"></mat-icon>
            <mat-label>Χώρα</mat-label>
            <mat-select formControlName="countryId" [disabled]="loadingStatic">
              <mat-option [value]="null">—</mat-option>
              <mat-option *ngFor="let c of countries" [value]="toNumber(c.id)">{{ c.name }}</mat-option>
            </mat-select>
          </mat-form-field>

          <mat-form-field class="fuse-mat-dense fuse-mat-rounded w-full" subscriptSizing="dynamic">
            <mat-icon matPrefix class="icon-size-5" [svgIcon]="'heroicons_outline:map-pin'"></mat-icon>
            <mat-label>Νομός</mat-label>
            <mat-select formControlName="regionId" [disabled]="loadingStatic">
              <mat-option [value]="null">—</mat-option>
              <mat-option *ngFor="let r of regions" [value]="toNumber(r.id)">{{ r.name }}</mat-option>
            </mat-select>
          </mat-form-field>

          <mat-form-field class="fuse-mat-dense fuse-mat-rounded w-full" subscriptSizing="dynamic">
            <mat-icon matPrefix class="icon-size-5" [svgIcon]="'heroicons_outline:map-pin'"></mat-icon>
            <mat-label>Πόλη</mat-label>
            <mat-select formControlName="cityId" [disabled]="loadingStatic">
              <mat-option [value]="null">—</mat-option>
              <mat-option *ngFor="let c of cities" [value]="toNumber(c.id)">{{ c.name }}</mat-option>
            </mat-select>
          </mat-form-field>

          <mat-form-field class="fuse-mat-dense fuse-mat-rounded w-full" subscriptSizing="dynamic">
            <mat-icon matPrefix class="icon-size-5" [svgIcon]="'heroicons_outline:squares-2x2'"></mat-icon>
            <mat-label>Πόλη/Περιοχή</mat-label>
            <input matInput formControlName="area" placeholder="π.χ. Κέντρο" />
          </mat-form-field>

          <!-- ✅ Social Media (platform) -->
          <mat-form-field class="fuse-mat-dense fuse-mat-rounded w-full" subscriptSizing="dynamic">
            <mat-icon matPrefix class="icon-size-5" [svgIcon]="'heroicons_outline:share'"></mat-icon>
            <mat-label>Social Media</mat-label>

            <mat-select formControlName="socialMediaPlatform">
              <mat-option [value]="null">—</mat-option>

              <mat-option *ngFor="let p of socialPlatformOptions" [value]="p.value">
                <div class="flex items-center gap-3">
                  <i class="{{ p.icon }} text-base"></i>
                  <span>{{ p.label }}</span>
                </div>
              </mat-option>
            </mat-select>
          </mat-form-field>

          <mat-form-field class="fuse-mat-dense fuse-mat-rounded w-full" subscriptSizing="dynamic">
            <mat-icon matPrefix class="icon-size-5" [svgIcon]="'heroicons_outline:at-symbol'"></mat-icon>
            <mat-label>Λογαριασμός social</mat-label>
            <input matInput formControlName="socialMediaAccount" placeholder="π.χ. @username ή link" />
          </mat-form-field>
        </div>
      </form>

      <mat-divider class="my-6"></mat-divider>

      <!-- Footer -->
      <div class="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3">
        <button mat-stroked-button class="!rounded-xl" (click)="close()" [disabled]="saving">Άκυρο</button>

        <div class="flex items-center gap-3 justify-end">
          <button mat-flat-button color="primary" class="!rounded-xl" (click)="save()" [disabled]="saving || form.invalid">
            <mat-icon class="mr-2" [svgIcon]="'heroicons_outline:check'"></mat-icon>
            {{ saving ? 'Αποθήκευση...' : (isEdit ? 'Αποθήκευση αλλαγών' : 'Δημιουργία χρήστη') }}
          </button>
        </div>
      </div>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UserUpsertDialogComponent implements OnDestroy {
  saving = false;
  loadingStatic = true;

  usersLoading = true;
  users: User[] = [];

  // ✅ use options from UsersService
  socialPlatformOptions = this._usersService.socialPlatformOptions;

  private readonly _destroy$ = new Subject<void>();

  isEdit = this.data?.mode === 'edit';

  uploadingImage = false;
  uploadImageError: string | null = null;

  countries: StaticData[] = [];
  regions: StaticData[] = [];
  cities: StaticData[] = [];

  genderOptions = [
    { value: 1, label: 'Άντρας' },
    { value: 2, label: 'Γυναίκα' },
  ];

  statusOptions = [
    { value: 0, label: 'Σε αναμονή έγκρισης' },
    { value: 1, label: 'Ημι-ενεργός' },
    { value: 2, label: 'Ενεργός' },
    { value: 3, label: 'Ανενεργός' },
    { value: 5, label: 'Απορρίφθηκε' },
    { value: 6, label: 'Διαγράφηκε' },
    { value: 7, label: 'Αποκλεισμένος' },
    { value: 8, label: 'Κλειδωμένος' },
    { value: 9, label: 'Αρχειοθετημένος' },
  ];

  linkedPersonSearchCtrl = new FormControl<string>('', { nonNullable: true });

  form = this._fb.group({
    id: [null as number | null],
    keycloakId: [''],
    code: [''],
    firstname: ['', Validators.required],
    lastname: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
    mobile: [''],
    points: [0],
    status: [0],
    image: [''],
    gender: [null as number | null],
    countryId: [null as number | null],
    regionId: [null as number | null],
    cityId: [null as number | null],
    area: [''],
    birthdate: [null as Date | null],
    amka: [''],

    // ✅ renamed
    socialMediaPlatform: [null as number | null],
    socialMediaAccount: [''],

    linkedPerson: [null as number | null],
    linkedUser: [null as User | string | null],
  });

  linkedPersonOptions$ = this.linkedPersonSearchCtrl.valueChanges.pipe(
    startWith(''),
    map((q) => this.filterUsers(q || ''))
  );

  filteredUsers$ = this.form.controls.linkedUser.valueChanges.pipe(
    startWith(this.form.controls.linkedUser.value),
    map((value) => {
      const text =
        typeof value === 'string'
          ? value
          : value
            ? `${value.firstname ?? ''} ${value.lastname ?? ''} ${value.email ?? ''}`
            : '';
      return this.filterUsers(text || '');
    })
  );

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: DialogData,
    private _dialogRef: MatDialogRef<UserUpsertDialogComponent>,
    private _fb: FormBuilder,
    private _cdr: ChangeDetectorRef,
    private _usersService: UsersService,
    private _staticDataService: StaticDataService,
    private _imageUpload: ImageUploadService
  ) {
    this._usersService
      .loadUsers()
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: (users) => {
          this.users = (users ?? []).slice();
          this.usersLoading = false;
        },
        error: () => {
          this.users = [];
          this.usersLoading = false;
        },
      });

    this._staticDataService
      .loadAll()
      .pipe(takeUntil(this._destroy$))
      .subscribe({
        next: (all) => {
          const items = all ?? [];
          this.countries = items.filter((x) => this.normalizeDomain(x.domain) === 'country').sort(this.byOrder);
          this.regions = items.filter((x) => this.normalizeDomain(x.domain) === 'region').sort(this.byOrder);
          this.cities = items.filter((x) => this.normalizeDomain(x.domain) === 'city').sort(this.byOrder);

          this.loadingStatic = false;

          if (this.isEdit) {
            const u: any = (this.data as any).user;

            this.form.patchValue({
              id: this.toNumber(u.id),
              keycloakId: u.keycloakId ?? '',
              code: u.code ?? '',
              firstname: u.firstname ?? '',
              lastname: u.lastname ?? '',
              email: u.email ?? '',
              mobile: u.mobile ?? '',
              points: Number(u.points ?? 0),
              status: Number(u.status ?? 0),
              image: u.image ?? '',
              countryId: this.toNumber(u.countryId),
              regionId: this.toNumber(u.regionId),
              cityId: this.toNumber(u.cityId),
              area: u.area ?? '',
              birthdate: u.birthdate ? new Date(u.birthdate) : null,

              // ✅ patch renamed value
              socialMediaPlatform: this.toNumber(u.socialMediaPlatform),
              socialMediaAccount: u.socialMediaAccount ?? '',

              amka: u.amka ?? u.AMKA ?? '',
              gender: this.toNumber(u.genderId ?? u.GenderId ?? u.gender ?? u.genderId),

              linkedPerson: this.toNumber(u.linkedPersonId ?? u.linkedPerson ?? u.LinkedPersonId),
              linkedUser: u.linkedUser ?? null,
            });
          }
        },
        error: () => {
          this.loadingStatic = false;
        },
      });
  }

  ngOnDestroy(): void {
    this._destroy$.next();
    this._destroy$.complete();
  }

  close(): void {
    this._dialogRef.close(null);
  }

  onLinkedPersonOpened(open: boolean, inputEl?: HTMLInputElement): void {
    if (!open) return;
    this.linkedPersonSearchCtrl.setValue('');
    setTimeout(() => inputEl?.focus(), 0);
  }

  userDisplay = (u: User | string | null): string => {
    if (!u) return '';
    if (typeof u === 'string') return u;
    const name = `${(u.firstname || '').trim()} ${(u.lastname || '').trim()}`.trim();
    return name || (u as any).email || '';
  };

  onLinkedUserSelected(u: User): void {
    this.form.patchValue({ linkedUser: u });
  }

  private filterUsers(query: string): User[] {
    const q = (query || '').trim().toLowerCase();
    if (!q) return this.users.slice(0, 50);

    return this.users
      .filter((u: any) => {
        const full = `${u.firstname ?? ''} ${u.lastname ?? ''} ${(u.email ?? '')}`.toLowerCase();
        return full.includes(q);
      })
      .slice(0, 50);
  }

  triggerFileInput(input: HTMLInputElement): void {
    input.click();
  }

  onPickFile(ev: Event): void {
    const input = ev.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;

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

    const folder = 'users';
    const subFolder = this.isEdit ? (this.data as any).user?.code : null;

    this._imageUpload
      .uploadImage(file, folder, subFolder)
      .pipe(finalize(() => { this.uploadingImage = false; this._cdr.markForCheck(); }))
      .subscribe({
        next: (res) => {
          this.form.patchValue({ image: res.publicUrl });
          this._cdr.markForCheck();
        },
        error: (err) => {
          console.error('uploadImage failed', err);
          this.uploadImageError = 'Αποτυχία μεταφόρτωσης εικόνας.';
          this._cdr.markForCheck();
        },
      });
  }

  removeImage(): void {
    this.form.patchValue({ image: '' });
  }

  save(): void {
    if (this.form.invalid) return;

    this.saving = true;
    const raw = this.form.getRawValue();
    const linkedUserObj = typeof raw.linkedUser === 'object' && raw.linkedUser ? (raw.linkedUser as any) : null;

    const payload: any = {
      ...(this.isEdit ? { id: raw.id } : {}),
      keycloakId: raw.keycloakId || null,
      code: (raw.code || '').trim() || this.generateCode(raw.firstname, raw.lastname),
      firstname: raw.firstname?.trim(),
      lastname: raw.lastname?.trim(),
      email: raw.email?.trim(),
      mobile: raw.mobile?.trim() || null,
      points: Number(raw.points ?? 0),
      status: Number(raw.status ?? 0),
      isActive: true,
      image: raw.image || null,
      countryId: raw.countryId ?? null,
      regionId: raw.regionId ?? null,
      cityId: raw.cityId ?? null,
      area: raw.area?.trim() || null,
      birthdate: raw.birthdate ? new Date(raw.birthdate).toISOString() : null,
      genderId: raw.gender ?? null,

      // ✅ renamed in payload
      socialMediaPlatform: raw.socialMediaPlatform ?? null,
      socialMediaAccount: raw.socialMediaAccount?.trim() || null,

      amka: raw.amka?.trim() || null,
      linkedPersonId: raw.linkedPerson ?? null,
      linkedUserId: linkedUserObj?.id ? Number(linkedUserObj.id) : null,
    };

    if (!payload.linkedUserId) delete payload.linkedUserId;
    if (!payload.linkedPersonId) delete payload.linkedPersonId;

    const req$ = this.isEdit
      ? this._usersService.updateUser((this.data as any).user.id, payload)
      : this._usersService.createUser(payload);

    req$
      .pipe(finalize(() => (this.saving = false)))
      .subscribe({
        next: () => this._dialogRef.close({ ok: true }),
        error: () => { },
      });
  }

  private byOrder = (a: StaticData, b: StaticData) => (a.order ?? 0) - (b.order ?? 0);

  private normalizeDomain(d: string) {
    return (d || '').trim().toLowerCase();
  }

  toNumber(v: any): number | null {
    if (v === null || v === undefined || v === '') return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }

  private generateCode(firstname?: string | null, lastname?: string | null): string {
    const f = (firstname || '').trim().toUpperCase();
    const l = (lastname || '').trim().toUpperCase();
    const stamp = Date.now().toString().slice(-6);
    return `${(f[0] || 'U')}${(l[0] || 'S')}-${stamp}`;
  }

  getLinkedPersonFullname(id: number | null): string {
    if (!id) return '';
    const user = this.users.find((u) => Number(u.id) === Number(id));
    if (!user) return '';
    return `${user.firstname ?? ''} ${user.lastname ?? ''}`.trim();
  }
}