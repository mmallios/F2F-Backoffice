import { CommonModule } from '@angular/common';
import {
    ChangeDetectionStrategy,
    ChangeDetectorRef,
    Component,
    OnDestroy,
    OnInit,
    ViewEncapsulation,
    inject,
    signal,
} from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTabsModule } from '@angular/material/tabs';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { Subject, finalize, takeUntil } from 'rxjs';

import { ImageUploadService } from '@fuse/services/general/image-upload.service';
import { AuthService } from 'app/core/auth/auth.service';
import {
    AnnouncementsService,
    AnnouncementDto,
    CreateAnnouncementRequest,
    UpdateAnnouncementRequest,
} from '@fuse/services/announcements/announcements.service';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { QuillModule } from 'ngx-quill';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { DateTime } from 'luxon';

@Component({
    selector: 'announcement-details',
    standalone: true,
    templateUrl: './announcement-details.component.html',
    encapsulation: ViewEncapsulation.None,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        CommonModule,
        ReactiveFormsModule,
        RouterLink,
        MatButtonModule,
        MatIconModule,
        MatTabsModule,
        MatFormFieldModule,
        MatInputModule,
        MatSelectModule,
        MatDatepickerModule,
        MatNativeDateModule,
        QuillModule,
        MatSnackBarModule
    ],
})
export class AnnouncementDetailsComponent implements OnInit, OnDestroy {
    loading = true;

    // when null => create mode
    announcement: AnnouncementDto | null = null;
    isCreate = false;

    uploading = signal(false);
    previewUrl: string | null = null;
    selectedFile: File | null = null;

    form = new FormGroup({
        title: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
        code: new FormControl({ value: '', disabled: true }, { nonNullable: true }),
        message: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
        thumbnail: new FormControl<string | null>(null),

        // ✅ Date object for Datepicker
        publishDate: new FormControl<Date | null>(null),

        status: new FormControl<'published' | 'draft'>('draft', { nonNullable: true }),
        sendPushNotification: new FormControl(false, { nonNullable: true }),
    });

    private _unsubscribeAll = new Subject<void>();


    private _imageUpload = inject(ImageUploadService);
    private _auth = inject(AuthService);

    constructor(
        private _route: ActivatedRoute,
        private _router: Router,
        private _api: AnnouncementsService,
        private _cdr: ChangeDetectorRef,
        private _snack: MatSnackBar
    ) { }

    ngOnInit(): void {
        const idRaw = this._route.snapshot.paramMap.get('id');

        // route like /apps/announcements/create
        if (!idRaw || idRaw === 'create') {
            this.isCreate = true;
            this.loading = false;
            this._cdr.markForCheck();
            return;
        }

        const id = Number(idRaw);
        if (!id) {
            this.loading = false;
            this._cdr.markForCheck();
            return;
        }

        this._api.getById(id)
            .pipe(takeUntil(this._unsubscribeAll))
            .subscribe({
                next: (a) => {
                    this.announcement = a;

                    this.form.patchValue({
                        title: a.title ?? '',
                        code: a.code ?? '',
                        message: a.message ?? '',
                        thumbnail: a.thumbnail ?? null,
                        publishDate: a.publishDate ? new Date(a.publishDate) : null,
                        status: a.status === 1 ? 'published' : 'draft',
                        sendPushNotification: !!a.sendPushNotification,
                    });

                    this.loading = false;
                    this._cdr.markForCheck();
                },
                error: () => {
                    this.announcement = null;
                    this.loading = false;
                    this._cdr.markForCheck();
                },
            });
    }

    ngOnDestroy(): void {
        this._unsubscribeAll.next();
        this._unsubscribeAll.complete();
        if (this.previewUrl?.startsWith('blob:')) URL.revokeObjectURL(this.previewUrl);
    }

    back(): void {
        this._router.navigate(['/apps/announcements']);
    }

    onFileSelected(ev: Event): void {
        const input = ev.target as HTMLInputElement;
        const file = input.files?.[0];
        if (!file) return;

        this.selectedFile = file;
        if (this.previewUrl?.startsWith('blob:')) URL.revokeObjectURL(this.previewUrl);
        this.previewUrl = URL.createObjectURL(file);
        this.uploading.set(true);
        this._cdr.markForCheck();

        this._imageUpload
            .uploadImage(file, 'announcements')
            .pipe(finalize(() => { this.uploading.set(false); this._cdr.markForCheck(); }))
            .subscribe({
                next: (res) => {
                    this.form.controls.thumbnail.setValue(res.publicUrl);
                    this.previewUrl = res.publicUrl;
                    this._cdr.markForCheck();
                },
                error: () => {
                    this._snack.open('Σφάλμα κατά το ανέβασμα εικόνας.', 'OK', { duration: 3000 });
                },
            });
    }

