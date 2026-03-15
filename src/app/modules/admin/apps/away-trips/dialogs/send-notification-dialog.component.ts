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
import { MatCheckboxModule } from '@angular/material/checkbox';
import { finalize } from 'rxjs/operators';
import { ImageUploadService } from '@fuse/services/general/image-upload.service';
import { AwayTripInterestDto, SendAwayTripNotificationRequest } from '@fuse/services/away-trips/bo-away-trips.service';

@Component({
    selector: 'send-notification-dialog',
    standalone: true,
    imports: [
        CommonModule,
        ReactiveFormsModule,
        MatButtonModule,
        MatCheckboxModule,
        MatDialogModule,
        MatFormFieldModule,
        MatIconModule,
        MatInputModule,
        MatSlideToggleModule,
    ],
    templateUrl: './send-notification-dialog.component.html',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SendNotificationDialogComponent implements OnInit {
    private fb = inject(FormBuilder);
    private cdr = inject(ChangeDetectorRef);
    private dialogRef = inject(MatDialogRef<SendNotificationDialogComponent>);
    private imageUpload = inject(ImageUploadService);
    data = inject<{ interests: AwayTripInterestDto[] }>(MAT_DIALOG_DATA);

    uploading = signal(false);
    imagePreview: string | null = null;

    // User selection
    userSearch = '';
    selectedUserIds = new Set<number>();
    get interests(): AwayTripInterestDto[] { return this.data?.interests ?? []; }
    get filteredInterests(): AwayTripInterestDto[] {
        const q = this.userSearch.toLowerCase().trim();
        if (!q) return this.interests;
        return this.interests.filter(u =>
            u.userFullName.toLowerCase().includes(q) ||
            u.userCode.toLowerCase().includes(q) ||
            u.userEmail.toLowerCase().includes(q),
        );
    }
    get allSelected(): boolean {
        return this.interests.length > 0 && this.interests.every(u => this.selectedUserIds.has(u.userId));
    }
    get someSelected(): boolean {
        return this.selectedUserIds.size > 0 && !this.allSelected;
    }

    form = this.fb.group({
        title: ['', Validators.required],
        description: [''],
        imageUrl: [''],
        sendEmailNotification: [true],
    });

    ngOnInit(): void {
        // Select all users by default
        this.interests.forEach(u => this.selectedUserIds.add(u.userId));
    }

    toggleSelectAll(): void {
        if (this.allSelected) {
            this.selectedUserIds.clear();
        } else {
            this.interests.forEach(u => this.selectedUserIds.add(u.userId));
        }
        this.cdr.markForCheck();
    }

    toggleUser(userId: number): void {
        if (this.selectedUserIds.has(userId)) {
            this.selectedUserIds.delete(userId);
        } else {
            this.selectedUserIds.add(userId);
        }
        this.cdr.markForCheck();
    }

    onSearchChange(value: string): void {
        this.userSearch = value;
        this.cdr.markForCheck();
    }

    triggerFileInput(input: HTMLInputElement): void {
        input.click();
    }

    onFileSelected(ev: Event): void {
        const input = ev.target as HTMLInputElement;
        const file = input.files?.[0];
        input.value = '';
        if (!file || !file.type.startsWith('image/') || file.size > 3 * 1024 * 1024) return;

        const reader = new FileReader();
        reader.onload = () => { this.imagePreview = reader.result as string; this.cdr.markForCheck(); };
        reader.readAsDataURL(file);

        this.uploading.set(true);
        this.imageUpload
            .uploadImage(file, 'away-trips', 'notifications')
            .pipe(finalize(() => { this.uploading.set(false); this.cdr.markForCheck(); }))
            .subscribe({
                next: (res) => {
                    this.form.patchValue({ imageUrl: res.publicUrl });
                    this.imagePreview = res.publicUrl;
                    this.cdr.markForCheck();
                },
            });
    }

    removeImage(): void {
        this.form.patchValue({ imageUrl: '' });
        this.imagePreview = null;
        this.cdr.markForCheck();
    }

    send(): void {
        if (this.form.invalid || this.selectedUserIds.size === 0) return;
        const v = this.form.value;

        // null targetUserIds = all users; otherwise pass specific IDs
        const targetUserIds = this.allSelected
            ? null
            : Array.from(this.selectedUserIds);

        const req: SendAwayTripNotificationRequest = {
            title: v.title!,
            description: v.description || null,
            imageUrl: v.imageUrl || null,
            sendEmailNotification: v.sendEmailNotification ?? true,
            targetUserIds,
        };
        this.dialogRef.close(req);
    }

    cancel(): void {
        this.dialogRef.close(null);
    }
}
