import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '@fuse/environments/environment';

// ── DTOs ────────────────────────────────────────────────────────────

export interface FanCardStats {
    totalCards: number;
    totalUsages: number;
    usedCards: number;
    totalReports: number;
}

export interface FanCardListItem {
    id: number;
    cardCode: string;
    seasonId: number;
    isActive: boolean;
    ownerId?: number | null;
    ownerFullName?: string | null;
    ownerImage?: string | null;
    ownerCode?: string | null;
    usageCount: number;
    reportsCount: number;
    lastUsedAt?: string | null;
    lastUsageTeamLogo?: string | null;
}

export interface FanCardsPagedResult {
    items: FanCardListItem[];
    total: number;
}

export interface FanCardUsageDetail {
    id: number;
    fanCardId: number;
    used: boolean;
    usedAt: string;
    usedByFullName: string;
    usedByImage?: string | null;
    usedByCode?: string | null;
    eventId: number;
    eventDate: string;
    homeTeamName?: string | null;
    homeTeamLogo?: string | null;
    awayTeamName?: string | null;
    awayTeamLogo?: string | null;
    competitionName?: string | null;
    matchday?: string | null;
}

export interface FanCardReportDetail {
    id: number;
    fanCardId: number;
    reportedByUserId: number;
    reportedByFullName?: string | null;
    reportedByImage?: string | null;
    reportedByCode?: string | null;
    reportedAt: string;
    status: number;            // 1=Pending, 2=Resolved
    eventId: number;
    eventDate: string;
    homeTeamName?: string | null;
    homeTeamLogo?: string | null;
    awayTeamName?: string | null;
    awayTeamLogo?: string | null;
    competitionName?: string | null;
    matchday?: string | null;
}

export interface AllReportItem {
    id: number;
    fanCardId: number;
    cardCode?: string | null;
    reportedByUserId: number;
    reportedByFullName?: string | null;
    reportedByImage?: string | null;
    reportedByCode?: string | null;
    reportedAt: string;
    status: number;
    adminComment?: string | null;
    eventId?: number | null;
    eventDate?: string | null;
    homeTeamName?: string | null;
    homeTeamLogo?: string | null;
    awayTeamName?: string | null;
    awayTeamLogo?: string | null;
    competitionName?: string | null;
    matchday?: string | null;
}

export interface AllReportsPagedResult {
    items: AllReportItem[];
    total: number;
}

export interface EventFanCardUsage {
    id: number;
    fanCardId: number;
    cardCode?: string | null;
    used: boolean;
    usedAt: string;
    userFullName?: string | null;
    userImage?: string | null;
    userCode?: string | null;
}

export interface FanCardUpsertPayload {
    cardCode: string;
    ownerId?: number | null;
    seasonId: number;
    isActive: boolean;
}

export interface FanCardSeason {
    id: number;
    code: string;
    name: string;
}

// ── Service ─────────────────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class FanCardsAdminService {

    private readonly base = `${environment.apiUrl}/BOFanCards`;

    constructor(private _http: HttpClient) { }

    getStats(): Observable<FanCardStats> {
        return this._http.get<FanCardStats>(`${this.base}/stats`);
    }

    getCards(q?: string, page = 1, pageSize = 20, dateFrom?: string, dateTo?: string, hasReports?: boolean, ownerQ?: string, ownerId?: number, isActive?: boolean): Observable<FanCardsPagedResult> {
        let params = new HttpParams()
            .set('page', page)
            .set('pageSize', pageSize);
        if (q) params = params.set('q', q);
        if (dateFrom) params = params.set('dateFrom', dateFrom);
        if (dateTo) params = params.set('dateTo', dateTo);
        if (hasReports != null) params = params.set('hasReports', String(hasReports));
        if (ownerQ) params = params.set('ownerQ', ownerQ);
        if (ownerId != null) params = params.set('ownerId', String(ownerId));
        if (isActive != null) params = params.set('isActive', String(isActive));
        return this._http.get<FanCardsPagedResult>(this.base, { params });
    }

    getSeasons(): Observable<FanCardSeason[]> {
        return this._http.get<FanCardSeason[]>(`${this.base}/seasons`);
    }

    createCard(payload: FanCardUpsertPayload): Observable<{ id: number }> {
        return this._http.post<{ id: number }>(this.base, payload);
    }

    updateCard(id: number, payload: FanCardUpsertPayload): Observable<void> {
        return this._http.put<void>(`${this.base}/${id}`, payload);
    }

    getUsages(cardId: number): Observable<FanCardUsageDetail[]> {
        return this._http.get<FanCardUsageDetail[]>(`${this.base}/${cardId}/usages`);
    }

    getRequests(cardId: number): Observable<FanCardUsageDetail[]> {
        return this._http.get<FanCardUsageDetail[]>(`${this.base}/${cardId}/requests`);
    }

    getReports(cardId: number): Observable<FanCardReportDetail[]> {
        return this._http.get<FanCardReportDetail[]>(`${this.base}/${cardId}/reports`);
    }

    getAllReports(page = 1, pageSize = 20, ownerId?: number, eventId?: number, status?: number): Observable<AllReportsPagedResult> {
        let params = new HttpParams()
            .set('page', page)
            .set('pageSize', pageSize);
        if (ownerId != null) params = params.set('ownerId', String(ownerId));
        if (eventId != null) params = params.set('eventId', String(eventId));
        if (status != null) params = params.set('status', String(status));
        return this._http.get<AllReportsPagedResult>(`${this.base}/reports`, { params });
    }

    getEventUsages(eventId: number): Observable<EventFanCardUsage[]> {
        return this._http.get<EventFanCardUsage[]>(`${this.base}/event/${eventId}/usages`);
    }

    saveReportComment(reportId: number, comment: string | null): Observable<void> {
        return this._http.patch<void>(`${this.base}/reports/${reportId}/comment`, { comment });
    }
}
