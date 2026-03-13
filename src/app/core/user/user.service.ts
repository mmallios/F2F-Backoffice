import { inject, Injectable } from '@angular/core';
import { User } from '@fuse/services/users/users.service';
import { AuthService } from 'app/core/auth/auth.service';
import { Observable, of, ReplaySubject, tap } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class UserService {
    private _auth = inject(AuthService);
    private _user: ReplaySubject<User> = new ReplaySubject<User>(1);

    set user(value: User) {
        this._user.next(value);
    }

    get user$(): Observable<User> {
        return this._user.asObservable();
    }

    /**
     * Populate the user$ stream from the data stored in localStorage at login.
     * No API call required — the full profile was saved by AuthService.backofficeLogin().
     */
    get(): Observable<User> {
        const stored = this._auth.currentUser;
        const mapped: Partial<User> = stored
            ? {
                id: stored.id,
                firstname: stored.firstname ?? '',
                lastname: stored.lastname ?? '',
                email: stored.email ?? '',
                username: stored.username ?? null,
                image: stored.image ?? null,
                points: 0,
                status: 1,
                isActive: true,
                countryId: 0,
                createdOn: '',
                socialMediaPlatform: null,
            }
            : {};

        return of(mapped as User).pipe(
            tap((user) => this._user.next(user))
        );
    }
}
