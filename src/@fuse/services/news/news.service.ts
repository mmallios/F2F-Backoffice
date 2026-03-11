import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '@fuse/environments/environment';

export interface BONewsItem {
    title: string;
    link: string;
    summary: string;
    imageUrl?: string | null;
    publishedAt: string;
    isHidden: boolean;
    toggledByAdminId?: number | null;
    toggledByAdminName?: string | null;
    toggledAt?: string | null;
}

@Injectable({ providedIn: 'root' })
export class NewsService {
    private readonly _base = `${environment.apiUrl}/BONews`;

    constructor(private _http: HttpClient) { }

    getAll(): Observable<BONewsItem[]> {
        return this._http.get<BONewsItem[]>(this._base);
    }

    toggleVisibility(postLink: string, isHidden: boolean, adminUserId: number | null): Observable<{ success: boolean; isHidden: boolean }> {
        return this._http.post<{ success: boolean; isHidden: boolean }>(
            `${this._base}/toggle-visibility`,
            { postLink, isHidden, adminUserId }
        );
    }
}
