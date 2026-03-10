import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, Inject, OnInit, ViewEncapsulation, inject } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize } from 'rxjs';

import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTabsModule } from '@angular/material/tabs';
import { MatDialog, MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatTableModule } from '@angular/material/table';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDividerModule } from '@angular/material/divider';
import { MatListModule } from '@angular/material/list';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';

import {
    RolesService,
    RoleDto,
    RoleUpsertRequest,
    RoleClaimRowDto,
    RoleUserDto,
    UpdateRoleClaimRequest,
    AdminRowDto,
    AvailableUserDto,
    UserClaimOverrideRowDto,
    UpsertUserClaimOverrideRequest,
} from '@fuse/services/roles/roles.service'; // adjust path

@Component({
    selector: 'bo-roles-admin',
    standalone: true,
    templateUrl: './bo-roles-admin.component.html',
    encapsulation: ViewEncapsulation.None,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        CommonModule,
        FormsModule,
        ReactiveFormsModule,

        MatButtonModule,
        MatIconModule,
        MatTabsModule,
        MatDialogModule,
        MatFormFieldModule,
        MatInputModule,
        MatTableModule,
        MatCheckboxModule,
        MatDividerModule,
        MatListModule,
        MatProgressBarModule,
        MatSnackBarModule,
        MatSelectModule,
        MatTooltipModule,
        ReactiveFormsModule
    ],
})
export class BoRolesAdminComponent implements OnInit {
    private _api = inject(RolesService);
    private _cdr = inject(ChangeDetectorRef);
    private _dialog = inject(MatDialog);
    private _snack = inject(MatSnackBar);

    loading = false;
    error: string | null = null;

    // ---------- Shared ----------
    roles: RoleDto[] = [];
    rolesColumns = ['role', 'active', 'actions'];

    // ---------- TAB 1: Administrators ----------
    adminsLoading = false;
    admins: AdminRowDto[] = [];
    adminsColumns = ['user', 'role', 'active', 'actions'];
    selectedRoleId: number | null = null;

    claimsLoading = false;
    roleClaims: RoleClaimRowDto[] = [];
    roleClaimsDraft: RoleClaimRowDto[] = [];
    claimsColumns = ['domain', 'claim', 'canView', 'canEdit', 'canDelete', 'active'];

    editMode = false;
    savingBatch = false;
    dirty = false;

    usersLoading = false;
    roleUsers: RoleUserDto[] = [];

    ngOnInit(): void {
        this.loadAll();
    }

    loadAll(): void {
        this.loading = true;
        this.error = null;
        this._cdr.markForCheck();

        // load roles first (used everywhere)
        this._api.getRoles()
            .pipe(finalize(() => {
                this.loading = false;
                this._cdr.markForCheck();
            }))
            .subscribe({
                next: (roles) => {
                    this.roles = roles ?? [];

                    // load admins
                    this.loadAdmins();

                    // default select role for matrix
                    if (!this.selectedRoleId && this.roles.length > 0) {
                        this.selectRole(this.roles[0].id);
                    }

                    this._cdr.markForCheck();
                },
                error: (err) => {
                    this.error = err?.error?.message ?? err?.message ?? 'Αποτυχία φόρτωσης δεδομένων';
                    this._cdr.markForCheck();
                }
            });
    }

    // ------------------------------------------
    // TAB 1: Administrators
    // ------------------------------------------
    loadAdmins(): void {
        this.adminsLoading = true;
        this.error = null;
        this._cdr.markForCheck();

        this._api.getAdministrators()
            .pipe(finalize(() => {
                this.adminsLoading = false;
                this._cdr.markForCheck();
            }))
            .subscribe({
                next: (rows) => {
                    this.admins = rows ?? [];
                    this._cdr.markForCheck();
                },
                error: (err) => {
                    this.error = err?.error?.message ?? err?.message ?? 'Αποτυχία φόρτωσης διαχειριστών';
                    this._cdr.markForCheck();
                }
            });
    }

    onAdminRoleChanged(row: AdminRowDto, newRoleId: number): void {
        if (!newRoleId || row.roleId === newRoleId) return;

        const prevRoleId = row.roleId;
        row.roleId = newRoleId; // optimistic
        this._cdr.markForCheck();

        this._api.updateAdministratorRole(row.boUserId, newRoleId).subscribe({
            next: () => {
                const roleName = this.roles.find(r => r.id === newRoleId)?.name ?? '';
                row.roleName = roleName;
                this._snack.open('✅ Ο ρόλος ενημερώθηκε επιτυχώς.', 'OK', { duration: 2500 });
                this._cdr.markForCheck();
            },
            error: (err) => {
                row.roleId = prevRoleId; // rollback
                this.error = err?.error?.message ?? err?.message ?? 'Αποτυχία ενημέρωσης ρόλου';
                this._cdr.markForCheck();
            }
        });
    }

