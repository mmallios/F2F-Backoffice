import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../environments/environment';

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
    userCode?: string | null;
    userImage?: string | null;
    userUsername?: string | null;
    userPoints?: number | null;

    subject?: string | null;
    category?: string | null;

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
    senderAdminId?: number | null;
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
    adminId: number;
    body: string;
}

/** Aggregated stats for one entity (overall or per-admin). */
export interface TicketStatsDto {
    totalTickets: number;
    completedTickets: number;
    openTickets: number;
    avgMinutesToFirstAdminResponse: number | null;
    avgMinutesBetweenResponses: number | null;
}

/** Stats row for a single BO admin. */
export interface AdminStatsRowDto extends TicketStatsDto {
    boUserId: number;
    fullName: string;
    email?: string | null;
    image?: string | null;
}

/** Response of GET /api/BOSupport/stats */
export interface SupportStatsResponse {
    overall: TicketStatsDto;
    admins: AdminStatsRowDto[];
}

/** Matches AdminRowDto from /api/BORoles/admins */
export interface AdminUserDto {
    boUserId: number;
    userId: number;
    fullName: string;
    firstname?: string | null;
    lastname?: string | null;
    email?: string | null;
    image?: string | null;
    isActive: boolean;
}

@Injectable({ providedIn: 'root' })
export class SupportTicketsAdminService {
    private readonly base: string;

    constructor(private http: HttpClient) {
        this.base = `${environment.apiUrl}/BOSupport`;
    }

    /**
     * List tickets with filters and pagination.
     * GET /api/BOSupport/tickets
     */
    list(query: SupportTicketsQuery): Observable<PagedResult<SupportTicketAdminDto>> {
        let params = new HttpParams();

        if (query.q) params = params.set('q', query.q);
        if (query.status != null) params = params.set('status', String(query.status));
        if (query.category) params = params.set('category', query.category);
        if (query.assigneeAdminId != null) params = params.set('assigneeAdminId', String(query.assigneeAdminId));
        if (query.from) params = params.set('from', query.from);
        if (query.to) params = params.set('to', query.to);
        if (query.page) params = params.set('page', String(query.page));
        if (query.pageSize) params = params.set('pageSize', String(query.pageSize));
        if (query.sort) params = params.set('sort', query.sort);

        return this.http.get<PagedResult<SupportTicketAdminDto>>(`${this.base}/tickets`, { params });
    }

    /**
     * Get ticket details for admin.
     * GET /api/BOSupport/tickets/{id}
     */
    getDetails(ticketId: number): Observable<SupportTicketDetailsAdminDto> {
        return this.http.get<SupportTicketDetailsAdminDto>(`${this.base}/tickets/${ticketId}`);
    }

    /**
     * Update ticket status / assignee.
     * PUT /api/BOSupport/tickets/{id}
     */
    update(ticketId: number, req: UpdateTicketAdminRequest): Observable<SupportTicketAdminDto> {
        return this.http.put<SupportTicketAdminDto>(`${this.base}/tickets/${ticketId}`, req);
    }

    /**
     * Send an admin reply.
     * POST /api/BOSupport/tickets/{id}/reply
     */
    sendAdminReply(ticketId: number, req: SendAdminReplyRequest): Observable<SupportTicketDetailsAdminDto> {
        return this.http.post<SupportTicketDetailsAdminDto>(`${this.base}/tickets/${ticketId}/reply`, req);
    }

    /**
     * Mark all user messages as read by admin.
     * PUT /api/BOSupport/tickets/{id}/mark-read
     */
    markReadByAdmin(ticketId: number): Observable<void> {
        return this.http.put<void>(`${this.base}/tickets/${ticketId}/mark-read`, {});
    }

    /**
     * Load all backoffice admin users (with BOUserId).
     * GET /api/BORoles/admins
     */
    loadAdmins(): Observable<AdminUserDto[]> {
        const rolesBase = `${environment.apiUrl}/BORoles`;
        return this.http.get<AdminUserDto[]>(`${rolesBase}/admins`);
    }

    /**
     * Get overall + per-admin support stats.
     * GET /api/BOSupport/stats
     */
    getStats(): Observable<SupportStatsResponse> {
        return this.http.get<SupportStatsResponse>(`${this.base}/stats`);
    }

    /**
     * Get paginated tickets assigned to a specific BO admin.
     * GET /api/BOSupport/admin/{boUserId}/tickets
     */
    getAdminTickets(boUserId: number, query: Omit<SupportTicketsQuery, 'q' | 'assigneeAdminId'>): Observable<PagedResult<SupportTicketAdminDto>> {
        let params = new HttpParams();
        if (query.status != null) params = params.set('status', String(query.status));
        if (query.category) params = params.set('category', query.category);
        if (query.from) params = params.set('from', query.from);
        if (query.to) params = params.set('to', query.to);
        if (query.page) params = params.set('page', String(query.page));
        if (query.pageSize) params = params.set('pageSize', String(query.pageSize));
        if (query.sort) params = params.set('sort', query.sort);
        return this.http.get<PagedResult<SupportTicketAdminDto>>(`${this.base}/admin/${boUserId}/tickets`, { params });
    }
}
