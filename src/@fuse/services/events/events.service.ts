// events.service.ts
import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { BehaviorSubject, Observable, map, tap } from 'rxjs';
import { environment } from '@fuse/environments/environment';

export interface Team {
    id: number;
    name: string;
    image: string;
    sportId: number;
    isActive: boolean;
}

export interface Competition {
    id: number;
    name: string;
    sportId: number;
    seasonId: number;
    isActive: boolean;
    image: string;
}

export interface TvChannel {
    id: number;
    name: string;
    code: string;
    image?: string; // optional if your DB has it
    streamUrl?: string;
    isPublished: boolean;
}


/**
 * Αυτό είναι το UI model που χρησιμοποιείς στα components σου
 */
export interface EventItem {
    code?: string;
    name?: string
    id: number;
    sportId: number;
    competitionId: number;
    competitionName: string;

    matchday: string;
    eventDate: string; // ISO string ή yyyy-MM-ddTHH:mm

    homeTeamId: number;
    awayTeamId: number;

    homeTeamName: string;
    awayTeamName: string;

    homeTeamLogoUrl: string;
    awayTeamLogoUrl: string;
    referenceMatchId: string;
    tvChannel: number;
    isTicketingOpen: boolean;
}

/**
 * Tickets
 * Προσαρμόζεις το shape ανάλογα με το πραγματικό EventTicketDto.
 */
export interface EventTicketDto {
    id: number;
    eventId: number;
    title?: string;
    status?: string;
    ownerFirstname?: string;
    ownerLastname?: string;
    gate?: string;
    section?: string;
    row?: string;
    seat?: string;
}

export interface CreateEventTicketDto {
    eventId?: number;
    title: string;
    status?: string;

    // πρόσθεσε τα required πεδία του backend DTO
}

export interface Ticket {
    id: number;

    eventId: number;

    title: string;
    status: 'Ενεργό' | 'Ανενεργό' | 'Ακυρωμένο' | string;

    // Προαιρετικά – πολύ χρήσιμα στο UI
    seat?: string;
    row?: string;
    section?: string;

    price?: number;
    currency?: string;

    holderName?: string;

    createdOn?: string;   // ISO date
    updatedOn?: string;   // ISO date
}

// ✅ Add these interfaces (extend existing ones if you want)
export interface UpdateTeamDto {
    id: number;
    name: string;
    code?: string;
    image?: string;
    sportId?: number;
}

export interface UpdateCompetitionDto {
    id: number;
    name: string;
    code?: string;
    image?: string;
    sportId?: number;
}


/**
 * EventsResultDto
 * Το backend σου επιστρέφει EventsResultDto.
 * Δεν μας έδωσες το ακριβές shape, οπότε βάζουμε ευέλικτο parsing:
 * - Αν είναι array -> το χρησιμοποιούμε
 * - Αν έχει items/data/events -> το παίρνουμε
 */
export type EventsResultDto = any;

export interface EventStats {
    fanCardUsagesCount: number;
    ticketRequestsCount: number;
    subscriptionsCount: number;
}

@Injectable({ providedIn: 'root' })
export class EventsService {

    private readonly baseUrl = environment.apiUrl;


    private _teams = new BehaviorSubject<Team[]>([]);
    teams$ = this._teams.asObservable();

    constructor(private http: HttpClient) { }

    // ---------------------------
    // EVENTS
    // ---------------------------

    /** GET api/events?isGrouped=false */
    getEvents(isGrouped = false): Observable<EventItem[]> {
        const params = new HttpParams().set('isGrouped', String(isGrouped));

        return this.http
            .get<EventsResultDto>(`${this.baseUrl}/events`, { params })
            .pipe(
                map((res) => this.extractEventsArray(res)),
                map((events) => events.map((e) => this.mapEventToUi(e)))
            );
    }

    /** (Optional) Αν θες να φορτώνεις 1 event by id από τη λίστα */
    getEventById(id: number): Observable<EventItem | null> {
        // Αν δεν έχεις GET /api/events/{id}, τότε κάνουμε find από getEvents()
        return this.getEvents(false).pipe(
            map((list) => list.find((x) => x.id === id) ?? null)
        );
    }

