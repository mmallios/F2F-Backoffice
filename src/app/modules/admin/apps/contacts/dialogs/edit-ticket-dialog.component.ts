import { CommonModule } from '@angular/common';
import { Component, Inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { UserTicket } from '@fuse/services/users/users.service';


@Component({
    selector: 'edit-ticket-dialog',
    templateUrl: './edit-ticket-dialog.component.html',
    standalone: true,
    imports: [
        MatButtonModule,
        MatFormFieldModule,
        MatInputModule,
        MatSelectModule,
        ReactiveFormsModule,
        CommonModule,
        MatIconModule,
    ],
})
export class EditTicketDialogComponent {
    form = this._fb.group({
        id: [0, Validators.required],
        firstname: ['', Validators.required],
        lastname: ['', Validators.required],
        status: ['', Validators.required],

        // ✅ new fields
        gate: [0, [Validators.required, Validators.min(0)]],
        section: [''],
        row: [''],
        seat: [''],
    });

    statusOptions = ['Ενεργό', 'Ανενεργό', 'Σε αναμονή'];

    constructor(
        private _fb: FormBuilder,
        private _ref: MatDialogRef<EditTicketDialogComponent>,
        @Inject(MAT_DIALOG_DATA) public data: { ticket: UserTicket }
    ) {
        // safer than reset() so missing fields get defaults
        this.form.patchValue({
            id: data.ticket.id,
            firstname: data.ticket.firstname,
            lastname: data.ticket.lastname,
            gate: data.ticket.gate ?? 0,
            section: data.ticket.section ?? '',
            row: data.ticket.row ?? '',
            seat: data.ticket.seat ?? '',
        });
    }

    close(): void {
        this._ref.close(null);
    }

    save(): void {
        if (this.form.invalid) return;
        this._ref.close(this.form.getRawValue());
    }
}