    openAddAdministrator(): void {
        const ref = this._dialog.open(AddAdministratorDialogComponent, {
            width: '900px',
            maxWidth: '95vw',
            panelClass: ['fuse-mat-dialog', 'rounded-2xl'],
            autoFocus: false,
            data: {
                roles: this.roles,
            }
        });

        ref.afterClosed().subscribe((res: { userId: number; roleId: number } | null) => {
            if (!res) return;

            this.adminsLoading = true;
            this._cdr.markForCheck();

            this._api.addAdministrator(res.userId, res.roleId)
                .pipe(finalize(() => {
                    this.adminsLoading = false;
                    this._cdr.markForCheck();
                }))
                .subscribe({
                    next: () => {
                        this._snack.open('✅ Ο διαχειριστής προστέθηκε.', 'OK', { duration: 2500 });
                        this.loadAdmins();
                    },
                    error: (err) => {
                        this.error = err?.error?.message ?? err?.message ?? 'Αποτυχία προσθήκης διαχειριστή';
                        this._cdr.markForCheck();
                    }
                });
        });
    }

    removeAdministrator(row: AdminRowDto): void {
        const ref = this._dialog.open(ConfirmDeleteDialogComponent, {
            width: '520px',
            maxWidth: '95vw',
            panelClass: ['fuse-mat-dialog', 'rounded-2xl'],
            autoFocus: false,
            data: {
                title: 'Αφαίρεση διαχειριστή',
                message: `Θέλεις σίγουρα να αφαιρέσεις τον/την "${row.fullName}" από τους διαχειριστές;`,
                confirmText: 'Αφαίρεση',
                cancelText: 'Ακύρωση',
            },
        });

        ref.afterClosed().subscribe((ok: boolean) => {
            if (!ok) return;

            this.adminsLoading = true;
            this._cdr.markForCheck();

            this._api.removeAdministrator(row.boUserId)
                .pipe(finalize(() => {
                    this.adminsLoading = false;
                    this._cdr.markForCheck();
                }))
                .subscribe({
                    next: () => {
                        this._snack.open('✅ Ο διαχειριστής αφαιρέθηκε.', 'OK', { duration: 2500 });
                        this.admins = this.admins.filter(x => x.boUserId !== row.boUserId);
                        this._cdr.markForCheck();
                    },
                    error: (err) => {
                        this.error = err?.error?.message ?? err?.message ?? 'Αποτυχία αφαίρεσης διαχειριστή';
                        this._cdr.markForCheck();
                    }
                });
        });
    }

    openEditAdminClaims(row: AdminRowDto): void {
        this._dialog.open(EditAdminClaimsDialogComponent, {
            width: '1050px',
            maxWidth: '98vw',
            panelClass: ['fuse-mat-dialog', 'rounded-2xl'],
            autoFocus: false,
            data: { boUserId: row.boUserId, fullName: row.fullName, roleName: row.roleName },
        });
    }

    // ------------------------------------------
    // TAB 2: Roles CRUD
    // ------------------------------------------
    loadRoles(): void {
        this.loading = true;
        this.error = null;
        this._cdr.markForCheck();

        this._api.getRoles()
            .pipe(finalize(() => {
                this.loading = false;
                this._cdr.markForCheck();
            }))
            .subscribe({
                next: (roles) => {
                    this.roles = roles ?? [];
                    this._cdr.markForCheck();
                },
                error: (err) => {
                    this.error = err?.error?.message ?? err?.message ?? 'Αποτυχία φόρτωσης ρόλων';
                    this._cdr.markForCheck();
                }
            });
    }

    openAddRole(): void {
        const ref = this._dialog.open(RoleUpsertDialogComponent, {
            width: '720px',
            maxWidth: '95vw',
            panelClass: ['fuse-mat-dialog', 'rounded-2xl'],
            autoFocus: false,
            data: { mode: 'add' as const },
        });

        ref.afterClosed().subscribe((saved: RoleDto | null) => {
            if (!saved) return;
            this.roles = [saved, ...this.roles];
            this._snack.open('✅ Ο ρόλος δημιουργήθηκε.', 'OK', { duration: 2500 });
            this._cdr.markForCheck();
        });
    }

    openEditRole(role: RoleDto): void {
        const ref = this._dialog.open(RoleUpsertDialogComponent, {
            width: '720px',
            maxWidth: '95vw',
            panelClass: ['fuse-mat-dialog', 'rounded-2xl'],
            autoFocus: false,
            data: { mode: 'edit' as const, role },
        });

        ref.afterClosed().subscribe((saved: RoleDto | null) => {
            if (!saved) return;
            this.roles = this.roles.map(r => r.id === saved.id ? saved : r);
            this._snack.open('✅ Ο ρόλος ενημερώθηκε.', 'OK', { duration: 2500 });
            this._cdr.markForCheck();
        });
    }

