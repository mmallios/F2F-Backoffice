import { CommonModule } from '@angular/common';
import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

@Component({
    selector: 'confirm-delete-user-card-dialog',
    standalone: true,
    imports: [CommonModule, MatButtonModule, MatIconModule],
    template: `
  <div class="p-6">
    <div class="flex items-center gap-3 mb-4">
      <div class="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center">
        <mat-icon class="text-red-600">delete</mat-icon>
      </div>

      <div class="min-w-0">
        <div class="text-xl font-bold">{{ data.title }}</div>
        <div class="text-secondary text-sm">{{ data.message }}</div>
      </div>
    </div>

    <div class="flex justify-end gap-2 mt-6">
      <button mat-button type="button" (click)="ref.close(false)">{{ data.cancelText || 'Ακύρωση' }}</button>
      <button mat-flat-button color="warn" type="button" (click)="ref.close(true)">
        {{ data.confirmText || 'Διαγραφή' }}
      </button>
    </div>
  </div>
  `,
})
export class ConfirmDeleteUserCardDialogComponent {
    constructor(
        public ref: MatDialogRef<ConfirmDeleteUserCardDialogComponent>,
        @Inject(MAT_DIALOG_DATA)
        public data: { title: string; message: string; confirmText?: string; cancelText?: string }
    ) { }
}
