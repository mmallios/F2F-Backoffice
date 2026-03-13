import { Routes } from '@angular/router';
import { BOOffersListComponent } from './list/bo-offers-list.component';
import { BOOfferCategoriesComponent } from './categories/bo-offer-categories.component';

export const OFFERS_ROUTES: Routes = [
    {
        path: '',
        component: BOOffersListComponent,
    },
    {
        path: 'categories',
        component: BOOfferCategoriesComponent,
    },
];