    deleteRole(role: RoleDto): void {
        const ref = this._dialog.open(ConfirmDeleteDialogComponent, {
            width: '520px',
            maxWidth: '95vw',
            panelClass: ['fuse-mat-dialog', 'rounded-2xl'],
            autoFocus: false,
            data: {
                title: 'Διαγραφή ρόλου',
                message: `Θέλεις σίγουρα να διαγράψεις τον ρόλο "${role.name}";`,
                confirmText: 'Διαγραφή',
                cancelText: 'Ακύρωση',
            },
        });

        ref.afterClosed().subscribe((ok: boolean) => {
            if (!ok) return;

            this.loading = true;
            this._cdr.markForCheck();

            this._api.deleteRole(role.id)
                .pipe(finalize(() => {
                    this.loading = false;
                    this._cdr.markForCheck();
                }))
                .subscribe({
                    next: () => {
                        this.roles = this.roles.filter(r => r.id !== role.id);
                        this._snack.open('✅ Ο ρόλος διαγράφηκε.', 'OK', { duration: 2500 });
                        this._cdr.markForCheck();
                    },
                    error: (err) => {
                        this.error = err?.error?.message ?? err?.message ?? 'Αποτυχία διαγραφής ρόλου';
                        this._cdr.markForCheck();
                    }
                });
        });
    }

    // ------------------------------------------
    // TAB 3: Claims matrix + Role users
    // ------------------------------------------
    get selectedRole(): RoleDto | null {
        if (!this.selectedRoleId) return null;
        return this.roles.find(r => r.id === this.selectedRoleId) ?? null;
    }

    selectRole(roleId: number): void {
        this.selectedRoleId = roleId;

        // reset edit state
        this.editMode = false;
        this.dirty = false;
        this.roleClaims = [];
        this.roleClaimsDraft = [];
        this.roleUsers = [];

        this.loadRoleClaims(roleId);
        this.loadRoleUsers(roleId);
    }

    loadRoleClaims(roleId: number): void {
        this.claimsLoading = true;
        this.error = null;
        this._cdr.markForCheck();

        this._api.getRoleClaims(roleId)
            .pipe(finalize(() => {
                this.claimsLoading = false;
                this._cdr.markForCheck();
            }))
            .subscribe({
                next: (rows) => {
                    this.roleClaims = rows ?? [];
                    this.roleClaimsDraft = (rows ?? []).map(x => ({ ...x }));
                    this._cdr.markForCheck();
                },
                error: (err) => {
                    this.error = err?.error?.message ?? err?.message ?? 'Αποτυχία φόρτωσης δικαιωμάτων ρόλου';
                    this._cdr.markForCheck();
                }
            });
    }

    loadRoleUsers(roleId: number): void {
        this.usersLoading = true;
        this.error = null;
        this._cdr.markForCheck();

        this._api.getRoleUsers(roleId)
            .pipe(finalize(() => {
                this.usersLoading = false;
                this._cdr.markForCheck();
            }))
            .subscribe({
                next: (users) => {
                    this.roleUsers = users ?? [];
                    this._cdr.markForCheck();
                },
                error: (err) => {
                    this.error = err?.error?.message ?? err?.message ?? 'Αποτυχία φόρτωσης χρηστών ρόλου';
                    this._cdr.markForCheck();
                }
            });
    }

    enableEdit(): void {
        if (!this.selectedRoleId) return;
        this.editMode = true;
        this.dirty = false;
        this.roleClaimsDraft = this.roleClaims.map(x => ({ ...x }));
        this._cdr.markForCheck();
    }

    cancelEdit(): void {
        this.editMode = false;
        this.dirty = false;
        this.roleClaimsDraft = this.roleClaims.map(x => ({ ...x }));
        this._cdr.markForCheck();
    }

    onDraftToggle(row: RoleClaimRowDto, key: 'canView' | 'canEdit' | 'canDelete' | 'isActive', checked: boolean): void {
        if (!this.editMode) return;
        (row as any)[key] = !!checked;
        this.dirty = true;
        this._cdr.markForCheck();
    }

    saveBatch(): void {
        if (!this.selectedRoleId) return;
        if (!this.editMode) return;

        if (!this.dirty) {
            this._snack.open('Δεν υπάρχουν αλλαγές για αποθήκευση.', 'OK', { duration: 2500 });
            return;
        }

        const roleId = this.selectedRoleId;

        const changed = this.roleClaimsDraft
            .map(d => {
                const original = this.roleClaims.find(o => o.claimId === d.claimId);
                if (!original) return null;

                const isChanged =
                    original.canView !== d.canView ||
                    original.canEdit !== d.canEdit ||
                    original.canDelete !== d.canDelete ||
                    original.isActive !== d.isActive;

                if (!isChanged) return null;

                const payload: UpdateRoleClaimRequest & { claimId: number } = {
                    claimId: d.claimId,
                    canView: d.canView,
                    canEdit: d.canEdit,
                    canDelete: d.canDelete,
                    isActive: d.isActive,
                };
                return payload;
            })
            .filter((x): x is (UpdateRoleClaimRequest & { claimId: number }) => !!x);

        if (changed.length === 0) {
            this._snack.open('Δεν υπάρχουν αλλαγές για αποθήκευση.', 'OK', { duration: 2500 });
            return;
        }

        this.savingBatch = true;
        this.error = null;
        this._cdr.markForCheck();

        this._api.updateRoleClaimsBatch(roleId, changed)
            .pipe(finalize(() => {
                this.savingBatch = false;
                this._cdr.markForCheck();
            }))
            .subscribe({
                next: () => {
                    this.roleClaims = this.roleClaimsDraft.map(x => ({ ...x }));
                    this.editMode = false;
                    this.dirty = false;

                    this._snack.open('✅ Αποθηκεύτηκαν επιτυχώς τα δικαιώματα.', 'OK', { duration: 3000 });
                    this._cdr.markForCheck();
                },
                error: (err) => {
                    this.error = err?.error?.message ?? err?.message ?? 'Αποτυχία αποθήκευσης';
                    this._cdr.markForCheck();
                }
            });
    }

