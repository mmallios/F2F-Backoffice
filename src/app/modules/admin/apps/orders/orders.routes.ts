import { OrderDetailsComponent } from "./details/order-details.component";
import { OrdersListComponent } from "./orders.component";

// src/app/app.routes.ts (or feature routes)
export default [
    { path: '', component: OrdersListComponent },
    { path: ':code', component: OrderDetailsComponent },
];
