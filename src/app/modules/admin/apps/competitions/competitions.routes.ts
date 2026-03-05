import { Routes, ActivatedRouteSnapshot, Router } from '@angular/router';
import { inject } from '@angular/core';
import { catchError, throwError, map } from 'rxjs';

import { EventsService } from '@fuse/services/events/events.service';
import { CompetitionsComponent } from './competitions.component';

/**
 * Competition resolver
 */
export const competitionResolver = (route: ActivatedRouteSnapshot) => {
    const eventsService = inject(EventsService);
    const router = inject(Router);

    const id = Number(route.paramMap.get('id'));
    if (!id) {
        router.navigateByUrl('/competitions');
        return throwError(() => new Error('Invalid competition id'));
    }

    // If you already have getCompetitionById(), use it.
    // Otherwise fallback to getCompetitions() + find.
    const source$ = eventsService.getCompetitions().pipe(
        map((competitions) => competitions.find((c) => c.id === id) ?? null)
    );

    return source$.pipe(
        catchError((err) => {
            console.error(err);
            router.navigateByUrl('/competitions');
            return throwError(() => err);
        })
    );
};

export default [
    { path: '', component: CompetitionsComponent },

    // Optional: future details route example
    // { path: ':id/view', resolve: { competition: competitionResolver }, loadComponent: () => import('./view/competition-view.component').then(m => m.CompetitionViewComponent) },
] as Routes;