    removeUserFromRole(u: RoleUserDto): void {
        if (!this.selectedRoleId) return;

        const ref = this._dialog.open(ConfirmDeleteDialogComponent, {
            width: '520px',
            maxWidth: '95vw',
            panelClass: ['fuse-mat-dialog', 'rounded-2xl'],
            autoFocus: false,
            data: {
                title: 'Αφαίρεση χρήστη από ρόλο',
                message: `Θέλεις σίγουρα να αφαιρέσεις τον/την "${u.fullName}" από τον ρόλο;`,
                confirmText: 'Αφαίρεση',
                cancelText: 'Ακύρωση',
            }
        });

        ref.afterClosed().subscribe((ok: boolean) => {
            if (!ok) return;

            this.usersLoading = true;
            this._cdr.markForCheck();

            this._api.removeUserFromRole(this.selectedRoleId!, u.id)
                .pipe(finalize(() => {
                    this.usersLoading = false;
                    this._cdr.markForCheck();
                }))
                .subscribe({
                    next: () => {
                        this.roleUsers = this.roleUsers.filter(x => x.id !== u.id);
                        this._snack.open('✅ Ο χρήστης αφαιρέθηκε από τον ρόλο.', 'OK', { duration: 2500 });
                        this._cdr.markForCheck();
                    },
                    error: (err) => {
                        this.error = err?.error?.message ?? err?.message ?? 'Αποτυχία αφαίρεσης χρήστη από ρόλο';
                        this._cdr.markForCheck();
                    }
                });
        });
    }

    // trackBy
    trackByRoleId = (_: number, r: RoleDto) => r.id;
    trackByClaimId = (_: number, r: RoleClaimRowDto) => r.claimId;
    trackByUserId = (_: number, u: RoleUserDto) => u.id;
    trackByAdminId = (_: number, a: AdminRowDto) => a.boUserId;
}

/* ---------------- Dialogs ---------------- */

@Component({
    selector: 'role-upsert-dialog',
    standalone: true,
    imports: [
        CommonModule, ReactiveFormsModule,
        MatButtonModule, MatIconModule, MatFormFieldModule, MatInputModule, MatDividerModule, MatCheckboxModule
    ],
    template: `
  <div class="p-6 space-y-5">
    <div class="flex items-start justify-between gap-4">
      <div>
        <div class="text-xl font-extrabold">
          {{ data.mode === 'add' ? 'Νέος ρόλος' : 'Επεξεργασία ρόλου' }}
        </div>
        <div class="text-secondary text-sm mt-1">
          Διαχείριση στοιχείων ρόλου.
        </div>
      </div>

      <button mat-icon-button type="button" (click)="ref.close(null)">
        <mat-icon>close</mat-icon>
      </button>
    </div>

    <mat-divider></mat-divider>

    <form [formGroup]="form" class="grid grid-cols-1 md:grid-cols-2 gap-4">
      <mat-form-field class="w-full" subscriptSizing="dynamic">
        <mat-label>Κωδικός</mat-label>
        <input matInput formControlName="code" placeholder="π.χ. super_admin" />
      </mat-form-field>

      <mat-form-field class="w-full" subscriptSizing="dynamic">
        <mat-label>Όνομα</mat-label>
        <input matInput formControlName="name" placeholder="π.χ. Super Admin" />
      </mat-form-field>

      <mat-form-field class="w-full md:col-span-2" subscriptSizing="dynamic">
        <mat-label>Περιγραφή</mat-label>
        <textarea matInput rows="3" formControlName="description"></textarea>
      </mat-form-field>

      <mat-form-field class="w-full md:col-span-2" subscriptSizing="dynamic">
        <mat-label>Εικονίδιο (προαιρετικό)</mat-label>
        <input matInput formControlName="icon" placeholder="material icon name" />
      </mat-form-field>

      <div class="md:col-span-2">
        <mat-checkbox formControlName="isActive">Ενεργός</mat-checkbox>
      </div>
    </form>

    <div class="flex justify-end gap-2 pt-2">
      <button mat-button type="button" (click)="ref.close(null)">Ακύρωση</button>
      <button mat-flat-button color="primary" type="button" [disabled]="form.invalid || saving" (click)="save()">
        {{ saving ? 'Αποθήκευση…' : 'Αποθήκευση' }}
      </button>
    </div>
  </div>
  `,
})
export class RoleUpsertDialogComponent {
    private _api = inject(RolesService);
    private _fb = inject(FormBuilder);

    saving = false;

    form = this._fb.group({
        code: ['', Validators.required],
        name: ['', Validators.required],
        description: [''],
        icon: [''],
        isActive: [true],
    });

