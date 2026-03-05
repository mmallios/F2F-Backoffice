import { AnnouncementsListComponent } from "./announcements-list.component";
import { AnnouncementDetailsComponent } from "./details/announcement-details.component";


// src/app/app.routes.ts (or feature routes)
export default [
    { path: '', component: AnnouncementsListComponent },
    { path: ':id', component: AnnouncementDetailsComponent },
];
