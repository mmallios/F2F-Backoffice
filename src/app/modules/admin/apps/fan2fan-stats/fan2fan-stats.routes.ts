import { Routes } from '@angular/router';

export const FAN2FAN_STATS_ROUTES: Routes = [
    {
        path: '',
        loadComponent: () =>
            import('./fan2fan-stats.component').then(m => m.Fan2fanStatsComponent),
    },
];
