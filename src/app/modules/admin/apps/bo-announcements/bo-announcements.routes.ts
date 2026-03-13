import { Routes } from '@angular/router';
import { BOAnnouncementsListComponent } from './bo-announcements-list.component';
import { BOAnnouncementDetailsComponent } from './details/bo-announcement-details.component';

export default [
    { path: '', component: BOAnnouncementsListComponent },
    { path: ':id', component: BOAnnouncementDetailsComponent },
] as Routes;
