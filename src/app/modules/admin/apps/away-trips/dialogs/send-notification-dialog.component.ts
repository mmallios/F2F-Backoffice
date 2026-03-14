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
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { finalize } from 'rxjs/operators';
import { ImageUploadService } from '@fuse/services/general/image-upload.service';
import { SendAwayTripNotificationRequest } from '@fuse/services/away-trips/bo-away-trips.service';

@Component({
    selector: 'send-notification-dialog',
    standalone: true,
    imports: [
        CommonModule,
        ReactiveFormsModule,
        MatButtonModule,
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

    uploading = signal(false);
    imagePreview: string | null = null;

    form = this.fb.group({
        title: ['', Validators.required],
        description: [''],
        imageUrl: [''],
        sendEmailNotification: [true],
    });

    ngOnInit(): void { }

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
        if (this.form.invalid) return;
        const v = this.form.value;
        const req: SendAwayTripNotificationRequest = {
            title: v.title!,
            description: v.description || null,
            imageUrl: v.imageUrl || null,
            sendEmailNotification: v.sendEmailNotification ?? true,
        };
        this.dialogRef.close(req);
    }

    cancel(): void {
        this.dialogRef.close(null);
    }
}
