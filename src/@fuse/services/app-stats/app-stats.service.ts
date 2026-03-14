import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../environments/environment';

// ── DTOs ─────────────────────────────────────────────────────────────────────

export interface AppDownloadsDto {
    googlePlay: number;
    appStore: number;
    total: number;
}

export interface AppStatsOverviewDto {
    activeSessions: number;
    newRegistrationsToday: number;
    pendingRegistrations: number;
    completedRegistrations: number;
    totalUsers: number;
    downloads: AppDownloadsDto;
}

export interface RecentConnectionDto {
    userId: number;
    fullname: string;
    code?: string | null;
    image?: string | null;
    platform?: string | null;
    deviceModel?: string | null;
    operatingSystem?: string | null;
    loginTime?: string | null;
    lastSeen?: string | null;
    ipAddress?: string | null;
}

export interface RecentConnectionsResult {
    items: RecentConnectionDto[];
    total: number;
}

export interface CountryStatsDto {
    countryId: number;
    countryName: string;
    totalUsers: number;
    todayUsers: number;
}

// ── Service ───────────────────────────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class AppStatsService {
    private http = inject(HttpClient);
    private readonly baseUrl = `${environment.apiUrl}/boAppStats`;

    getOverview(): Observable<AppStatsOverviewDto> {
        return this.http.get<AppStatsOverviewDto>(`${this.baseUrl}/overview`);
    }

    getRecentConnections(limit = 10): Observable<RecentConnectionsResult> {
        const params = new HttpParams().set('limit', limit);
        return this.http.get<RecentConnectionsResult>(
            `${this.baseUrl}/recent-connections`,
            { params }
        );
    }

    getAllConnections(page = 1, pageSize = 20): Observable<RecentConnectionsResult> {
        const params = new HttpParams()
            .set('page', page)
            .set('pageSize', pageSize);
        return this.http.get<RecentConnectionsResult>(
            `${this.baseUrl}/connections`,
            { params }
        );
    }

    getCountries(): Observable<CountryStatsDto[]> {
        return this.http.get<CountryStatsDto[]>(`${this.baseUrl}/countries`);
    }
}
