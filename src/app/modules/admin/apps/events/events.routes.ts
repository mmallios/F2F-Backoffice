import { Routes, ActivatedRouteSnapshot, Router } from '@angular/router';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';

import { EventsListComponent } from './list/events-list.component';
import { EventDetailsComponent } from './details/event-details.component';
import { EventsService } from '@fuse/services/events/events.service';


export const eventResolver = (route: ActivatedRouteSnapshot) => {
    const eventsService = inject(EventsService);
    const router = inject(Router);

    const id = Number(route.paramMap.get('id'));
    if (!id) {
        router.navigateByUrl('/events');
        return throwError(() => new Error('Invalid event id'));
    }

    return eventsService.getEventById(id).pipe(
        catchError((err) => {
            console.error(err);
            router.navigateByUrl('/events');
            return throwError(() => err);
        })
    );
};

export default [
    { path: '', component: EventsListComponent },

    { path: 'new', component: EventDetailsComponent, data: { mode: 'create' } },

    { path: ':id', component: EventDetailsComponent, resolve: { event: eventResolver }, data: { mode: 'edit' } },
] as Routes;