    removeImage(): void {
        this.selectedFile = null;
        if (this.previewUrl?.startsWith('blob:')) URL.revokeObjectURL(this.previewUrl);
        this.previewUrl = null;
        this.form.controls.thumbnail.setValue(null);
        this._cdr.markForCheck();
    }

    private applyStatusToPublishDate(): void {
        const status = this.form.controls.status.value;

        if (status === 'published') {
            if (!this.form.controls.publishDate.value) {
                this.form.controls.publishDate.setValue(new Date());
            }
        } else {
            this.form.controls.publishDate.setValue(null);
        }
    }

    save(): void {
        if (this.form.invalid) return;

        this.applyStatusToPublishDate();

        if (this.isCreate) {
            const payload: CreateAnnouncementRequest = {
                title: this.form.controls.title.value,
                message: this.form.controls.message.value,
                thumbnail: this.form.controls.thumbnail.value,
                createdByBoUserId: this._auth.currentUser?.boUserId ?? null,
            };

            this.loading = true;
            this._cdr.markForCheck();

            this._api.create(payload).subscribe({
                next: (created) => {
                    const publishDateIso = this.form.controls.publishDate.value
                        ? this.form.controls.publishDate.value.toISOString()
                        : null;

                    const extra: UpdateAnnouncementRequest = {
                        title: created.title,
                        code: created.code,
                        message: created.message ?? payload.message,
                        thumbnail: this.form.controls.thumbnail.value,
                        publishDate: publishDateIso,
                        sendPushNotification: this.form.controls.sendPushNotification.value,
                        status: this.form.controls.status.value === 'published' ? 1 : 0,
                    };

                    this._api.update(created.id, extra).subscribe({
                        next: (updated) => {
                            // ✅ stay on same page, switch to edit mode
                            this.announcement = updated;
                            this.isCreate = false;

                            // show code in disabled field (if exists)
                            this.form.controls.code.setValue(updated.code ?? '');

                            // ✅ success toast bottom-right
                            this.toastSuccess('✅ Η ανακοίνωση δημιουργήθηκε επιτυχώς');

                            this.loading = false;
                            this._cdr.markForCheck();
                        },
                        error: () => {
                            // even if PUT fails, we still have created
                            this.announcement = created as any;
                            this.isCreate = false;
                            this.form.controls.code.setValue((created as any)?.code ?? '');

                            this.toastSuccess('✅ Η ανακοίνωση δημιουργήθηκε (μερικά πεδία δεν αποθηκεύτηκαν)');
                            this.loading = false;
                            this._cdr.markForCheck();
                        },
                    });
                },
                error: () => {
                    this.loading = false;
                    this.toastError('❌ Αποτυχία δημιουργίας ανακοίνωσης');
                    this._cdr.markForCheck();
                },
            });

            return;
        }

        if (!this.announcement) return;

        const publishDateIso = this.form.controls.publishDate.value
            ? this.form.controls.publishDate.value.toISOString()
            : null;

        const updatePayload: UpdateAnnouncementRequest = {
            title: this.form.controls.title.value,
            code: this.form.controls.code.value,
            message: this.form.controls.message.value,
            thumbnail: this.form.controls.thumbnail.value,
            publishDate: publishDateIso,
            sendPushNotification: this.form.controls.sendPushNotification.value,
            status: this.form.controls.status.value === 'published' ? 1 : 0,
        };

        this.loading = true;
        this._cdr.markForCheck();

        this._api.update(this.announcement.id, updatePayload).subscribe({
            next: (updated) => {
                this.announcement = updated;
                this.form.controls.code.setValue(updated.code ?? '');
                this.loading = false;

                this.toastSuccess('✅ Οι αλλαγές αποθηκεύτηκαν');
                this._cdr.markForCheck();
            },
            error: () => {
                this.loading = false;
                this.toastError('❌ Αποτυχία αποθήκευσης');
                this._cdr.markForCheck();
            },
        });
    }

    delete(): void {
        if (!this.announcement?.id) return;
        const ok = confirm('Delete this announcement?');
        if (!ok) return;

        this.loading = true;
        this._cdr.markForCheck();

        this._api.delete(this.announcement.id).subscribe({
            next: () => this._router.navigate(['/apps/announcements']),
            error: () => {
                this.loading = false;
                this._cdr.markForCheck();
            },
        });
    }

    // for datepicker binding
    get publishDateAsDate(): Date | null {
        return this.form.controls.publishDate.value;
    }

    onPublishDateChange(d: Date | null): void {
        this.form.controls.publishDate.setValue(d);
    }

    private toastSuccess(message: string): void {
        this._snack.open(message, 'OK', {
            duration: 3000,
            horizontalPosition: 'right',
            verticalPosition: 'bottom',
            panelClass: ['f2f-toast-success'],
        });
    }

    private toastError(message: string): void {
        this._snack.open(message, 'OK', {
            duration: 3500,
            horizontalPosition: 'right',
            verticalPosition: 'bottom',
            panelClass: ['f2f-toast-error'],
        });
    }
}