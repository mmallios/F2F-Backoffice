import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '@fuse/environments/environment';

// ─── DTOs ────────────────────────────────────────────────────────────────────

export interface AwayTripEventDto {
    eventId: number;
    homeTeamName?: string | null;
    homeTeamLogoUrl?: string | null;
    awayTeamName?: string | null;
    awayTeamLogoUrl?: string | null;
    eventDate: string;
    competitionName?: string | null;
    matchday?: string | null;
}

export interface AwayTripCategoryDto {
    id: number;
    name: string;
    price: number;
    maxPerUser: number;
    totalAvailable: number;
    seatViewImageUrl?: string | null;
    order: number;
}

export interface AwayTripNotificationDto {
    id: number;
    title: string;
    description?: string | null;
    imageUrl?: string | null;
    sentAt: string;
}

export interface AwayTripListDto {
    id: number;
    title: string;
    description?: string | null;
    imageUrl?: string | null;
    isActive: boolean;
    interestCount: number;
    userHasInterest: boolean;
    event?: AwayTripEventDto | null;
}

export interface AwayTripDetailDto extends AwayTripListDto {
    categories: AwayTripCategoryDto[];
    notifications: AwayTripNotificationDto[];
}

export interface AwayTripInterestDto {
    interestId: number;
    userId: number;
    userCode: string;
    userFullName: string;
    userImageUrl?: string | null;
    userEmail: string;
    registeredAt: string;
}

export interface CreateAwayTripRequest {
    title: string;
    description?: string | null;
    imageUrl?: string | null;
    eventId?: number | null;
}

export interface UpdateAwayTripRequest extends CreateAwayTripRequest {
    isActive: boolean;
}

export interface CreateCategoryRequest {
    name: string;
    price: number;
    maxPerUser: number;
    totalAvailable: number;
    seatViewImageUrl?: string | null;
    order: number;
}

export type UpdateCategoryRequest = CreateCategoryRequest;

export interface SendAwayTripNotificationRequest {
    title: string;
    description?: string | null;
    imageUrl?: string | null;
    sendEmailNotification: boolean;
    sentByBoUserId?: number | null;
}

// ─── Service ─────────────────────────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class BOAwayTripsService {
    private readonly base = `${environment.apiUrl}/backoffice/away-trips`;

    constructor(private _http: HttpClient) { }

    // ── Trips ────────────────────────────────────────────────────────────────

    getTrips(): Observable<AwayTripListDto[]> {
        return this._http.get<AwayTripListDto[]>(this.base);
    }

    getTripById(id: number): Observable<AwayTripDetailDto> {
        return this._http.get<AwayTripDetailDto>(`${this.base}/${id}`);
    }

    createTrip(req: CreateAwayTripRequest): Observable<AwayTripListDto> {
        return this._http.post<AwayTripListDto>(this.base, req);
    }

    updateTrip(id: number, req: UpdateAwayTripRequest): Observable<void> {
        return this._http.put<void>(`${this.base}/${id}`, req);
    }

    deleteTrip(id: number): Observable<void> {
        return this._http.delete<void>(`${this.base}/${id}`);
    }

    toggleActive(id: number): Observable<{ isActive: boolean }> {
        return this._http.post<{ isActive: boolean }>(`${this.base}/${id}/toggle-active`, {});
    }

    // ── Categories ───────────────────────────────────────────────────────────

    getCategories(tripId: number): Observable<AwayTripCategoryDto[]> {
        return this._http.get<AwayTripCategoryDto[]>(`${this.base}/${tripId}/categories`);
    }

    createCategory(tripId: number, req: CreateCategoryRequest): Observable<AwayTripCategoryDto> {
        return this._http.post<AwayTripCategoryDto>(`${this.base}/${tripId}/categories`, req);
    }

    updateCategory(tripId: number, catId: number, req: UpdateCategoryRequest): Observable<void> {
        return this._http.put<void>(`${this.base}/${tripId}/categories/${catId}`, req);
    }

    deleteCategory(tripId: number, catId: number): Observable<void> {
        return this._http.delete<void>(`${this.base}/${tripId}/categories/${catId}`);
    }

    // ── Interests ────────────────────────────────────────────────────────────

    getInterests(tripId: number): Observable<AwayTripInterestDto[]> {
        return this._http.get<AwayTripInterestDto[]>(`${this.base}/${tripId}/interests`);
    }

    // ── Notifications ────────────────────────────────────────────────────────

    getNotifications(tripId: number): Observable<AwayTripNotificationDto[]> {
        return this._http.get<AwayTripNotificationDto[]>(`${this.base}/${tripId}/notifications`);
    }

    sendNotification(tripId: number, req: SendAwayTripNotificationRequest): Observable<AwayTripNotificationDto> {
        return this._http.post<AwayTripNotificationDto>(`${this.base}/${tripId}/send-notification`, req);
    }
}
