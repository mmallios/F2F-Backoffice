import { inject } from '@angular/core';
import {
    ActivatedRouteSnapshot,
    Router,
    RouterStateSnapshot,
    Routes,
} from '@angular/router';
import { ChatComponent } from 'app/modules/admin/apps/chat/chat.component';
import { ChatService } from 'app/modules/admin/apps/chat/chat.service';
import { ChatsComponent } from 'app/modules/admin/apps/chat/chats/chats.component';
import { ConversationComponent } from 'app/modules/admin/apps/chat/conversation/conversation.component';
import { EmptyConversationComponent } from 'app/modules/admin/apps/chat/empty-conversation/empty-conversation.component';
import { catchError, throwError } from 'rxjs';

/** Resolver: load a private chat by id */
const privateChatResolver = (
    route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot
) => {
    const chatService = inject(ChatService);
    const router = inject(Router);
    const id = Number(route.paramMap.get('id'));

    return chatService.loadChatById(id).pipe(
        catchError((error) => {
            console.error(error);
            const parentUrl = state.url.split('/').slice(0, -1).join('/');
            router.navigateByUrl(parentUrl);
            return throwError(() => error);
        })
    );
};

/** Resolver: load a group chat by id */
const groupChatResolver = (
    route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot
) => {
    const chatService = inject(ChatService);
    const router = inject(Router);
    const id = Number(route.paramMap.get('id'));

    return chatService.loadGroupChatById(id).pipe(
        catchError((error) => {
            console.error(error);
            const parentUrl = state.url.split('/').slice(0, -1).join('/');
            router.navigateByUrl(parentUrl);
            return throwError(() => error);
        })
    );
};

export default [
    {
        path: '',
        component: ChatComponent,
        resolve: {
            chats: () => inject(ChatService).loadAll(),
            contacts: () => inject(ChatService).loadAdminContacts(),
        },
        children: [
            {
                path: '',
                component: ChatsComponent,
                children: [
                    {
                        path: '',
                        pathMatch: 'full',
                        component: EmptyConversationComponent,
                    },
                    {
                        path: 'chat/:id',
                        component: ConversationComponent,
                        data: { type: 'private' },
                        resolve: { conversation: privateChatResolver },
                    },
                    {
                        path: 'group/:id',
                        component: ConversationComponent,
                        data: { type: 'group' },
                        resolve: { conversation: groupChatResolver },
                    },
                ],
            },
        ],
    },
] as Routes;

