import { Routes } from '@angular/router';
import { GroupChatsComponent } from './groupchats.component';
import { GroupChatDetailsComponent } from './details/groupchat-details.component';

export default [
    { path: '', component: GroupChatsComponent },
    { path: ':id', component: GroupChatDetailsComponent },
] as Routes;
