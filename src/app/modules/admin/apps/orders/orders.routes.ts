import { OrderDetailsComponent } from "./details/order-details.component";
import { OrdersListComponent } from "./orders.component";
import { NewOrderComponent } from "./new-order/new-order.component";

// src/app/app.routes.ts (or feature routes)
export default [
    { path: '', component: OrdersListComponent },
    { path: 'new', component: NewOrderComponent },
    { path: ':code', component: OrderDetailsComponent },
];
