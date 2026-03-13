import { NgClass } from '@angular/common';
import {
    ChangeDetectionStrategy,
    ChangeDetectorRef,
    Component,
    Inject,
    OnInit,
    ViewEncapsulation,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { finalize } from 'rxjs';
import { ImageUploadService } from '@fuse/services/general/image-upload.service';
import { ChatService } from 'app/modules/admin/apps/chat/chat.service';
import { BOAdminContact } from 'app/modules/admin/apps/chat/chat.types';

@Component({
    selector: 'app-new-group-chat-dialog',
    templateUrl: './new-group-chat-dialog.component.html',
    encapsulation: ViewEncapsulation.None,
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: true,
    imports: [
        MatDialogModule,
        MatButtonModule,
        MatIconModule,
        MatFormFieldModule,
        MatInputModule,
        MatCheckboxModule,
        MatProgressSpinnerModule,
        FormsModule,
        NgClass,
    ],
})
export class NewGroupChatDialogComponent implements OnInit {
    groupName = '';
    groupDescription = '';
    contacts: BOAdminContact[] = [];
    selectedIds = new Set<number>();
    saving = false;
    searchQuery = '';

    imagePreview: string | null = null;
    uploadingImage = false;
    uploadImageError: string | null = null;

    constructor(
        private _chatService: ChatService,
        private _imageUpload: ImageUploadService,
        private _cdr: ChangeDetectorRef,
        private _dialogRef: MatDialogRef<NewGroupChatDialogComponent>,
        @Inject(MAT_DIALOG_DATA) public data: { myBoUserId: number },
    ) { }

    ngOnInit(): void {
        this._chatService.adminContacts$
            .subscribe(contacts => {
                this.contacts = contacts;
                this._cdr.markForCheck();
            });
        // Ensure contacts are loaded
        if (!this.contacts.length) {
            this._chatService.loadAdminContacts().subscribe();
        }
    }

    get filteredContacts(): BOAdminContact[] {
        const q = this.searchQuery.toLowerCase();
        return q
            ? this.contacts.filter(c => c.fullName.toLowerCase().includes(q) || c.email?.toLowerCase().includes(q))
            : this.contacts;
    }

    toggleMember(id: number): void {
        if (this.selectedIds.has(id)) {
            this.selectedIds.delete(id);
        } else {
            this.selectedIds.add(id);
        }
    }

    isSelected(id: number): boolean {
        return this.selectedIds.has(id);
    }

    get canCreate(): boolean {
        return this.groupName.trim().length > 0 && this.selectedIds.size > 0 && !this.saving && !this.uploadingImage;
    }

    triggerFileInput(input: HTMLInputElement): void {
        input.click();
    }

    onFileSelected(ev: Event): void {
        const input = ev.target as HTMLInputElement;
        const file = input.files?.[0];
        input.value = '';
        if (!file) return;

        const maxMb = 3;
        if (!file.type.startsWith('image/')) {
            this.uploadImageError = 'Επιτρέπονται μόνο εικόνες.';
            this._cdr.markForCheck();
            return;
        }
        if (file.size > maxMb * 1024 * 1024) {
            this.uploadImageError = `Μέγιστο μέγεθος ${maxMb}MB.`;
            this._cdr.markForCheck();
            return;
        }

        // Instant preview
        const reader = new FileReader();
        reader.onload = () => {
            this.imagePreview = String(reader.result || '');
            this._cdr.markForCheck();
        };
        reader.readAsDataURL(file);

        this.uploadingImage = true;
        this.uploadImageError = null;
        this._imageUpload.uploadImage(file, 'groupchats')
            .pipe(finalize(() => { this.uploadingImage = false; this._cdr.markForCheck(); }))
            .subscribe({
                next: (res) => { this.imagePreview = res.publicUrl; this._cdr.markForCheck(); },
                error: () => { this.uploadImageError = 'Αποτυχία μεταφόρτωσης εικόνας.'; this._cdr.markForCheck(); },
            });
    }

    removeImage(): void {
        this.imagePreview = null;
        this.uploadImageError = null;
        this._cdr.markForCheck();
    }

    create(): void {
        if (!this.canCreate) return;
        this.saving = true;
        this._cdr.markForCheck();

        const memberIds = [...this.selectedIds];
        this._chatService.createGroupChat(
            this.groupName.trim(),
            this.groupDescription.trim() || null,
            memberIds,
            this.imagePreview || null,
        ).subscribe({
            next: () => {
                this.saving = false;
                this._dialogRef.close(true);
            },
            error: () => {
                this.saving = false;
                this._cdr.markForCheck();
            },
        });
    }

    cancel(): void {
        this._dialogRef.close(false);
    }
}
