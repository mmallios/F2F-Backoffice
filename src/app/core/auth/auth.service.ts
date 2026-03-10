import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { environment } from '@fuse/environments/environment';

import { catchError, map, Observable, of, tap } from 'rxjs';
import { AuthUtils } from './auth.utils';

export interface BOCurrentUser {
    id: number;
    boUserId?: number;
    username?: string | null;
    firstname?: string | null;
    lastname?: string | null;
    email?: string | null;
    image?: string | null;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
    constructor(private _http: HttpClient) { }

    backofficeLogin(data: { email: string; password: string }): Observable<any> {
        return this._http
            .post<any>(`${environment.apiUrl}/auth/backoffice-login`, {
                email: data.email,
                password: data.password,
            })
            .pipe(
                tap((res) => {
                    if (res?.access_token) {
                        localStorage.setItem('bo_access_token', res.access_token);
                    }
                    if (res?.boUserId || res?.user) {
                        const userData = { ...(res.user ?? {}), boUserId: res.boUserId };
                        localStorage.setItem('bo_current_user', JSON.stringify(userData));
                    }
                })
            );
    }

    // ✅ Backoffice token getter
    get boAccessToken(): string | null {
        return localStorage.getItem('bo_access_token');
    }

    // ✅ Current logged-in backoffice user (stored on login)
    get currentUser(): BOCurrentUser | null {
        const raw = localStorage.getItem('bo_current_user');
        if (!raw) return null;
        try { return JSON.parse(raw) as BOCurrentUser; } catch { return null; }
    }

    // ✅ Backoffice logout
    signOut(): Observable<boolean> {
        localStorage.removeItem('bo_access_token');
        localStorage.removeItem('bo_current_user');
        return of(true);
    }

    // ✅ This is what AuthGuard/NoAuthGuard call
    check(): Observable<boolean> {
        const token = this.boAccessToken;

        if (!token) {
            return of(false);
        }

        // Optional fast local check (avoid request if expired)
        if (AuthUtils.isTokenExpired(token)) {
            localStorage.removeItem('bo_access_token');
            return of(false);
        }

        // ✅ Validate token with backend (your existing endpoint)
        return this._http
            .post<any>(`${environment.apiUrl}/auth/is-token-valid`, {
                accessToken: token,
            })
            .pipe(
                map((res) => {
                    const ok = res?.isValid === true;
                    if (!ok) {
                        localStorage.removeItem('bo_access_token');
                    }
                    return ok;
                }),
                catchError(() => {
                    localStorage.removeItem('bo_access_token');
                    return of(false);
                })
            );
    }
    resetPassword() { }
}
