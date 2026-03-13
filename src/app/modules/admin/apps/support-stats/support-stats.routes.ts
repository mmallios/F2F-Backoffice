import { Routes } from '@angular/router';

export const SUPPORT_STATS_ROUTES: Routes = [
    {
        path: '',
        loadComponent: () =>
            import('./support-stats.component').then(m => m.SupportStatsComponent),
    },
];