    constructor(
        public ref: MatDialogRef<RoleUpsertDialogComponent>,
        @Inject(MAT_DIALOG_DATA) public data: { mode: 'add' | 'edit'; role?: RoleDto }
    ) {
        if (data.role) {
            this.form.patchValue({
                code: data.role.code,
                name: data.role.name,
                description: data.role.description ?? '',
                icon: data.role.icon ?? '',
                isActive: data.role.isActive,
            });
        }
    }

    save(): void {
        if (this.form.invalid) return;

        this.saving = true;

        const raw = this.form.getRawValue();
        const payload: RoleUpsertRequest = {
            code: (raw.code || '').trim(),
            name: (raw.name || '').trim(),
            description: raw.description || null,
            icon: raw.icon || null,
            isActive: !!raw.isActive,
        };

        const obs = this.data.mode === 'add'
            ? this._api.createRole(payload)
            : this._api.updateRole(this.data.role!.id, payload);

        obs.pipe(finalize(() => (this.saving = false)))
            .subscribe({
                next: (saved) => this.ref.close(saved),
                error: (err) => console.error(err),
            });
    }
}

@Component({
    selector: 'add-administrator-dialog',
    standalone: true,
    imports: [
        CommonModule, ReactiveFormsModule, FormsModule,
        MatButtonModule, MatIconModule, MatFormFieldModule, MatInputModule, MatDividerModule, MatSelectModule, MatProgressBarModule
    ],
    template: `
  <div class="p-6 space-y-4">
    <div class="flex items-start justify-between gap-4">
      <div>
        <div class="text-xl font-extrabold">Προσθήκη διαχειριστή</div>
        <div class="text-secondary text-sm mt-1">Επίλεξε χρήστη και ρόλο.</div>
      </div>

      <button mat-icon-button type="button" (click)="ref.close(null)">
        <mat-icon>close</mat-icon>
      </button>
    </div>

    <mat-divider></mat-divider>

    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
      <mat-form-field class="w-full" subscriptSizing="dynamic">
        <mat-label>Ρόλος</mat-label>
        <mat-select [(ngModel)]="roleId">
          <mat-option *ngFor="let r of roles" [value]="r.id">{{ r.name }} ({{ r.code }})</mat-option>
        </mat-select>
      </mat-form-field>

      <mat-form-field class="w-full" subscriptSizing="dynamic">
        <mat-label>Αναζήτηση χρήστη</mat-label>
        <input matInput [(ngModel)]="q" (ngModelChange)="applyFilter()" placeholder="Όνομα / Επώνυμο / Κωδικός" />
        <mat-icon matSuffix>search</mat-icon>
      </mat-form-field>
    </div>

    <mat-progress-bar *ngIf="loading" mode="indeterminate"></mat-progress-bar>

    <div class="rounded-2xl border overflow-auto max-h-[420px]">
      <div *ngFor="let u of filtered" class="p-3 border-b last:border-b-0 flex items-center gap-3">
        <img [src]="u.image || 'assets/images/placeholder-user.png'"
             class="h-10 w-10 rounded-full object-cover" />

        <div class="min-w-0 flex-1">
          <div class="font-semibold truncate">{{ u.fullName }}</div>
          <div class="text-secondary text-sm truncate">{{ u.code || '-' }} • {{ u.email || '-' }}</div>
        </div>

        <button mat-stroked-button type="button"
                [disabled]="!roleId"
                (click)="select(u)">
          <mat-icon>add</mat-icon>
          <span class="ml-2">Επιλογή</span>
        </button>
      </div>

      <div *ngIf="!loading && filtered.length === 0" class="p-6 text-center text-secondary">
        Δεν βρέθηκαν χρήστες.
      </div>
    </div>

    <div class="flex justify-end gap-2 pt-2">
      <button mat-button type="button" (click)="ref.close(null)">Ακύρωση</button>
    </div>
  </div>
  `
})
export class AddAdministratorDialogComponent implements OnInit {
    private _api = inject(RolesService);

    loading = false;
    roles: RoleDto[] = [];
    roleId: number | null = null;

    q = '';
    all: AvailableUserDto[] = [];
    filtered: AvailableUserDto[] = [];

    constructor(
        public ref: MatDialogRef<AddAdministratorDialogComponent>,
        @Inject(MAT_DIALOG_DATA) public data: { roles: RoleDto[] }
    ) {
        this.roles = data.roles ?? [];
        this.roleId = this.roles[0]?.id ?? null;
    }

    ngOnInit(): void {
        this.loading = true;
        this._api.getAvailableUsersForAdmin()
            .pipe(finalize(() => (this.loading = false)))
            .subscribe({
                next: (users) => {
                    this.all = users ?? [];
                    this.filtered = [...this.all];
                },
                error: () => {
                    this.all = [];
                    this.filtered = [];
                }
            });
    }

    applyFilter(): void {
        const t = (this.q || '').trim().toLowerCase();
        if (!t) {
            this.filtered = [...this.all];
            return;
        }

        this.filtered = this.all.filter(u => {
            const s = `${u.fullName || ''} ${u.firstname || ''} ${u.lastname || ''} ${u.code || ''} ${u.email || ''}`.toLowerCase();
            return s.includes(t);
        });
    }