    getEventStats(id: number): Observable<EventStats> {
        return this.http.get<EventStats>(`${this.baseUrl}/events/${id}/stats`);
    }

    deleteEvent(id: number): Observable<void> {
        return this.http.delete<void>(`${this.baseUrl}/events/${id}`);
    }

    /** (Optional) Update event — αν έχεις endpoint στο backend, βάλε το εδώ */
    updateEvent(eventId: number, payload: any): Observable<any> {
        // ΠΡΟΣΑΡΜΟΣΕ ΤΟ ENDPOINT αν υπάρχει
        return this.http.put(`${this.baseUrl}/events/${eventId}`, payload);
    }

    createEvent(payload: Partial<EventItem>) {
        return this.http.post<EventItem>(`${this.baseUrl}/events`, payload);
    }


    // ---------------------------
    // TEAMS / COMPETITIONS
    // ---------------------------


    /** GET /DynamicCrud/teams/all */
    getTeams(): Observable<Team[]> {
        return this.http
            .get<any[]>(`${this.baseUrl}/dynamic/teams/all`)
            .pipe(map((rows) => rows.map((t) => this.mapTeam(t))));
    }

    /** GET /DynamicCrud/competitions/all */
    getCompetitions(): Observable<Competition[]> {
        return this.http
            .get<any[]>(`${this.baseUrl}/dynamic/competitions/all`)
            .pipe(map((rows) => rows.map((c) => this.mapCompetition(c))));
    }

    /** GET /DynamicCrud/tvchannels/all */
    getTVChannels(): Observable<TvChannel[]> {
        return this.http
            .get<any[]>(`${this.baseUrl}/dynamic/tvchannels/all`)
            .pipe(map((rows) => rows.map((x) => this.mapTvChannel(x))));
    }


    // ---------------------------
    // EVENT TICKETS
    // ---------------------------

    /** GET api/events/{eventId}/tickets */
    getEventTickets(eventId: number): Observable<EventTicketDto[]> {
        return this.http.get<EventTicketDto[]>(
            `${this.baseUrl}/events/${eventId}/tickets`
        );
    }

    /** POST api/events/{eventId}/tickets */
    addTicketToEvent(eventId: number, dto: CreateEventTicketDto): Observable<EventTicketDto> {
        const body: CreateEventTicketDto = { ...dto, eventId };
        return this.http.post<EventTicketDto>(
            `${this.baseUrl}/events/${eventId}/tickets`,
            body
        );
    }

    // ---------------------------
    // MAPPERS
    // ---------------------------

    private extractEventsArray(res: any): any[] {
        if (!res) return [];
        if (Array.isArray(res)) return res;

        // κοινές περιπτώσεις DTO wrappers
        return (
            res.items ??
            res.data ??
            res.events ??
            res.result ??
            []
        );
    }

    private mapTeam(t: any): Team {
        return {
            id: Number(t.id ?? t.Id ?? 0),
            name: String(t.name ?? t.Name ?? ''),
            image: String(t.image ?? t.LogoUrl ?? t.logo ?? t.Logo ?? ''),
            sportId: Number(t.sportId),
            isActive: t.isActive
        };
    }

    private mapCompetition(c: any): Competition {
        return {
            id: Number(c.id ?? c.Id ?? 0),
            name: String(c.name ?? c.Name ?? ''),
            image: String(c.image ?? c.Image ?? ''),
            isActive: c.isActive,
            seasonId: c.seasonId,
            sportId: c.sportId
        };
    }

    private mapTvChannel(x: any): TvChannel {
        return {
            id: Number(x.id ?? x.Id ?? 0),
            name: String(x.name ?? x.Name ?? x.channelName ?? x.ChannelName ?? ''),
            code: String(x.code ?? x.Code),
            image: String(x.image ?? x.Image ?? x.logo ?? x.Logo ?? ''),
            isPublished: x.isPublished
        };
    }


