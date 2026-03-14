import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../environments/environment';

// ── Action types ─────────────────────────────────────────────────────────────

export type AdminActionType =
    | 'SUPPORT_REPLY'
    | 'ENTITY_CREATE'
    | 'ENTITY_EDIT'
    | 'ENTITY_DELETE'
    | 'ANNOUNCEMENT_CREATE'
    | 'ANNOUNCEMENT_EDIT'
    | 'LOGIN'
    | 'LOGOUT'
    | 'OTHER';

export const ADMIN_ACTION_LABELS: Record<AdminActionType, string> = {
    SUPPORT_REPLY: 'Απάντηση Υποστήριξης',
    ENTITY_CREATE: 'Δημιουργία Οντότητας',
    ENTITY_EDIT: 'Επεξεργασία Οντότητας',
    ENTITY_DELETE: 'Διαγραφή Οντότητας',
    ANNOUNCEMENT_CREATE: 'Δημιουργία Ανακοίνωσης',
    ANNOUNCEMENT_EDIT: 'Επεξεργασία Ανακοίνωσης',
    LOGIN: 'Σύνδεση',
    LOGOUT: 'Αποσύνδεση',
    OTHER: 'Άλλο',
};

// ── DTOs ──────────────────────────────────────────────────────────────────────

export interface AdminActivityOverviewDto {
    totalAdmins: number;
    totalActionsToday: number;
    totalActionsThisWeek: number;
    totalLoginSessions: number;
}

export interface AdminActionLogDto {
    id: number;
    boUserId: number;
    adminFullName?: string | null;
    adminImage?: string | null;
    actionType: AdminActionType;
    entityType?: string | null;
    entityId?: number | null;
    description: string;
    createdAt: string;
}

export interface AdminLoginSessionDto {
    id: number;
    boUserId: number;
    userAgent?: string | null;
    deviceType: 'Mobile' | 'Desktop';
    loginAt: string;
    logoutAt?: string | null;
    durationMinutes?: number | null;
    isActive: boolean;
}

export interface AdminActivityRowDto {
    boUserId: number;
    fullName: string;
    email?: string | null;
    image?: string | null;
    roleName?: string | null;
    isActive: boolean;
    totalActions: number;
    actionsToday: number;
    actionsThisWeek: number;
    lastActionAt?: string | null;
    totalLoginSessions: number;
    lastLoginAt?: string | null;
}

export interface AdminActivityResponse {
    overview: AdminActivityOverviewDto;
    admins: AdminActivityRowDto[];
}

export interface AdminActionsQuery {
    boUserId?: number | null;
    actionType?: AdminActionType | null;
    from?: string | null;
    to?: string | null;
    page?: number;
    pageSize?: number;
}

export interface PagedResult<T> {
    items: T[];
    total: number;
}

// ── Service ───────────────────────────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class AdminActivityService {
    private http = inject(HttpClient);
    private readonly baseUrl = environment.apiUrl + '/boAdmins';

    getActivitySummary(): Observable<AdminActivityResponse> {
        return this.http.get<AdminActivityResponse>(`${this.baseUrl}/activity/summary`);
    }

    getActions(query: AdminActionsQuery): Observable<PagedResult<AdminActionLogDto>> {
        let params = new HttpParams();
        if (query.boUserId != null) params = params.set('boUserId', query.boUserId);
        if (query.actionType != null) params = params.set('actionType', query.actionType);
        if (query.from != null) params = params.set('from', query.from);
        if (query.to != null) params = params.set('to', query.to);
        if (query.page != null) params = params.set('page', query.page);
        if (query.pageSize != null) params = params.set('pageSize', query.pageSize);
        return this.http.get<PagedResult<AdminActionLogDto>>(`${this.baseUrl}/activity/actions`, { params });
    }

    getSessions(boUserId: number): Observable<AdminLoginSessionDto[]> {
        return this.http.get<AdminLoginSessionDto[]>(`${this.baseUrl}/${boUserId}/sessions`);
    }

    getOnlineAdmins(): Observable<number[]> {
        return this.http.get<number[]>(`${this.baseUrl}/online`);
    }
}
