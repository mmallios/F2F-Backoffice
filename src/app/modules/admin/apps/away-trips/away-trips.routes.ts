import { Routes } from '@angular/router';
import { BOAwayTripsListComponent } from './list/bo-away-trips-list.component';
import { BOAwayTripDetailsComponent } from './details/bo-away-trip-details.component';

export const AWAY_TRIPS_ROUTES: Routes = [
    {
        path: '',
        component: BOAwayTripsListComponent,
    },
    {
        path: 'new',
        component: BOAwayTripDetailsComponent,
        data: { mode: 'create' },
    },
    {
        path: ':id',
        component: BOAwayTripDetailsComponent,
    },
];
