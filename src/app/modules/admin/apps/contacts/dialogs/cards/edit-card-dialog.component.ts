import { CommonModule } from '@angular/common';
import { Component, Inject, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';

import { UserCard } from '@fuse/services/users/users.service';

@Component({
    selector: 'edit-user-card-dialog',
    standalone: true,
    imports: [
        CommonModule,
        ReactiveFormsModule,
        MatButtonModule,
        MatFormFieldModule,
        MatInputModule,
        MatSelectModule,
    ],
    template: `
  <div class="p-6">
    <div class="text-xl font-bold mb-1">Επεξεργασία Κάρτας</div>
    <div class="text-secondary text-sm mb-5">Αλλαγή στοιχείων κάρτας χρήστη</div>

    <form [formGroup]="form" class="grid grid-cols-1 sm:grid-cols-2 gap-4">

      <mat-form-field class="w-full" subscriptSizing="dynamic">
        <mat-label>Όνομα</mat-label>
        <input matInput formControlName="firstname" />
      </mat-form-field>

      <mat-form-field class="w-full" subscriptSizing="dynamic">
        <mat-label>Επώνυμο</mat-label>
        <input matInput formControlName="lastname" />
      </mat-form-field>

      <mat-form-field class="w-full sm:col-span-2" subscriptSizing="dynamic">
        <mat-label>Αριθμός Κάρτας</mat-label>
        <input matInput formControlName="cardNumber" />
      </mat-form-field>

      <mat-form-field class="w-full" subscriptSizing="dynamic">
        <mat-label>Τύπος Κάρτας</mat-label>
        <mat-select formControlName="cartType">
          <mat-option [value]="1">Κάρτα Φιλάθλου</mat-option>
          <mat-option [value]="2">Κάρτα Μέλους</mat-option>
        </mat-select>
      </mat-form-field>

      <mat-form-field class="w-full" subscriptSizing="dynamic">
        <mat-label>Season Id</mat-label>
        <input matInput type="number" formControlName="seasonId" />
      </mat-form-field>

    </form>

    <div class="flex justify-end gap-2 mt-6">
      <button mat-button type="button" (click)="ref.close(null)">Άκυρο</button>
      <button mat-flat-button color="primary" type="button"
              [disabled]="form.invalid"
              (click)="save()">
        Αποθήκευση
      </button>
    </div>
  </div>
  `,
})
export class EditUserCardDialogComponent {
    private _fb = inject(FormBuilder);

    form = this._fb.group({
        id: [0, Validators.required],
        userId: [0, Validators.required],
        seasonId: [0, Validators.required],
        cartType: [1, Validators.required],
        firstname: ['', Validators.required],
        lastname: ['', Validators.required],
        cardNumber: ['', Validators.required],
    });

    constructor(
        public ref: MatDialogRef<EditUserCardDialogComponent>,
        @Inject(MAT_DIALOG_DATA) public data: { card: UserCard }
    ) {
        const c = data.card;

        this.form.patchValue({
            id: c.id,
            userId: c.userId,
            seasonId: c.seasonId,
            cartType: c.cartType,
            firstname: c.firstname,
            lastname: c.lastname,
            cardNumber: c.cardNumber,
        });
    }

    save(): void {
        const raw = this.form.getRawValue();

        // return full updated card object to parent
        this.ref.close({
            ...this.data.card,
            ...raw,
        } as UserCard);
    }
}
