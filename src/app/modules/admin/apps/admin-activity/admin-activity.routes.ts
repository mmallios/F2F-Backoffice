import { Routes } from '@angular/router';

export const ADMIN_ACTIVITY_ROUTES: Routes = [
    {
        path: '',
        loadComponent: () =>
            import('./admin-activity.component').then(m => m.AdminActivityComponent),
    },
];
