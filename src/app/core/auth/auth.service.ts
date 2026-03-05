import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { environment } from '@fuse/environments/environment';

import { catchError, map, Observable, of, tap } from 'rxjs';
import { AuthUtils } from './auth.utils';

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
                        localStorage.setItem(
                            'bo_access_token',
                            res.access_token
                        );
                    }
                })
            );
    }

    // ✅ Backoffice token getter
    get boAccessToken(): string | null {
        return localStorage.getItem('bo_access_token');
    }

    // ✅ Backoffice logout
    signOut(): Observable<boolean> {
        localStorage.removeItem('bo_access_token');
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
