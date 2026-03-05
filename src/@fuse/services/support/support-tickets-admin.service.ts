import { Injectable } from '@angular/core';
import { delay, Observable, of, throwError } from 'rxjs';

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

    isReadByUser?: boolean;
    isReadByAdmin?: boolean;
}

export interface SupportTicketDetailsAdminDto {
    ticket: SupportTicketAdminDto;
    messages: SupportTicketMessageDto[];
}

export interface SupportTicketsQuery {
    q?: string | null;
    status?: SupportTicketStatus | null;
    category?: string | null;
    assigneeAdminId?: number | null;
    from?: string | null;
    to?: string | null;
    page?: number;
    pageSize?: number;
    sort?: string | null;
}

export interface PagedResult<T> {
    items: T[];
    total: number;
}

export interface UpdateTicketAdminRequest {
    status?: SupportTicketStatus | null;
    assigneeAdminId?: number | null;
}

export interface SendAdminReplyRequest {
    body: string;
}

@Injectable({ providedIn: 'root' })
export class SupportTicketsAdminService {
    private tickets: SupportTicketAdminDto[] = [];
    private messages: SupportTicketMessageDto[] = [];

    private nextTicketId = 2001;
    private nextMsgId = 5001;

    constructor() {
        this.seed();
    }

    // =========================================================
    // LIST
    // =========================================================
    list(query: SupportTicketsQuery): Observable<PagedResult<SupportTicketAdminDto>> {
        let data = [...this.tickets];

        if (query.q) {
            const q = query.q.toLowerCase();
            data = data.filter(t =>
                (t.subject || '').toLowerCase().includes(q) ||
                (t.userFullName || '').toLowerCase().includes(q)
            );
        }

        if (query.status) {
            data = data.filter(t => t.status === query.status);
        }

        if (query.category) {
            data = data.filter(t => t.category === query.category);
        }

        if (query.assigneeAdminId != null) {
            data = data.filter(t => t.assigneeAdminId === query.assigneeAdminId);
        }

        // sorting
        if (query.sort === 'createdAt:desc') {
            data.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
        } else {
            data.sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt));
        }

        const page = query.page ?? 1;
        const pageSize = query.pageSize ?? 10;
        const start = (page - 1) * pageSize;
        const paged = data.slice(start, start + pageSize);

        return of({
            items: paged,
            total: data.length
        }).pipe(delay(300));
    }

    // =========================================================
    // DETAILS
    // =========================================================
    getDetails(ticketId: number): Observable<SupportTicketDetailsAdminDto> {
        const ticket = this.tickets.find(t => t.id === ticketId);
        if (!ticket) return throwError(() => new Error('Ticket not found'));

        const msgs = this.messages
            .filter(m => m.ticketId === ticketId)
            .sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt));

        return of({
            ticket: { ...ticket },
            messages: msgs.map(m => ({ ...m }))
        }).pipe(delay(250));
    }

    // =========================================================
    // UPDATE META
    // =========================================================
    update(ticketId: number, req: UpdateTicketAdminRequest): Observable<SupportTicketAdminDto> {
        const ticket = this.tickets.find(t => t.id === ticketId);
        if (!ticket) return throwError(() => new Error('Ticket not found'));

        if (req.status != null) {
            ticket.status = req.status;
        }

        if (req.assigneeAdminId !== undefined) {
            ticket.assigneeAdminId = req.assigneeAdminId;
            ticket.assigneeAdminName = req.assigneeAdminId
                ? `Admin #${req.assigneeAdminId}`
                : null;
        }

        ticket.updatedAt = new Date().toISOString();
        this.recompute(ticketId);

        return of({ ...ticket }).pipe(delay(250));
    }

    // =========================================================
    // SEND ADMIN REPLY
    // =========================================================
    sendAdminReply(ticketId: number, req: SendAdminReplyRequest): Observable<SupportTicketDetailsAdminDto> {
        const ticket = this.tickets.find(t => t.id === ticketId);
        if (!ticket) return throwError(() => new Error('Ticket not found'));

        const now = new Date().toISOString();

        this.messages.push({
            id: this.nextMsgId++,
            ticketId,
            sender: 'ADMIN',
            body: req.body.trim(),
            createdAt: now,
            isReadByUser: false,
            isReadByAdmin: true,
        });

        ticket.status = SupportTicketStatus.Answered;
        ticket.updatedAt = now;

        this.recompute(ticketId);

        return this.getDetails(ticketId);
    }

    // =========================================================
    // MARK READ
    // =========================================================
    markReadByAdmin(ticketId: number): Observable<boolean> {
        this.messages
            .filter(m => m.ticketId === ticketId)
            .forEach(m => (m.isReadByAdmin = true));

        return of(true).pipe(delay(150));
    }

    // =========================================================
    // INTERNAL HELPERS
    // =========================================================
    private recompute(ticketId: number): void {
        const ticket = this.tickets.find(t => t.id === ticketId);
        if (!ticket) return;

        const msgs = this.messages.filter(m => m.ticketId === ticketId);

        ticket.repliesCount = Math.max(0, msgs.length - 1);
        ticket.hasUnreadAdminReply = msgs.some(
            m => m.sender === 'ADMIN' && m.isReadByUser === false
        );
    }

    private seed(): void {
        const now = new Date();
        const iso = (d: Date) => d.toISOString();

        const t1: SupportTicketAdminDto = {
            id: this.nextTicketId++,
            userId: 10,
            userFullName: 'Μιχάλης Μαλλιός',
            userEmail: 'mixalis@example.com',
            subject: 'Πρόβλημα σύνδεσης',
            category: 'Λογαριασμός',
            body: 'Δεν μπορώ να κάνω login.',
            status: SupportTicketStatus.Pending,
            createdAt: iso(new Date(now.getTime() - 3600000)),
            repliesCount: 0,
            assigneeAdminId: 1,
            assigneeAdminName: 'Michalis Mallios'
        };

        const t2: SupportTicketAdminDto = {
            id: this.nextTicketId++,
            userId: 10,
            userFullName: 'Αγγέλος Παπακώστας',
            userEmail: 'aggelos@example.com',
            subject: 'Πρόβλημα αποστολής μηνύματος',
            category: 'Λογαριασμός',
            body: 'Δεν μπορώ να στειλω μηνυματα.',
            status: SupportTicketStatus.Pending,
            createdAt: iso(new Date(now.getTime() - 3600000)),
            repliesCount: 0,
            assigneeAdminId: 1,
            assigneeAdminName: 'Anargiri Garavela'
        };

        this.tickets.push(t1);
        this.tickets.push(t2);

        this.messages.push({
            id: this.nextMsgId++,
            ticketId: t1.id,
            sender: 'USER',
            body: t1.body,
            createdAt: t1.createdAt,
            isReadByAdmin: false
        });

        this.recompute(t1.id);
    }
}