    /**
     * Χαρτογράφηση Event από backend σε UI model.
     * Προσαρμόζεις keys ανάλογα με το πραγματικό σου EventsResultDto.
     */
    private mapEventToUi(e: any): EventItem {
        const id = Number(e.id ?? e.Id ?? 0);
        const sportId = Number(e.sportId);
        const competitionId = Number(e.competitionId ?? e.CompetitionId ?? 0);
        const competitionName = String(e.competitionName ?? e.CompetitionName ?? e.competition?.name ?? e.Competition?.Name ?? '');

        const matchday = String(e.matchday ?? e.Matchday ?? e.matchDay ?? e.MatchDay ?? '');

        // date
        const eventDate = String(e.eventDate ?? e.EventDate ?? e.date ?? e.Date ?? '');

        // teams
        const homeTeamId = Number(e.homeTeamId ?? e.HomeTeamId ?? e.home?.id ?? e.Home?.Id ?? 0);
        const awayTeamId = Number(e.awayTeamId ?? e.AwayTeamId ?? e.away?.id ?? e.Away?.Id ?? 0);

        const homeTeamName = String(e.homeTeamName ?? e.HomeTeamName ?? e.home?.name ?? e.Home?.Name ?? '');
        const awayTeamName = String(e.awayTeamName ?? e.AwayTeamName ?? e.away?.name ?? e.Away?.Name ?? '');

        const homeTeamLogoUrl = String(e.homeTeamLogo ?? e.HomeTeamLogoUrl ?? e.home?.logoUrl ?? e.Home?.LogoUrl ?? e.homeLogoUrl ?? '');
        const awayTeamLogoUrl = String(e.awayTeamLogo ?? e.AwayTeamLogoUrl ?? e.away?.logoUrl ?? e.Away?.LogoUrl ?? e.awayLogoUrl ?? '');

        const isTicketingOpen = e.isTicketingOpen;
        const tvChannel = e.tvChannelId;
        const referenceMatchId = e.referenceMatchId;

        return {
            id,
            sportId,
            competitionId,
            competitionName,
            matchday,
            eventDate,

            homeTeamId,
            awayTeamId,
            homeTeamName,
            awayTeamName,
            homeTeamLogoUrl,
            awayTeamLogoUrl,
            referenceMatchId,
            tvChannel,
            isTicketingOpen
        };
    }

    // ✅ Add these methods inside EventsService (below getTeams/getCompetitions for example)

    /**
     * PUT /dynamic/teams/update
     * (If your backend expects different route/method, just change the URL)
     */
    updateTeam(dto: UpdateTeamDto): Observable<any> {
        // keep payload clean (remove undefined)
        const body: any = {
            id: dto.id,
            name: dto.name,
            code: dto.code ?? null,
            image: dto.image ?? null,
            sportId: dto.sportId ?? null,
        };

        return this.http.put(`${this.baseUrl}/dynamic/teams/update`, body);
    }

    createTeam(dto: UpdateTeamDto): Observable<any> {
        // keep payload clean (remove undefined)
        const body: any = {
            id: dto.id,
            name: dto.name,
            code: dto.code ?? null,
            image: dto.image ?? null,
            sportId: dto.sportId ?? null,
        };

        return this.http.put(`${this.baseUrl}/dynamic/teams/update`, body);
    }

    /**
     * PUT /dynamic/competitions/update
     * (If your backend expects different route/method, just change the URL)
     */
    updateCompetition(competitionId: number, dto: UpdateCompetitionDto): Observable<any> {
        const body: any = {
            id: dto.id,
            name: dto.name,
            code: dto.code ?? null,
            image: dto.image ?? null,
            sportId: dto.sportId ?? null,
        };

        return this.http.put(`${this.baseUrl}/dynamic/competitions/${competitionId}`, body);
    }

    createCompetition(dto: UpdateCompetitionDto): Observable<any> {
        const body: any = {
            id: dto.id,
            name: dto.name,
            code: dto.code ?? null,
            image: dto.image ?? null,
            sportId: dto.sportId ?? null,
        };

        return this.http.put(`${this.baseUrl}/dynamic/competitions/update`, body);
    }


}
