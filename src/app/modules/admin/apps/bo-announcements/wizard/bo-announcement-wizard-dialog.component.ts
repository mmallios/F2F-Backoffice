import { CommonModule } from '@angular/common';
import {
    ChangeDetectionStrategy,
    ChangeDetectorRef,
    Component,
    OnInit,
    ViewChild,
    inject,
    signal,
} from '@angular/core';
import { FormBuilder, FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatDividerModule } from '@angular/material/divider';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatStepperModule, MatStepper } from '@angular/material/stepper';
import { finalize } from 'rxjs';

import { AuthService } from 'app/core/auth/auth.service';
import { RolesService, AdminRowDto } from '@fuse/services/roles/roles.service';
import { ImageUploadService } from '@fuse/services/general/image-upload.service';
import {
    BOAnnouncementsService,
    CreateBOAnnouncementRequest,
} from '@fuse/services/announcements/bo-announcements.service';

@Component({
    selector: 'bo-announcement-wizard-dialog',
    standalone: true,
    templateUrl: './bo-announcement-wizard-dialog.component.html',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        CommonModule,
        ReactiveFormsModule,
        MatButtonModule,
        MatCheckboxModule,
        MatDialogModule,
        MatDividerModule,
        MatFormFieldModule,
        MatIconModule,
        MatInputModule,
        MatProgressBarModule,
        MatSelectModule,
        MatDatepickerModule,
        MatNativeDateModule,
        MatSnackBarModule,
        MatStepperModule,
    ],
})
export class BOAnnouncementWizardDialogComponent implements OnInit {
    @ViewChild('stepper') stepper!: MatStepper;

    private _fb = inject(FormBuilder);
    private _cdr = inject(ChangeDetectorRef);
    private _dialogRef = inject(MatDialogRef<BOAnnouncementWizardDialogComponent>);
    private _api = inject(BOAnnouncementsService);
    private _auth = inject(AuthService);
    private _roles = inject(RolesService);
    private _imageUpload = inject(ImageUploadService);
    private _snack = inject(MatSnackBar);

    // ── State ───────────────────────────────────────────────────────────────
    saving = signal(false);
    uploading = signal(false);
    loadingAdmins = signal(false);
    error = signal<string | null>(null);
    imagePreview: string | null = null;
    adminSearch = new FormControl('');

    allAdmins: AdminRowDto[] = [];
    filteredAdmins: AdminRowDto[] = [];
    selectedAdminIds = new Set<number>();

    // ── Forms ────────────────────────────────────────────────────────────────
    step1 = this._fb.group({
        title: ['', Validators.required],
        content: [''],
        imageUrl: [''],
        publishDate: [null as Date | null],
        autoDeleteValue: [null as number | null],
        autoDeleteUnit: ['hours'],
        sendEmailNotification: [false],
    });

    // ── Init ─────────────────────────────────────────────────────────────────
    ngOnInit(): void {
        this._loadAdmins();
        this.adminSearch.valueChanges.subscribe((q) => this._filterAdmins(q ?? ''));
    }

    private _loadAdmins(): void {
        this.loadingAdmins.set(true);
        this._roles.getAdministrators().subscribe({
            next: (admins) => {
                const myId = this._auth.currentUser?.boUserId;
                this.allAdmins = admins.filter((a) => a.boUserId !== myId);
                this.filteredAdmins = [...this.allAdmins];
                this.loadingAdmins.set(false);
                this._cdr.markForCheck();
            },
            error: () => {
                this.loadingAdmins.set(false);
                this._cdr.markForCheck();
            },
        });
    }

    private _filterAdmins(q: string): void {
        const lq = q.trim().toLowerCase();
        this.filteredAdmins = lq
            ? this.allAdmins.filter(
                (a) =>
                    a.fullName?.toLowerCase().includes(lq) ||
                    a.email?.toLowerCase().includes(lq)
            )
            : [...this.allAdmins];
        this._cdr.markForCheck();
    }

    // ── Image upload ─────────────────────────────────────────────────────────
    onFileSelected(ev: Event): void {
        const file = (ev.target as HTMLInputElement).files?.[0];
        if (!file) return;

        this.uploading.set(true);
        this._cdr.markForCheck();

        this._imageUpload
            .uploadImage(file, 'bo-announcements')
            .pipe(finalize(() => { this.uploading.set(false); this._cdr.markForCheck(); }))
            .subscribe({
                next: (res) => {
                    this.step1.patchValue({ imageUrl: res.publicUrl });
                    this.imagePreview = res.publicUrl;
                    this._cdr.markForCheck();
                },
                error: () => {
                    this._snack.open('Σφάλμα κατά το ανέβασμα εικόνας.', 'OK', { duration: 3000 });
                },
            });
    }

