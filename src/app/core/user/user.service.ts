import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { environment } from '@fuse/environments/environment';
import { User } from '@fuse/services/users/users.service';

import { Observable, ReplaySubject, tap } from 'rxjs';



@Injectable({ providedIn: 'root' })
export class UserService {
    private _httpClient = inject(HttpClient);
    private _user: ReplaySubject<User> = new ReplaySubject<User>(1);

    set user(value: User) {
        this._user.next(value);
    }

    get user$(): Observable<User> {
        return this._user.asObservable();
    }

    /**
     * Get the current signed-in user data (BACKOFFICE)
     */
    get(): Observable<User> {
        return this._httpClient
            .get<any>(`${environment.apiUrl}/auth/me`)
            .pipe(
                tap((res) => {
                    // Your /auth/me currently returns { Name, Claims }
                    // So we map to something usable for the UI
                    const claims: Array<{ type: string; value: string }> =
                        res?.claims ?? res?.Claims ?? [];

                    const email =
                        claims.find((c) => c.type === 'email')?.value ??
                        claims.find((c) => c.type === 'preferred_username')?.value ??
                        res?.name ??
                        res?.Name ??
                        '';

                    const firstname =
                        claims.find((c) => c.type === 'given_name')?.value ?? '';
                    const lastname =
                        claims.find((c) => c.type === 'family_name')?.value ?? '';

                    this._user.next(res);
                })
            );
    }
}
