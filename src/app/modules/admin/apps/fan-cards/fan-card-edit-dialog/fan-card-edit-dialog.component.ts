import {
    ChangeDetectionStrategy,
    ChangeDetectorRef,
    Component,
    Inject,
    OnInit,
    ViewEncapsulation,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import {
    FanCardListItem,
    FanCardSeason,
    FanCardsAdminService,
} from '@fuse/services/fan-cards/fan-cards-admin.service';
import { User, UsersService } from '@fuse/services/users/users.service';
import { forkJoin } from 'rxjs';

export interface FanCardEditDialogData {
    /** Pass an existing card to edit, or null to create a new one */
    card: FanCardListItem | null;
}

@Component({
    selector: 'fan-card-edit-dialog',
    templateUrl: './fan-card-edit-dialog.component.html',
    encapsulation: ViewEncapsulation.None,
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: true,
    imports: [
        CommonModule,
        ReactiveFormsModule,
        MatButtonModule,
        MatDialogModule,
        MatFormFieldModule,
        MatIconModule,
        MatInputModule,
        MatProgressSpinnerModule,
        MatSelectModule,
        MatSlideToggleModule,
    ],
})
export class FanCardEditDialogComponent implements OnInit {

    form!: FormGroup;
    loading = true;
    saving = false;
    error: string | null = null;

    users: User[] = [];
    seasons: FanCardSeason[] = [];

    get isEdit(): boolean { return !!this.data.card; }

    constructor(
        @Inject(MAT_DIALOG_DATA) public data: FanCardEditDialogData,
        private _dialogRef: MatDialogRef<FanCardEditDialogComponent>,
        private _service: FanCardsAdminService,
        private _usersService: UsersService,
        private _fb: FormBuilder,
        private _cdr: ChangeDetectorRef,
    ) { }

    ngOnInit(): void {
        this.form = this._fb.group({
            cardCode: [this.data.card?.cardCode ?? '', [Validators.required, Validators.minLength(3)]],
            ownerId: [this.data.card?.ownerId ?? null],
            seasonId: [this.data.card?.seasonId ?? null, Validators.required],
            isActive: [this.data.card?.isActive ?? true],
        });

        forkJoin({
            users: this._usersService.loadUsers(),
            seasons: this._service.getSeasons(),
        }).subscribe({
            next: ({ users, seasons }) => {
                this.users = users;
                this.seasons = seasons;
                this.loading = false;
                this._cdr.markForCheck();
            },
            error: () => {
                this.loading = false;
                this.error = 'Αποτυχία φόρτωσης δεδομένων.';
                this._cdr.markForCheck();
            },
        });
    }

    save(): void {
        if (this.form.invalid || this.saving) return;
        this.saving = true;
        this.error = null;
        this._cdr.markForCheck();

        const payload = {
            cardCode: (this.form.value.cardCode as string).trim().toUpperCase(),
            ownerId: this.form.value.ownerId ?? null,
            seasonId: this.form.value.seasonId,
            isActive: this.form.value.isActive,
        };

        const req$: import('rxjs').Observable<unknown> = this.isEdit
            ? this._service.updateCard(this.data.card!.id, payload)
            : this._service.createCard(payload);

        req$.subscribe({
            next: () => {
                this.saving = false;
                this._dialogRef.close({ saved: true });
            },
            error: () => {
                this.saving = false;
                this.error = 'Αποτυχία αποθήκευσης. Δοκιμάστε ξανά.';
                this._cdr.markForCheck();
            },
        });
    }

    cancel(): void {
        this._dialogRef.close(null);
    }

    userFullName(u: User): string {
        return `${u.firstname ?? ''} ${u.lastname ?? ''}`.trim();
    }
}
