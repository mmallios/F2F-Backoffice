import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '@fuse/environments/environment';

// ─── DTOs ────────────────────────────────────────────────────────────────────

export interface OfferCategoryDto {
    id: number;
    code: string;
    label: string;
    icon?: string | null;
    order: number;
    isActive: boolean;
    offerCount: number;
}

export interface OfferDto {
    id: number;
    categoryId: number;
    categoryLabel: string;
    title: string;
    description: string;
    imageUrl?: string | null;
    couponCode?: string | null;
    discountLabel?: string | null;
    validUntil?: string | null;
    terms?: string | null;
    detailsHtml?: string | null;
    ctaLabel?: string | null;
    ctaUrl?: string | null;
    address?: string | null;
    lat?: number | null;
    lng?: number | null;
    isActive: boolean;
}

export interface CreateOfferCategoryRequest {
    code: string;
    label: string;
    icon?: string | null;
    order: number;
}

export interface UpdateOfferCategoryRequest {
    code: string;
    label: string;
    icon?: string | null;
    order: number;
    isActive: boolean;
}

export interface CreateOfferRequest {
    categoryId: number;
    title: string;
    description: string;
    imageUrl?: string | null;
    couponCode?: string | null;
    discountLabel?: string | null;
    validUntil?: string | null;
    terms?: string | null;
    detailsHtml?: string | null;
    ctaLabel?: string | null;
    ctaUrl?: string | null;
    address?: string | null;
    lat?: number | null;
    lng?: number | null;
}

export type UpdateOfferRequest = CreateOfferRequest;

// ─── Service ─────────────────────────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class BOOffersService {
    private readonly base = `${environment.apiUrl}/offers`;

    constructor(private _http: HttpClient) { }

    // ── Categories ───────────────────────────────────────────────────────────

    getCategories(includeInactive = true): Observable<OfferCategoryDto[]> {
        const params = new HttpParams().set('includeInactive', String(includeInactive));
        return this._http.get<OfferCategoryDto[]>(`${this.base}/categories`, { params });
    }

    createCategory(req: CreateOfferCategoryRequest): Observable<OfferCategoryDto> {
        return this._http.post<OfferCategoryDto>(`${this.base}/categories`, req);
    }

    updateCategory(id: number, req: UpdateOfferCategoryRequest): Observable<OfferCategoryDto> {
        return this._http.put<OfferCategoryDto>(`${this.base}/categories/${id}`, req);
    }

    deleteCategory(id: number): Observable<void> {
        return this._http.delete<void>(`${this.base}/categories/${id}`);
    }

    // ── Offers ───────────────────────────────────────────────────────────────

    getOffers(categoryId?: number, includeInactive = true): Observable<OfferDto[]> {
        let params = new HttpParams().set('includeInactive', String(includeInactive));
        if (categoryId != null) params = params.set('categoryId', String(categoryId));
        return this._http.get<OfferDto[]>(this.base, { params });
    }

    createOffer(req: CreateOfferRequest): Observable<OfferDto> {
        return this._http.post<OfferDto>(this.base, req);
    }

    updateOffer(id: number, req: UpdateOfferRequest): Observable<OfferDto> {
        return this._http.put<OfferDto>(`${this.base}/${id}`, req);
    }

    deleteOffer(id: number): Observable<void> {
        return this._http.delete<void>(`${this.base}/${id}`);
    }
}
