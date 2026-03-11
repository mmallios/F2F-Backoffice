import { Routes } from '@angular/router';
import { FanCardsComponent } from './fan-cards.component';
import { FanCardReportsComponent } from './fan-card-reports/fan-card-reports.component';

export default [
    { path: '', component: FanCardsComponent },
    { path: 'reports', component: FanCardReportsComponent },
] as Routes;
