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
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';

import { Subject } from 'rxjs';
import { ConfirmDialogData, ConfirmDialogComponent } from '../dialogs/confirm-dialog.component';


export enum SupportTicketStatus {
    Pending = 1,
    Answered = 2,
    Completed = 3,
    Deleted = 4,
}

export type SupportSender = 'USER' | 'ADMIN';

export interface SupportTicketAdminDto {
    id: number;
    userId: number;
    userFullName?: string | null;
    userEmail?: string | null;

    subject?: string | null;
    category?: string | null;
    body: string;

    status: SupportTicketStatus;
    createdAt: string;
    updatedAt?: string | null;

    repliesCount?: number;
    hasUnreadAdminReply?: boolean;

    assigneeAdminId?: number | null;
    assigneeAdminName?: string | null;
}

export interface SupportTicketMessageDto {
    id: number;
    ticketId: number;
    sender: SupportSender;
    body: string;
    createdAt: string;
}

export interface SupportTicketDetailsAdminDto {
    ticket: SupportTicketAdminDto;
    messages: SupportTicketMessageDto[];
}

type AdminUserVm = { id: number; firstname: string; lastname: string; fullname: string; email?: string | null };

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
    ],
    templateUrl: './support-ticket-details.component.html',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SupportTicketDetailsAdminComponent implements OnInit, OnDestroy {
    private route = inject(ActivatedRoute);
    private fb = inject(FormBuilder);
    private dialog = inject(MatDialog);
    private snack = inject(MatSnackBar);

    private destroy$ = new Subject<void>();

    // ===== MOCK current admin =====
    currentAdmin = signal<AdminUserVm>({
        id: 900,
        firstname: 'Michalis',
        lastname: 'Mallios',
        fullname: 'Michalis Mallios',
        email: 'admin@fan2fan.gr',
    });

    // ===== MOCK admin list for dropdown =====
    adminUsers = signal<AdminUserVm[]>([
        { id: 900, firstname: 'Μιχάλης', lastname: 'Mallios', fullname: '', email: 'admin@fan2fan.gr' },
        { id: 901, firstname: 'Γιώργος', lastname: 'Παπαδόπουλος', fullname: '', email: 'g.p@fan2fan.gr' },
        { id: 902, firstname: 'Ελένη', lastname: 'Κωνσταντίνου', fullname: '', email: 'e.k@fan2fan.gr' },
    ]);

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

        this.loadMock();
    }

    ngOnDestroy(): void {
        this.destroy$.next();
        this.destroy$.complete();
    }

    // ================= MOCK LOAD =================
    loadMock(): void {
        this.loading.set(true);
        this.error.set(null);

        setTimeout(() => {
            const now = new Date();
            const iso = (d: Date) => d.toISOString();

            const ticket: SupportTicketAdminDto = {
                id: this.ticketId,
                userId: 1001,
                userFullName: 'Νίκος Κωνσταντίνου',
                userEmail: 'nikos.k@example.com',
                subject: 'Δεν μου έρχεται OTP',
                category: 'Λογαριασμός',
                body: 'Προσπαθώ να συνδεθώ αλλά δεν έρχεται ποτέ ο κωδικός OTP.',
                status: SupportTicketStatus.Pending,
                createdAt: iso(new Date(now.getTime() - 1000 * 60 * 60 * 10)),
                updatedAt: null,
                repliesCount: 1,
                hasUnreadAdminReply: false,

                // start unassigned so the button shows
                assigneeAdminId: null,
                assigneeAdminName: null,
            };

            const messages: SupportTicketMessageDto[] = [
                { id: 7001, ticketId: ticket.id, sender: 'USER', body: ticket.body, createdAt: ticket.createdAt },
                {
                    id: 7002,
                    ticketId: ticket.id,
                    sender: 'USER',
                    body: 'Το δοκίμασα 3 φορές, τίποτα. Μπορείτε να δείτε μήπως έχει θέμα το SMS provider;',
                    createdAt: iso(new Date(now.getTime() - 1000 * 60 * 60 * 6)),
                },
            ];

            this.details.set({ ticket, messages });

            this.metaForm.patchValue({
                status: ticket.status,
                assigneeAdminId: ticket.assigneeAdminId ?? null,
            });

            this.loading.set(false);
        }, 250);
    }

    // ================= Assign to me (Modal confirm) =================
    claimToMe(): void {
        const d = this.details();
        if (!d || d.ticket.assigneeAdminId) return;

        const me = this.currentAdmin();
        const data: ConfirmDialogData = {
            title: 'Ανάθεση ticket',
            message: `Θέλεις να αναθέσεις το ticket #${d.ticket.id} στον εαυτό σου (${me.firstname} ${me.lastname});`,
            confirmText: 'Ναι, ανάθεσε',
            cancelText: 'Άκυρο',
            icon: 'person_add',
        };

        this.dialog
            .open(ConfirmDialogComponent, {
                width: '520px',
                maxWidth: '92vw',
                data,
            })
            .afterClosed()
            .subscribe((ok: boolean) => {
                if (!ok) return;

                this.savingMeta.set(true);

                setTimeout(() => {
                    const updatedAt = new Date().toISOString();
                    const updatedTicket: SupportTicketAdminDto = {
                        ...d.ticket,
                        assigneeAdminId: me.id,
                        assigneeAdminName: `${me.firstname} ${me.lastname}`.trim(),
                        updatedAt,
                    };

                    this.details.set({ ...d, ticket: updatedTicket });
                    this.metaForm.patchValue({ assigneeAdminId: me.id });

                    this.savingMeta.set(false);

                    this.snack.open('Το ticket ανατέθηκε σε εσένα.', 'ΟΚ', { duration: 2500 });
                }, 350);
            });
    }

    // ================= META SAVE (mock) =================
    saveMeta(): void {
        const d = this.details();
        if (!d) return;

        this.savingMeta.set(true);
        const raw = this.metaForm.getRawValue();

        setTimeout(() => {
            const assigneeId = raw.assigneeAdminId ?? null;

            const updatedTicket: SupportTicketAdminDto = {
                ...d.ticket,
                status: raw.status ?? d.ticket.status,
                assigneeAdminId: assigneeId,
                assigneeAdminName: assigneeId ? this.adminNameById(assigneeId) : null,
                updatedAt: new Date().toISOString(),
            };

            this.details.set({ ...d, ticket: updatedTicket });
            this.savingMeta.set(false);

            this.snack.open('Αποθηκεύτηκαν οι αλλαγές.', 'ΟΚ', { duration: 2000 });
        }, 350);
    }

    // ================= SEND REPLY (mock) =================
    sendReply(): void {
        if (this.replyForm.invalid) return;

        const d = this.details();
        if (!d) return;

        const body = (this.replyForm.value.body || '').trim();
        if (!body) return;

        this.sending.set(true);

        setTimeout(() => {
            const nowIso = new Date().toISOString();
            const nextId = Math.max(...d.messages.map(m => m.id), 0) + 1;

            const msg: SupportTicketMessageDto = {
                id: nextId,
                ticketId: d.ticket.id,
                sender: 'ADMIN',
                body,
                createdAt: nowIso,
            };

            const updatedTicket: SupportTicketAdminDto = {
                ...d.ticket,
                status: SupportTicketStatus.Answered,
                updatedAt: nowIso,
                repliesCount: (d.ticket.repliesCount ?? 0) + 1,
            };

            this.details.set({ ticket: updatedTicket, messages: [...d.messages, msg] });
            this.metaForm.patchValue({ status: updatedTicket.status });
            this.replyForm.reset({ body: '' });

            this.sending.set(false);
            this.snack.open('Η απάντηση στάλθηκε.', 'ΟΚ', { duration: 2000 });
        }, 350);
    }

    // ================= UI helpers =================
    statusLabel(s: SupportTicketStatus): string {
        switch (s) {
            case SupportTicketStatus.Pending:
                return 'ΕΚΚΡΕΜΕΙ';
            case SupportTicketStatus.Answered:
                return 'ΑΠΑΝΤΗΘΗΚΕ';
            case SupportTicketStatus.Completed:
                return 'ΟΛΟΚΛΗΡΩΘΗΚΕ';
            case SupportTicketStatus.Deleted:
                return 'ΔΙΕΓΡΑΦΗ';
            default:
                return String(s);
        }
    }

    // Material-only: use chip color instead of custom css
    statusChipColor(s: SupportTicketStatus): 'primary' | 'accent' | 'warn' | undefined {
        switch (s) {
            case SupportTicketStatus.Pending:
                return 'warn';
            case SupportTicketStatus.Answered:
                return 'accent';
            case SupportTicketStatus.Completed:
                return 'primary';
            case SupportTicketStatus.Deleted:
                return undefined;
            default:
                return undefined;
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
        if (!id) return '—';
        const u = this.adminUsers().find(x => Number(x.id) === Number(id));
        if (!u) return '—';
        return `${u.firstname ?? ''} ${u.lastname ?? ''}`.trim() || u.email || '—';
    }
}