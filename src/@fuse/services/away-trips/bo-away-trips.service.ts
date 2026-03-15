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
    totalAvailable: number;
    bookedCount: number;
    seatViewImageUrl?: string | null;
    order: number;
}

export interface AwayTripNotificationDto {
    id: number;
    title: string;
    description?: string | null;
    imageUrl?: string | null;
    sentAt: string;
    recipientCount: number;
}

export interface AwayTripListDto {
    id: number;
    title: string;
    description?: string | null;
    imageUrl?: string | null;
    isActive: boolean;
    interestCount: number;
    userHasInterest: boolean;
    totalBookedTickets: number;
    totalAvailableTickets: number;
    event?: AwayTripEventDto | null;
}

export interface AwayTripDetailDto extends AwayTripListDto {
    maxTicketsPerUser: number;
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

export interface AwayTripBookingDto {
    id: number;
    userId: number;
    userFullName: string;
    userCode: string;
    userImageUrl?: string | null;
    userEmail: string;
    categoryId: number;
    categoryName: string;
    quantity: number;
    notes?: string | null;
    bookedAt: string;
}

export interface CreateAwayTripRequest {
    title: string;
    description?: string | null;
    imageUrl?: string | null;
    eventId?: number | null;
    maxTicketsPerUser?: number;
}

export interface UpdateAwayTripRequest extends CreateAwayTripRequest {
    isActive: boolean;
}

export interface CreateCategoryRequest {
    name: string;
    price: number;
    totalAvailable: number;
    seatViewImageUrl?: string | null;
    order: number;
}

export type UpdateCategoryRequest = CreateCategoryRequest;

export interface CreateAwayTripBookingRequest {
    userId: number;
    categoryId: number;
    quantity: number;
    notes?: string | null;
}

export type UpdateAwayTripBookingRequest = CreateAwayTripBookingRequest;

export interface SendAwayTripNotificationRequest {
    title: string;
    description?: string | null;
    imageUrl?: string | null;
    sendEmailNotification: boolean;
    sentByBoUserId?: number | null;
    targetUserIds?: number[] | null;
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

    // ── Bookings ─────────────────────────────────────────────────────────────

    getBookings(tripId: number): Observable<AwayTripBookingDto[]> {
        return this._http.get<AwayTripBookingDto[]>(`${this.base}/${tripId}/bookings`);
    }

    createBooking(tripId: number, req: CreateAwayTripBookingRequest): Observable<AwayTripBookingDto> {
        return this._http.post<AwayTripBookingDto>(`${this.base}/${tripId}/bookings`, req);
    }

    updateBooking(tripId: number, bookingId: number, req: UpdateAwayTripBookingRequest): Observable<void> {
        return this._http.put<void>(`${this.base}/${tripId}/bookings/${bookingId}`, req);
    }

    deleteBooking(tripId: number, bookingId: number): Observable<void> {
        return this._http.delete<void>(`${this.base}/${tripId}/bookings/${bookingId}`);
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