    select(u: AvailableUserDto): void {
        if (!this.roleId) return;
        this.ref.close({ userId: u.id, roleId: this.roleId });
    }
}

/* ---------- Draft row used inside the dialog ---------- */
interface DraftOverrideRow {
    claimId: number;
    domainName: string;
    domainCode: string;
    claimName: string;
    claimCode: string;
    roleCanView: boolean;
    roleCanEdit: boolean;
    roleCanDelete: boolean;
    overrideCanView: boolean | null;
    overrideCanEdit: boolean | null;
    overrideCanDelete: boolean | null;
}

@Component({
    selector: 'edit-admin-claims-dialog',
    standalone: true,
    imports: [
        CommonModule,
        MatButtonModule, MatIconModule, MatDividerModule,
        MatTableModule, MatCheckboxModule, MatProgressBarModule,
        MatTooltipModule,
    ],
    template: `
<div class="flex flex-col" style="max-height:90vh">

  <!-- Header -->
  <div class="p-6 pb-4 shrink-0">
    <div class="flex items-start justify-between gap-4">
      <div>
        <div class="text-xl font-extrabold">Δικαιώματα διαχειριστή</div>
        <div class="text-secondary text-sm mt-1">
          <span class="font-semibold text-primary">{{ data.fullName }}</span>
          — ρόλος: <span class="font-medium">{{ data.roleName }}</span>
        </div>
        <div class="text-secondary text-xs mt-1">
          Τα δικαιώματα κληρονομούνται από τον ρόλο. Μπορείς να κάνεις override ανά claim.
          <span class="inline-flex items-center gap-1 text-orange-500 ml-1">
            <mat-icon style="font-size:14px;width:14px;height:14px">edit_note</mat-icon>
            = override ενεργό
          </span>
        </div>
      </div>
      <button mat-icon-button type="button" (click)="ref.close()">
        <mat-icon>close</mat-icon>
      </button>
    </div>

    <mat-progress-bar *ngIf="loading || saving" mode="indeterminate" class="mt-3"></mat-progress-bar>

    <div *ngIf="error" class="mt-3 rounded-xl border p-3 bg-red-50/60 dark:bg-red-500/10 text-red-700 dark:text-red-300 flex gap-2 text-sm">
      <mat-icon class="shrink-0">error</mat-icon>
      <span>{{ error }}</span>
    </div>
  </div>

  <mat-divider class="shrink-0"></mat-divider>

  <!-- Toolbar -->
  <div class="px-6 py-3 flex items-center justify-between gap-3 shrink-0 bg-gray-50 dark:bg-transparent">
    <div class="text-sm text-secondary">
      <span *ngIf="overriddenCount > 0" class="text-orange-500 font-semibold">
        {{ overriddenCount }} claims με override
      </span>
      <span *ngIf="overriddenCount === 0">Δεν υπάρχουν overrides.</span>
    </div>

    <div class="flex gap-2">
      <button mat-button type="button" (click)="cancelEdit()" *ngIf="editMode" [disabled]="saving">
        Ακύρωση
      </button>
      <button mat-stroked-button type="button" (click)="enableEdit()" *ngIf="!editMode" [disabled]="loading">
        <mat-icon>edit</mat-icon>
        <span class="ml-2">Επεξεργασία</span>
      </button>
      <button mat-flat-button color="primary" type="button" (click)="save()" *ngIf="editMode" [disabled]="saving || !dirty">
        <mat-icon>save</mat-icon>
        <span class="ml-2">{{ saving ? 'Αποθήκευση…' : 'Αποθήκευση' }}</span>
      </button>
    </div>
  </div>

  <mat-divider class="shrink-0"></mat-divider>

  <!-- Table -->
  <div class="overflow-auto flex-1 p-2">
    <table mat-table [dataSource]="draft" class="w-full min-w-[780px]">

      <!-- Domain -->
      <ng-container matColumnDef="domain">
        <th mat-header-cell *matHeaderCellDef>Domain</th>
        <td mat-cell *matCellDef="let r">
          <div class="min-w-0">
            <div class="font-semibold truncate text-sm">{{ r.domainName }}</div>
            <div class="text-secondary text-xs truncate">{{ r.domainCode }}</div>
          </div>
        </td>
      </ng-container>

      <!-- Claim -->
      <ng-container matColumnDef="claim">
        <th mat-header-cell *matHeaderCellDef>Claim</th>
        <td mat-cell *matCellDef="let r">
          <div class="flex items-center gap-1 min-w-0">
            <div class="min-w-0">
              <div class="font-semibold truncate text-sm">{{ r.claimName }}</div>
              <div class="text-secondary text-xs truncate">{{ r.claimCode }}</div>
            </div>
            <!-- Orange icon if row has any override -->
            <mat-icon *ngIf="isRowOverridden(r)"
              class="text-orange-500 shrink-0 ml-1"
              style="font-size:18px;width:18px;height:18px"
              matTooltip="Αυτό το claim έχει override από τον ρόλο">edit_note</mat-icon>
          </div>
        </td>
      </ng-container>

      <!-- CanView -->
      <ng-container matColumnDef="canView">
        <th mat-header-cell *matHeaderCellDef class="text-center">Προβολή</th>
        <td mat-cell *matCellDef="let r" class="text-center">
          <div class="flex items-center justify-center gap-1">
            <mat-checkbox
              [checked]="effective(r, 'view')"
              [disabled]="!editMode"
              (change)="onToggle(r, 'view', $event.checked)">
            </mat-checkbox>
            <mat-icon *ngIf="r.overrideCanView !== null"
              class="text-orange-500"
              style="font-size:14px;width:14px;height:14px"
              [matTooltip]="'Role default: ' + (r.roleCanView ? 'Ναι' : 'Όχι')">circle</mat-icon>
          </div>
        </td>
      </ng-container>

      <!-- CanEdit -->
      <ng-container matColumnDef="canEdit">
        <th mat-header-cell *matHeaderCellDef class="text-center">Επεξεργασία</th>
        <td mat-cell *matCellDef="let r" class="text-center">
          <div class="flex items-center justify-center gap-1">
            <mat-checkbox
              [checked]="effective(r, 'edit')"
              [disabled]="!editMode"
              (change)="onToggle(r, 'edit', $event.checked)">
            </mat-checkbox>
            <mat-icon *ngIf="r.overrideCanEdit !== null"
              class="text-orange-500"
              style="font-size:14px;width:14px;height:14px"
              [matTooltip]="'Role default: ' + (r.roleCanEdit ? 'Ναι' : 'Όχι')">circle</mat-icon>
          </div>
        </td>
      </ng-container>

      <!-- CanDelete -->
      <ng-container matColumnDef="canDelete">
        <th mat-header-cell *matHeaderCellDef class="text-center">Διαγραφή</th>
        <td mat-cell *matCellDef="let r" class="text-center">
          <div class="flex items-center justify-center gap-1">
            <mat-checkbox
              [checked]="effective(r, 'delete')"
              [disabled]="!editMode"
              (change)="onToggle(r, 'delete', $event.checked)">
            </mat-checkbox>
            <mat-icon *ngIf="r.overrideCanDelete !== null"
              class="text-orange-500"
              style="font-size:14px;width:14px;height:14px"
              [matTooltip]="'Role default: ' + (r.roleCanDelete ? 'Ναι' : 'Όχι')">circle</mat-icon>
          </div>
        </td>
      </ng-container>

      <!-- Reset -->
      <ng-container matColumnDef="reset">
        <th mat-header-cell *matHeaderCellDef class="text-center">Reset</th>
        <td mat-cell *matCellDef="let r" class="text-center">
          <button mat-icon-button type="button"
            *ngIf="editMode && isRowOverridden(r)"
            (click)="resetRow(r)"
            matTooltip="Επαναφορά στις τιμές ρόλου"
            class="text-orange-500">
            <mat-icon>restore</mat-icon>
          </button>
        </td>
      </ng-container>

      <tr mat-header-row *matHeaderRowDef="cols; sticky: true"></tr>
      <tr mat-row *matRowDef="let row; columns: cols"></tr>
    </table>

    <div *ngIf="!loading && draft.length === 0" class="p-8 text-center text-secondary">
      Δεν βρέθηκαν δικαιώματα για αυτόν τον διαχειριστή.
    </div>
  </div>

</div>
  `,
})
export class EditAdminClaimsDialogComponent implements OnInit {
    private _api = inject(RolesService);
    private _cdr = inject(ChangeDetectorRef);
    private _snack = inject(MatSnackBar);