    removeImage(): void {
        this.imagePreview = null;
        this.step1.patchValue({ imageUrl: '' });
    }

    // ── Admin selection ───────────────────────────────────────────────────────
    toggleAdmin(id: number): void {
        if (this.selectedAdminIds.has(id)) {
            this.selectedAdminIds.delete(id);
        } else {
            this.selectedAdminIds.add(id);
        }
        this._cdr.markForCheck();
    }

    isSelected(id: number): boolean {
        return this.selectedAdminIds.has(id);
    }

    get allSelected(): boolean {
        return this.filteredAdmins.length > 0 &&
            this.filteredAdmins.every((a) => this.selectedAdminIds.has(a.boUserId));
    }

    toggleSelectAll(): void {
        if (this.allSelected) {
            this.filteredAdmins.forEach((a) => this.selectedAdminIds.delete(a.boUserId));
        } else {
            this.filteredAdmins.forEach((a) => this.selectedAdminIds.add(a.boUserId));
        }
        this._cdr.markForCheck();
    }

    get selectedAdmins(): AdminRowDto[] {
        return this.allAdmins.filter((a) => this.selectedAdminIds.has(a.boUserId));
    }

    // ── AutoDeleteAt helper ───────────────────────────────────────────────────
    private _computeAutoDeleteAt(): string | null {
        const val = this.step1.value.autoDeleteValue;
        const unit = this.step1.value.autoDeleteUnit;
        if (!val || val <= 0) return null;
        const ms = unit === 'days' ? val * 24 * 60 * 60 * 1000
                 : unit === 'hours' ? val * 60 * 60 * 1000
                 : val * 60 * 1000;
        return new Date(Date.now() + ms).toISOString();
    }

    // ── Summary getters ───────────────────────────────────────────────────────
    get summaryTitle(): string { return this.step1.value.title || '—'; }
    get summaryContent(): string { return this.step1.value.content || '—'; }
    get summaryPublishDate(): string {
        const d = this.step1.value.publishDate;
        return d ? new Date(d).toLocaleDateString('el-GR') : '—';
    }
    get summaryAutoDelete(): string {
        const val = this.step1.value.autoDeleteValue;
        const unit = this.step1.value.autoDeleteUnit;
        if (!val || val <= 0) return 'Χωρίς αυτόματη διαγραφή';
        const label = unit === 'days' ? 'μέρες' : unit === 'hours' ? 'ώρες' : 'λεπτά';
        return `${val} ${label}`;
    }
    get summaryEmail(): string {
        return this.step1.value.sendEmailNotification ? 'Ναι' : 'Όχι';
    }

    // ── Create ────────────────────────────────────────────────────────────────
    create(): void {
        if (this.step1.invalid) return;

        const boUserId = this._auth.currentUser?.boUserId;
        if (!boUserId) return;

        const payload: CreateBOAnnouncementRequest = {
            title: this.step1.value.title!,
            content: this.step1.value.content || null,
            imageUrl: this.step1.value.imageUrl || null,
            publishDate: this.step1.value.publishDate
                ? new Date(this.step1.value.publishDate).toISOString()
                : null,
            autoDeleteAt: this._computeAutoDeleteAt(),
            sendEmailNotification: !!this.step1.value.sendEmailNotification,
            createdByBoUserId: boUserId,
            recipientBoUserIds: [...this.selectedAdminIds],
        };

        this.saving.set(true);
        this.error.set(null);
        this._cdr.markForCheck();

        this._api
            .create(payload)
            .pipe(finalize(() => { this.saving.set(false); this._cdr.markForCheck(); }))
            .subscribe({
                next: (created) => {
                    this._snack.open('Η ανακοίνωση δημιουργήθηκε!', 'OK', { duration: 3000 });
                    this._dialogRef.close(created.id);
                },
                error: () => {
                    this.error.set('Σφάλμα κατά τη δημιουργία. Δοκίμασε ξανά.');
                    this._cdr.markForCheck();
                },
            });
    }

    close(): void {
        this._dialogRef.close(null);
    }

    trackByAdminId = (_: number, a: AdminRowDto) => a.boUserId;
}
