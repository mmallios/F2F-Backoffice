import { CommonModule } from '@angular/common';
import { Component, Inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatIconModule } from '@angular/material/icon';
import { Ticket } from '@fuse/services/events/events.service';



@Component({
    selector: 'edit-ticket-dialog',
    templateUrl: './edit-ticket-dialog.component.html',
    standalone: true,
    imports: [
        CommonModule,
        ReactiveFormsModule,
        MatDialogModule,
        MatButtonModule,
        MatFormFieldModule,
        MatInputModule,
        MatSelectModule,
        MatIconModule,
    ],
})
export class EditTicketDialogComponent {
    form = this._fb.group({
        id: [0, Validators.required],
        title: ['', Validators.required],
        status: ['', Validators.required],
    });

    statusOptions = ['Ενεργό', 'Ανενεργό', 'Σε αναμονή'];

    constructor(
        private _fb: FormBuilder,
        private _ref: MatDialogRef<EditTicketDialogComponent>,
        @Inject(MAT_DIALOG_DATA) public data: { ticket: Ticket }
    ) {
        this.form.reset(data.ticket);
    }

    close(): void {
        this._ref.close(null);
    }

    save(): void {
        if (this.form.invalid) return;
        this._ref.close(this.form.getRawValue());
    }
}
