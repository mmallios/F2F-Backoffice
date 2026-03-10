import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, inject, signal, computed } from '@angular/core';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatInputModule } from '@angular/material/input';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MAT_DIALOG_DATA, MatDialog, MatDialogModule } from '@angular/material/dialog';

import { finalize, Subject, takeUntil } from 'rxjs';
import { ConfirmDialogData, ConfirmDialogComponent } from '../dialogs/confirm-dialog.component';

import {
    SupportTicketsAdminService,
    SupportTicketAdminDto,
    SupportTicketMessageDto,
    SupportTicketDetailsAdminDto,
    SupportTicketStatus,
    SupportTicketsQuery,
    UpdateTicketAdminRequest,
    SendAdminReplyRequest,
    AdminUserDto,
} from '@fuse/services/support/support-tickets-admin.service';
import { AuthService } from 'app/core/auth/auth.service';

type AdminUserVm = { boUserId: number; userId: number; firstname: string; lastname: string; fullname: string; email?: string | null; image?: string | null };

@Component({
    standalone: true,
    imports: [CommonModule, MatButtonModule, MatIconModule, MatDialogModule, MatDividerModule],
    template: `
<div style="min-width:340px;max-width:480px">
  <div class="h-1 bg-gradient-to-r from-blue-500 to-cyan-400"></div>
  <div class="p-6">
    <div class="flex items-center gap-4 mb-5">
      <ng-container *ngIf="data.userImage; else avatarInitials">
        <img [src]="data.userImage" class="w-16 h-16 rounded-2xl border-2 border-blue-500/30 object-cover shrink-0" alt="">
      </ng-container>
      <ng-template #avatarInitials>
        <div class="w-16 h-16 rounded-2xl border-2 border-blue-500/30 bg-blue-500/10 flex items-center justify-center font-bold text-2xl text-blue-500 shrink-0 select-none">
          {{ initials }}
        </div>
      </ng-template>
      <div class="min-w-0 flex-1">
        <div class="text-xl font-bold leading-tight">{{ data.userFullName || ('User #' + data.userId) }}</div>
        <div *ngIf="data.userUsername" class="text-sm text-blue-400 mt-0.5">{{ '@' + data.userUsername }}</div>
        <div class="text-xs opacity-50 mt-0.5">ID: #{{ data.userId }}</div>
      </div>
    </div>
    <mat-divider></mat-divider>
    <div class="mt-4 grid grid-cols-2 gap-x-4 gap-y-3">
      <div *ngIf="data.userCode" class="flex items-start gap-2 text-sm col-span-2">
        <mat-icon class="!text-[18px] text-cyan-500 shrink-0 mt-0.5">qr_code</mat-icon>
        <div><div class="text-[10px] uppercase tracking-wide opacity-50 mb-0.5">Κωδικός</div><div class="font-mono font-semibold">{{ data.userCode }}</div></div>
      </div>
      <div *ngIf="data.userEmail" class="flex items-start gap-2 text-sm col-span-2">
        <mat-icon class="!text-[18px] text-blue-500 shrink-0 mt-0.5">email</mat-icon>
        <div><div class="text-[10px] uppercase tracking-wide opacity-50 mb-0.5">Email</div><div class="break-all">{{ data.userEmail }}</div></div>
      </div>
      <div *ngIf="data.userPoints != null" class="flex items-start gap-2 text-sm">
        <mat-icon class="!text-[18px] text-amber-400 shrink-0 mt-0.5">stars</mat-icon>
        <div><div class="text-[10px] uppercase tracking-wide opacity-50 mb-0.5">Πόντοι</div><div class="font-bold">{{ data.userPoints }}</div></div>
      </div>
      <div class="flex items-start gap-2 text-sm">
        <mat-icon class="!text-[18px] opacity-40 shrink-0 mt-0.5">fingerprint</mat-icon>
        <div><div class="text-[10px] uppercase tracking-wide opacity-50 mb-0.5">User ID</div><div>#{{ data.userId }}</div></div>
      </div>
    </div>
    <div class="flex justify-end mt-6">
      <button mat-flat-button color="primary" class="!rounded-xl" [mat-dialog-close]="true">Κλείσιμο</button>
    </div>
  </div>
</div>`,
})
class UserProfileDialogComponent {
    readonly data = inject<SupportTicketAdminDto>(MAT_DIALOG_DATA);
    get initials(): string {
        const n = this.data.userFullName || '';
        const p = n.trim().split(/\s+/);
        return (p.length >= 2 ? p[0][0] + p[1][0] : n.slice(0, 2)).toUpperCase() || '?';
    }
}