    cols = ['domain', 'claim', 'canView', 'canEdit', 'canDelete', 'reset'];

    loading = false;
    saving = false;
    editMode = false;
    dirty = false;
    error: string | null = null;

    rows: UserClaimOverrideRowDto[] = [];
    draft: DraftOverrideRow[] = [];

    constructor(
        public ref: MatDialogRef<EditAdminClaimsDialogComponent>,
        @Inject(MAT_DIALOG_DATA) public data: { boUserId: number; fullName: string; roleName: string }
    ) { }

    ngOnInit(): void {
        this.load();
    }

    load(): void {
        this.loading = true;
        this.error = null;
        this._cdr.markForCheck();

        this._api.getUserClaimsWithOverrides(this.data.boUserId)
            .pipe(finalize(() => {
                this.loading = false;
                this._cdr.markForCheck();
            }))
            .subscribe({
                next: (rows) => {
                    this.rows = rows ?? [];
                    this.draft = this.toDraft(this.rows);
                    this._cdr.markForCheck();
                },
                error: (err) => {
                    this.error = err?.error?.message ?? err?.message ?? 'Αποτυχία φόρτωσης δικαιωμάτων';
                    this._cdr.markForCheck();
                }
            });
    }

    private toDraft(rows: UserClaimOverrideRowDto[]): DraftOverrideRow[] {
        return rows.map(r => ({
            claimId: r.claimId,
            domainName: r.domainName,
            domainCode: r.domainCode,
            claimName: r.claimName,
            claimCode: r.claimCode,
            roleCanView: r.roleCanView,
            roleCanEdit: r.roleCanEdit,
            roleCanDelete: r.roleCanDelete,
            overrideCanView: r.overrideCanView,
            overrideCanEdit: r.overrideCanEdit,
            overrideCanDelete: r.overrideCanDelete,
        }));
    }

