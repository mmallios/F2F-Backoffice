import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface ContestListItemDto {
    id: number;
    title: string;
    image?: string | null;
    isActive: boolean;
    publishDate: string;
    startDate: string;
    endDate: string;
    entriesCount: number;
}

export interface ContestCreateDto {
    title: string;
    description?: string | null;
    image?: string | null;
    isActive: boolean;
    publishDate: string;
    startDate: string;
    endDate: string;
    maxEntriesPerUser: number;
    maxTotalEntries: number;
    totalWinners?: number | null;
    sendNotificationsToWinners: boolean;
}

export interface ContestEntryUserDto {
    id: number;
    fullName?: string | null;
    email?: string | null;
    image?: string | null;
    code?: string | null;
}

export interface ContestEntryDto {
    id: number;
    userId: number;
    user: ContestEntryUserDto;
    participatedAt: string;
    isWinner: boolean;
}

export interface ContestDetailsDto {
    id: number;
    title: string;
    description?: string | null;
    context?: string | null;
    image?: string | null;
    isActive: boolean;
    publishDate: string;
    startDate: string;
    endDate: string;
    maxEntriesPerUser: number;
    maxTotalEntries: number;
    totalWinners?: number | null;
    sendNotificationsToWinners: boolean;
    entriesCount: number;
    entries: ContestEntryDto[];
}

export interface ContestUpdateDto {
    title: string;
    description?: string | null;
    image?: string | null;
    isActive: boolean;
    publishDate: string;
    startDate: string;
    endDate: string;
    maxEntriesPerUser: number;
    maxTotalEntries: number;
    totalWinners?: number | null;
    sendNotificationsToWinners: boolean;
}

@Injectable({ providedIn: 'root' })
export class ContestsAdminService {
    private readonly base: string;

    constructor(private http: HttpClient) {
        this.base = `${environment.apiUrl}/Contests`;
    }

    /** GET /api/Contests/contests */
    list(): Observable<ContestListItemDto[]> {
        return this.http.get<ContestListItemDto[]>(`${this.base}/contests`);
    }

    /** GET /api/Contests/{id}?includeParticipants=true */
    getDetails(id: number, includeParticipants = true): Observable<ContestDetailsDto> {
        const params = new HttpParams().set('includeParticipants', String(includeParticipants));
        return this.http.get<ContestDetailsDto>(`${this.base}/${id}`, { params });
    }

    /** PUT /api/Contests/{id} */
    update(id: number, dto: ContestUpdateDto): Observable<void> {
        return this.http.put<void>(`${this.base}/${id}`, dto);
    }

    /** PUT /api/Contests/{id}/winners */
    markWinners(id: number, entryIds: number[]): Observable<{ updated: number }> {
        return this.http.put<{ updated: number }>(`${this.base}/${id}/winners`, entryIds);
    }

    /** POST /api/Contests */
    create(dto: ContestCreateDto): Observable<{ id: number }> {
        return this.http.post<{ id: number }>(this.base, dto);
    }

    /** DELETE /api/Contests/{id} */
    delete(id: number): Observable<void> {
        return this.http.delete<void>(`${this.base}/${id}`);
    }

    /** DELETE /api/Contests/{contestId}/entries/{entryId} */
    removeEntry(contestId: number, entryId: number): Observable<void> {
        return this.http.delete<void>(`${this.base}/${contestId}/entries/${entryId}`);
    }
}