@Component({
    selector: 'app-support-ticket-details-admin',
    standalone: true,
    imports: [
        CommonModule,
        RouterModule,
        ReactiveFormsModule,

        MatCardModule,
        MatButtonModule,
        MatIconModule,
        MatDividerModule,
        MatFormFieldModule,
        MatSelectModule,
        MatInputModule,
        MatChipsModule,
        MatProgressBarModule,
        MatDialogModule,
        MatSnackBarModule,
        MatTooltipModule,
    ],
    templateUrl: './support-ticket-details.component.html',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SupportTicketDetailsAdminComponent implements OnInit, OnDestroy {
    private route = inject(ActivatedRoute);
    private fb = inject(FormBuilder);
    private dialog = inject(MatDialog);
    private snack = inject(MatSnackBar);
    private api = inject(SupportTicketsAdminService);
    readonly authService = inject(AuthService);

    private destroy$ = new Subject<void>();

    // Current admin - loaded from users service
    currentAdmin = signal<AdminUserVm | null>(null);
    adminUsers = signal<AdminUserVm[]>([]);

    loading = signal(true);
    savingMeta = signal(false);
    sending = signal(false);
    error = signal<string | null>(null);

    details = signal<SupportTicketDetailsAdminDto | null>(null);

    ticketId = 0;

    isUnassigned = computed(() => {
        const t = this.details()?.ticket;
        return !!t && !t.assigneeAdminId;
    });

    readonly statusOptions = [
        { value: SupportTicketStatus.Pending, label: 'Εκκρεμεί' },
        { value: SupportTicketStatus.Answered, label: 'Απαντήθηκε' },
        { value: SupportTicketStatus.Completed, label: 'Ολοκληρώθηκε' },
        { value: SupportTicketStatus.Deleted, label: 'Διεγράφη' },
    ];

    metaForm = this.fb.group({
        status: [SupportTicketStatus.Pending as SupportTicketStatus],
        assigneeAdminId: [null as number | null],
    });

    replyForm = this.fb.group({
        body: ['', [Validators.required, Validators.minLength(2)]],
    });

    ngOnInit(): void {
        this.ticketId = Number(this.route.snapshot.paramMap.get('id'));
        if (!Number.isFinite(this.ticketId) || this.ticketId <= 0) {
            this.error.set('Μη έγκυρο ticket id.');
            this.loading.set(false);
            return;
        }

        // Load admin users for the assignee dropdown
        this.api
            .loadAdmins()
            .pipe(takeUntil(this.destroy$))
            .subscribe({
                next: (admins) => {
                    const vms: AdminUserVm[] = (admins ?? []).map(a => ({
                        boUserId: a.boUserId,
                        userId: a.userId,
                        firstname: a.firstname ?? '',
                        lastname: a.lastname ?? '',
                        fullname: a.fullName ?? `${a.firstname ?? ''} ${a.lastname ?? ''}`.trim(),
                        email: a.email,
                        image: a.image,
                    }));
                    this.adminUsers.set(vms);

                    // Wire currentAdmin from stored login user
                    const me = this.authService.currentUser;
                    if (me?.id) {
                        const found = vms.find(v => v.userId === me.id);
                        if (found) this.currentAdmin.set(found);
                    }
                },
                error: () => { },
            });

        this.loadDetails();
    }

    ngOnDestroy(): void {
        this.destroy$.next();
        this.destroy$.complete();
    }

    // =============== LOAD ===============
    loadDetails(): void {
        this.loading.set(true);
        this.error.set(null);

        this.api
            .getDetails(this.ticketId)
            .pipe(
                finalize(() => this.loading.set(false)),
                takeUntil(this.destroy$),
            )
            .subscribe({
                next: (res) => {
                    this.details.set(res);
                    this.metaForm.patchValue({
                        status: res.ticket.status,
                        assigneeAdminId: res.ticket.assigneeAdminId ?? null,
                    });

                    // Mark user messages as read
                    this.api.markReadByAdmin(this.ticketId).pipe(takeUntil(this.destroy$)).subscribe();
                },
                error: () => this.error.set('Αποτυχία φόρτωσης ticket.'),
            });
    }

    // =============== CLAIM TO ME ===============
    claimToMe(): void {
        const d = this.details();
        if (!d || d.ticket.assigneeAdminId) return;

        const me = this.currentAdmin();
        const meId = me?.boUserId ?? this.authService.currentUser?.boUserId ?? null;

        const data: ConfirmDialogData = {
            title: 'Ανάθεση ticket',
            message: `Θέλεις να αναθέσεις το ticket #${d.ticket.id} στον εαυτό σου (${me?.firstname} ${me?.lastname});`,
            confirmText: 'Ναι, ανάθεσε',
            cancelText: 'Άκυρο',
            icon: 'person_add',
        };

        this.dialog
            .open(ConfirmDialogComponent, { width: '520px', maxWidth: '92vw', data })
            .afterClosed()
            .pipe(takeUntil(this.destroy$))
            .subscribe((ok: boolean) => {
                if (!ok || !meId) return;

                const req: UpdateTicketAdminRequest = { assigneeAdminId: meId };
                this.savingMeta.set(true);

                this.api
                    .update(this.ticketId, req)
                    .pipe(
                        finalize(() => this.savingMeta.set(false)),
                        takeUntil(this.destroy$),
                    )
                    .subscribe({
                        next: (ticket) => {
                            const prev = this.details();
                            if (prev) this.details.set({ ...prev, ticket });
                            this.metaForm.patchValue({ assigneeAdminId: ticket.assigneeAdminId ?? null });
                            this.snack.open('Το ticket ανατέθηκε σε εσένα.', 'ΟΚ', { duration: 2500 });
                        },
                        error: () => this.snack.open('Αποτυχία ανάθεσης.', 'OK', { duration: 2500 }),
                    });
            });
    }

    // =============== META SAVE ===============
    saveMeta(): void {
        const d = this.details();
        if (!d) return;

        const raw = this.metaForm.getRawValue();
        const req: UpdateTicketAdminRequest = {
            status: raw.status ?? undefined,
            assigneeAdminId: raw.assigneeAdminId,
        };

        this.savingMeta.set(true);

        this.api
            .update(this.ticketId, req)
            .pipe(
                finalize(() => this.savingMeta.set(false)),
                takeUntil(this.destroy$),
            )
            .subscribe({
                next: (ticket) => {
                    const prev = this.details();
                    if (prev) this.details.set({ ...prev, ticket });
                    this.snack.open('Αποθηκεύτηκαν οι αλλαγές.', 'ΟΚ', { duration: 2000 });
                },
                error: () => this.snack.open('Αποτυχία αποθήκευσης.', 'OK', { duration: 2500 }),
            });
    }

    // =============== SEND REPLY ===============
    sendReply(): void {
        if (this.replyForm.invalid) return;

        const d = this.details();
        if (!d) return;

        const body = (this.replyForm.value.body || '').trim();
        if (!body) return;

        const me = this.currentAdmin();

        const req: SendAdminReplyRequest = {
            adminId: me?.boUserId ?? this.authService.currentUser?.boUserId ?? 0,
            body,
        };

        this.sending.set(true);

        this.api
            .sendAdminReply(this.ticketId, req)
            .pipe(
                finalize(() => this.sending.set(false)),
                takeUntil(this.destroy$),
            )
            .subscribe({
                next: (res) => {
                    this.details.set(res);
                    this.metaForm.patchValue({ status: res.ticket.status });
                    this.replyForm.reset({ body: '' });
                    this.snack.open('Η απάντηση στάλθηκε.', 'ΟΚ', { duration: 2000 });
                },
                error: () => this.snack.open('Αποτυχία αποστολής απάντησης.', 'OK', { duration: 2500 }),
            });
    }

    // =============== UI helpers ===============
    statusLabel(s: SupportTicketStatus): string {
        switch (s) {
            case SupportTicketStatus.Pending: return 'ΕΚΚΡΕΜΕΙ';
            case SupportTicketStatus.Answered: return 'ΑΠΑΝΤΗΘΗΚΕ';
            case SupportTicketStatus.Completed: return 'ΟΛΟΚΛΗΡΩΘΗΚΕ';
            case SupportTicketStatus.Deleted: return 'ΔΙΕΓΡΑΦΗ';
            default: return String(s);
        }
    }

    statusChipColor(s: SupportTicketStatus): 'primary' | 'accent' | 'warn' | undefined {
        switch (s) {
            case SupportTicketStatus.Pending: return 'warn';
            case SupportTicketStatus.Answered: return 'accent';
            case SupportTicketStatus.Completed: return 'primary';
            default: return undefined;
        }
    }

    formatDate(iso: string): string {
        const d = new Date(iso);
        const dd = String(d.getDate()).padStart(2, '0');
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const yyyy = d.getFullYear();
        const hh = String(d.getHours()).padStart(2, '0');
        const mi = String(d.getMinutes()).padStart(2, '0');
        return `${dd}/${mm}/${yyyy} ${hh}:${mi}`;
    }

    isAdminMsg(m: SupportTicketMessageDto): boolean {
        return m.sender === 'ADMIN';
    }

    adminNameById(id?: number | null): string {
        if (!id) return '';
        const u = this.adminUsers().find(x => x.boUserId === id);
        if (!u) return '';
        return `${u.firstname ?? ''} ${u.lastname ?? ''}`.trim() || u.email || '';
    }

    userInitials(name?: string | null): string {
        if (!name) return '?';
        const p = name.trim().split(/\s+/);
        return (p.length >= 2 ? p[0][0] + p[1][0] : name.slice(0, 2)).toUpperCase();
    }

    adminVmById(id?: number | null): AdminUserVm | null {
        if (!id) return null;
        return this.adminUsers().find(x => x.boUserId === id) ?? null;
    }

    openUserProfile(ticket: SupportTicketAdminDto): void {
        this.dialog.open(UserProfileDialogComponent, {
            width: '460px',
            maxWidth: '95vw',
            data: ticket,
        });
    }
}
