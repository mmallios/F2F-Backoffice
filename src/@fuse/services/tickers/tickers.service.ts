import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '@fuse/environments/environment';

export interface TickerDto {
    id: number;
    title: string;
    type: number;
    linkUrl?: string | null;
    priority: number;
    startAt: string;
    endAt?: string | null;
    isActive: boolean;
    createdOn: string;
    updatedOn?: string | null;
}

export interface CreateTickerRequest {
    title: string;
    type: number;
    linkUrl?: string | null;
    priority?: number;
    startAt?: string | null;
    endAt?: string | null;
    isActive: boolean;
}

export interface UpdateTickerRequest {
    title: string;
    type: number;
    linkUrl?: string | null;
    priority: number;
    startAt: string;
    endAt?: string | null;
    isActive: boolean;
}

@Injectable({ providedIn: 'root' })
export class TickersService {
    private readonly base = `${environment.apiUrl}/ticker`;

    constructor(private http: HttpClient) {}

    getAll(): Observable<TickerDto[]> {
        return this.http.get<TickerDto[]>(this.base);
    }

    create(payload: CreateTickerRequest): Observable<{ id: number }> {
        return this.http.post<{ id: number }>(this.base, payload);
    }

    update(id: number, payload: UpdateTickerRequest): Observable<void> {
        return this.http.put<void>(`${this.base}/${id}`, payload);
    }

    delete(id: number): Observable<void> {
        return this.http.delete<void>(`${this.base}/${id}`);
    }

    reorder(orderedIds: number[]): Observable<void> {
        return this.http.put<void>(`${this.base}/reorder`, { orderedIds });
    }
}
