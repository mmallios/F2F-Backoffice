import { Routes, ActivatedRouteSnapshot, Router } from '@angular/router';
import { inject } from '@angular/core';
import { catchError, throwError, map } from 'rxjs';




import { EventsService } from '@fuse/services/events/events.service';
import { TeamsComponent } from './teams.component';

/**
 * Team resolver
 */
export const teamResolver = (route: ActivatedRouteSnapshot) => {
    const eventsService = inject(EventsService);
    const router = inject(Router);

    const id = Number(route.paramMap.get('id'));
    if (!id) {
        router.navigateByUrl('/teams');
        return throwError(() => new Error('Invalid team id'));
    }

    // If you already have getTeamById(), use it.
    // Otherwise fallback to getTeams() + find.
    const source$ =
        eventsService.getTeams().pipe(
            map(teams => teams.find(t => t.id === id) ?? null)
        );

    return source$.pipe(
        catchError((err) => {
            console.error(err);
            router.navigateByUrl('/teams');
            return throwError(() => err);
        })
    );
};


export default [
    { path: '', component: TeamsComponent }
] as Routes;

