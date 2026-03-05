import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

export type ConfirmDialogData = {
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    icon?: string; // material icon name
};

@Component({
    selector: 'app-confirm-dialog',
    standalone: true,
    imports: [CommonModule, MatDialogModule, MatButtonModule, MatIconModule],
    template: `
    <div class="p-4 sm:p-6">
      <div class="flex items-start gap-3">
        <mat-icon class="mt-1 opacity-80">{{ data.icon || 'help' }}</mat-icon>
        <div class="min-w-0">
          <div class="text-xl font-extrabold tracking-tight">{{ data.title }}</div>
          <div class="text-secondary mt-2 leading-relaxed">
            {{ data.message }}
          </div>
        </div>
      </div>

      <div class="mt-5 flex items-center justify-end gap-2">
        <button mat-stroked-button class="!rounded-xl" (click)="close(false)">
          {{ data.cancelText || 'Άκυρο' }}
        </button>
        <button mat-flat-button color="primary" class="!rounded-xl" (click)="close(true)">
          {{ data.confirmText || 'Επιβεβαίωση' }}
        </button>
      </div>
    </div>
  `,
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConfirmDialogComponent {
    constructor(
        @Inject(MAT_DIALOG_DATA) public data: ConfirmDialogData,
        private ref: MatDialogRef<ConfirmDialogComponent>
    ) { }

    close(v: boolean): void {
        this.ref.close(v);
    }
}