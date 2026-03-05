import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { BehaviorSubject, Observable, map, tap } from 'rxjs';
import { environment } from '@fuse/environments/environment';


export interface User {
    id?: number;
    keycloakId?: string | null;
    code?: string;
    firstname: string;
    lastname: string;
    username?: string | null;
    email: string;
    mobile?: string | null;
    points: number;
    status: number;
    isActive: boolean;
    image?: string | null;
    details?: string | null;
    createdOn: string;
    updatedOn?: string | null;
    countryId: number;
    regionId?: number;
    city?: string;
    area?: string;
    birthdate?: Date;
    amka?: string;
    genderId?: number;
    linkedUser?: User;
    socialMediaPlatform: number | null,
    socialMediaAccount?: string;
}

/** Matches CommonEntity fields you likely have */
export interface CommonEntity {
    id: number;
    createdOn?: string;
    updatedOn?: string | null;
    isActive?: boolean;
}

/** API model: UserCard */
export interface UserCard extends CommonEntity {
    userId: number;
    seasonId: number;
    cartType: number;     // enum CartType
    firstname: string;
    lastname: string;
    cardNumber: string;
}

/** API model: UserTicket */
export interface UserTicket extends CommonEntity {
    userId: number;
    seasonId: number;
    ticketType: number;   // enum TicketType
    ownType: number;      // enum TicketOwn
    firstname?: string | null;
    lastname?: string | null;
    alias?: string | null;
    gate: number;
    section?: string | null;
    row?: string | null;
    seat?: string | null;
    govWalletQRCode?: string | null;
    ticketmasterOrderId?: string | null;
    isOnlyEventTicket: boolean;
}


@Injectable({ providedIn: 'root' })
export class UsersService {
    private _users = new BehaviorSubject<User[]>([]);
    private _user = new BehaviorSubject<User | null>(null);

    users$ = this._users.asObservable();
    user$ = this._user.asObservable();

    socialPlatformOptions = [
        { value: 1, label: 'Facebook', icon: 'fa-brands fa-facebook-f' },
        { value: 2, label: 'Instagram', icon: 'fa-brands fa-instagram' },
    ];

    constructor(private http: HttpClient) { }

    /** Load all users from API */
    loadUsers(): Observable<User[]> {
        return this.http
            .get<User[]>(`${environment.apiUrl}/users/all`)
            .pipe(
                tap((users) => this._users.next(users))
            );
    }

    /** Get a single user by id (from API, or from cache and then API if you like) */
    getUserById(id: number): Observable<User> {
        return this.http
            .get<User>(`${environment.apiUrl}/users/${id}`)
            .pipe(
                tap((user) => this._user.next(user))
            );
    }

    /** Client-side search using current users list */
    searchUsers(query: string | null | undefined): Observable<User[]> {
        const q = (query ?? '').toLowerCase().trim();

        const filtered = this._users
            .getValue()
            .filter((user) =>
                !q
                    ? true
                    : `${user.firstname} ${user.lastname} ${user.email}`
                        .toLowerCase()
                        .includes(q)
            );

        this._users.next(filtered);
        return this.users$;
    }

    /** Update user on server and refresh local caches */
    updateUser(id: number, user: Partial<User>): Observable<User> {
        return this.http
            .put<User>(`${environment.apiUrl}/users/${id}`, user)
            .pipe(
                tap((updated) => {
                    // Update single user stream
                    this._user.next(updated);

                    // Update the cached list
                    const current = this._users.getValue();
                    const index = current.findIndex(u => u.id === updated.id);
                    if (index > -1) {
                        current[index] = updated;
                        this._users.next([...current]);
                    }
                })
            );
    }

    createUser(payload: Partial<User>): Observable<User> {
        return this.http
            .post<User>(`${environment.apiUrl}/users`, payload)
            .pipe(tap((u) => this._user.next(u)));
    }

    /** ✅ Get all tickets of a user (optionally filter by seasonId). */
    getUserTickets(userId: number, seasonId?: number | null): Observable<UserTicket[]> {
        let params = new HttpParams();
        if (seasonId !== null && seasonId !== undefined) {
            params = params.set('seasonId', String(seasonId));
        }

        return this.http.get<UserTicket[]>(
            `${environment.apiUrl}/users/tickets/user/${userId}`,
            { params }
        );
    }

    /** ✅ Get all cards of a user (optionally filter by seasonId). */
    getUserCards(userId: number, seasonId?: number | null): Observable<UserCard[]> {
        let params = new HttpParams();
        if (seasonId !== null && seasonId !== undefined) {
            params = params.set('seasonId', String(seasonId));
        }

        return this.http.get<UserCard[]>(
            `${environment.apiUrl}/users/cards/user/${userId}`,
            { params }
        );
    }


}
