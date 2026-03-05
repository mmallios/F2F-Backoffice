import { CommonModule } from '@angular/common';
import { Component, Inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';

@Component({
    selector: 'confirm-delete-dialog',
    templateUrl: './confirm-delete-dialog.component.html',
    standalone: true,
    imports: [CommonModule, MatButtonModule, MatIconModule],
})
export class ConfirmDeleteDialogComponent {
    constructor(
        private _ref: MatDialogRef<ConfirmDeleteDialogComponent>,
        @Inject(MAT_DIALOG_DATA)
        public data: { title: string; message: string; confirmText?: string; cancelText?: string }
    ) { }

    cancel(): void {
        this._ref.close(false);
    }

    confirm(): void {
        this._ref.close(true);
    }
}