    effective(r: DraftOverrideRow, field: 'view' | 'edit' | 'delete'): boolean {
        switch (field) {
            case 'view': return r.overrideCanView ?? r.roleCanView;
            case 'edit': return r.overrideCanEdit ?? r.roleCanEdit;
            case 'delete': return r.overrideCanDelete ?? r.roleCanDelete;
        }
    }

    isRowOverridden(r: DraftOverrideRow): boolean {
        return r.overrideCanView !== null || r.overrideCanEdit !== null || r.overrideCanDelete !== null;
    }

    get overriddenCount(): number {
        return this.draft.filter(r => this.isRowOverridden(r)).length;
    }

    onToggle(r: DraftOverrideRow, field: 'view' | 'edit' | 'delete', checked: boolean): void {
        if (!this.editMode) return;

        switch (field) {
            case 'view':
                // If same as role default, no override needed; keep null if not yet diverged,
                // but once user explicitly toggles, we store the override so it's tracked
                r.overrideCanView = checked;
                break;
            case 'edit':
                r.overrideCanEdit = checked;
                break;
            case 'delete':
                r.overrideCanDelete = checked;
                break;
        }
        this.dirty = true;
        this._cdr.markForCheck();
    }

    resetRow(r: DraftOverrideRow): void {
        r.overrideCanView = null;
        r.overrideCanEdit = null;
        r.overrideCanDelete = null;
        this.dirty = true;
        this._cdr.markForCheck();
    }

    enableEdit(): void {
        this.editMode = true;
        this.dirty = false;
        this.draft = this.toDraft(this.rows);
        this._cdr.markForCheck();
    }

    cancelEdit(): void {
        this.editMode = false;
        this.dirty = false;
        this.draft = this.toDraft(this.rows);
        this._cdr.markForCheck();
    }

    save(): void {
        if (!this.editMode || !this.dirty) return;

        const payload: UpsertUserClaimOverrideRequest[] = this.draft.map(r => ({
            claimId: r.claimId,
            overrideCanView: r.overrideCanView,
            overrideCanEdit: r.overrideCanEdit,
            overrideCanDelete: r.overrideCanDelete,
        }));

        this.saving = true;
        this.error = null;
        this._cdr.markForCheck();

        this._api.saveUserClaimOverridesBatch(this.data.boUserId, payload)
            .pipe(finalize(() => {
                this.saving = false;
                this._cdr.markForCheck();
            }))
            .subscribe({
                next: () => {
                    this.editMode = false;
                    this.dirty = false;
                    // Reload to get fresh server state
                    this.rows = this.draft.map(r => ({
                        domainId: 0,
                        domainCode: r.domainCode,
                        domainName: r.domainName,
                        claimId: r.claimId,
                        claimCode: r.claimCode,
                        claimName: r.claimName,
                        roleCanView: r.roleCanView,
                        roleCanEdit: r.roleCanEdit,
                        roleCanDelete: r.roleCanDelete,
                        overrideCanView: r.overrideCanView,
                        overrideCanEdit: r.overrideCanEdit,
                        overrideCanDelete: r.overrideCanDelete,
                        effectiveCanView: r.overrideCanView ?? r.roleCanView,
                        effectiveCanEdit: r.overrideCanEdit ?? r.roleCanEdit,
                        effectiveCanDelete: r.overrideCanDelete ?? r.roleCanDelete,
                    }));
                    this._snack.open('✅ Τα overrides αποθηκεύτηκαν επιτυχώς.', 'OK', { duration: 3000 });
                    this._cdr.markForCheck();
                },
                error: (err) => {
                    this.error = err?.error?.message ?? err?.message ?? 'Αποτυχία αποθήκευσης';
                    this._snack.open('❌ Αποτυχία αποθήκευσης overrides.', 'OK', { duration: 3500 });
                    this._cdr.markForCheck();
                }
            });
    }
}

@Component({
    selector: 'confirm-delete-dialog',
    standalone: true,
    imports: [CommonModule, MatButtonModule, MatIconModule],
    template: `
  <div class="p-6 space-y-4">
    <div class="flex items-start gap-3">
      <mat-icon class="text-red-500">warning</mat-icon>
      <div class="min-w-0">
        <div class="text-lg font-extrabold">{{ data.title }}</div>
        <div class="text-secondary text-sm mt-1">{{ data.message }}</div>
      </div>
    </div>

    <div class="flex justify-end gap-2 pt-2">
      <button mat-button type="button" (click)="ref.close(false)">{{ data.cancelText || 'Ακύρωση' }}</button>
      <button mat-flat-button color="warn" type="button" (click)="ref.close(true)">{{ data.confirmText || 'Διαγραφή' }}</button>
    </div>
  </div>
  `,
})
export class ConfirmDeleteDialogComponent {
    constructor(
        public ref: MatDialogRef<ConfirmDeleteDialogComponent>,
        @Inject(MAT_DIALOG_DATA) public data: any
    ) { }
}