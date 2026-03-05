import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, catchError, map, of, shareReplay, tap } from 'rxjs';
import { environment } from '@fuse/environments/environment';

export interface StaticData {
    id?: number | string;      // depends on your backend CommonEntity
    name: string;
    domain: string;
    image: string;
    extraData?: string;
    order: number;
}

@Injectable({ providedIn: 'root' })
export class StaticDataService {
    private readonly _baseUrl = `${environment.apiUrl}/dynamic/staticData`;

    private readonly _staticDataSubject = new BehaviorSubject<StaticData[]>([]);
    readonly staticData$ = this._staticDataSubject.asObservable();

    // optional: keep a cached observable too
    private _cachedAll$?: Observable<StaticData[]>;

    constructor(private _http: HttpClient) { }

    /** Simple one-off GET */
    getAll(): Observable<StaticData[]> {
        return this._http.get<StaticData[]>(`${this._baseUrl}/all`).pipe(
            map(list => (list ?? []).slice().sort((a, b) => (a.order ?? 0) - (b.order ?? 0)))
        );
    }

    /** Load + cache in BehaviorSubject (ideal for app-wide use) */
    loadAll(force = false): Observable<StaticData[]> {
        if (!force && this._cachedAll$) {
            return this._cachedAll$;
        }

        this._cachedAll$ = this.getAll().pipe(
            tap(list => this._staticDataSubject.next(list)),
            shareReplay(1),
            catchError(err => {
                // keep app stable, but don’t hide failure
                console.error('[StaticDataService] loadAll failed', err);
                this._staticDataSubject.next([]);
                return of([]);
            })
        );

        return this._cachedAll$;
    }

    /** Helper: filter by domain (from already-loaded data) */
    getByDomain(domain: string): Observable<StaticData[]> {
        const d = (domain || '').trim().toLowerCase();
        return this.staticData$.pipe(
            map(items =>
                (items ?? []).filter(x => (x.domain || '').trim().toLowerCase() === d)
            )
        );
    }

}
