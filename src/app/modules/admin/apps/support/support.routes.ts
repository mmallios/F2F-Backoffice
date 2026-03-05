import { SupportTicketDetailsAdminComponent } from "./details/support-ticket-details.component";
import { SupportTicketsListComponent } from "./support-tickets-list.component";



// src/app/app.routes.ts (or feature routes)
export default [
    { path: '', component: SupportTicketsListComponent },
    { path: ':id', component: SupportTicketDetailsAdminComponent },
];
