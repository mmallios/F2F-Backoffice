import { Routes } from '@angular/router';

export const CONTESTS_ROUTES: Routes = [
    {
        path: '',
        loadComponent: () =>
            import('./contests-list.component').then((m) => m.ContestsListComponent),
    },
    {
        path: ':id',
        loadComponent: () =>
            import('./contest-details.component').then((m) => m.ContestDetailsComponent),
    },
];
