import { inject } from '@angular/core';
import { UserService } from 'app/core/user/user.service';
import { NavigationService } from 'app/core/navigation/navigation.service';
import { MessagesService } from 'app/layout/common/messages/messages.service';
import { NotificationsService } from 'app/layout/common/notifications/notifications.service';
import { ShortcutsService } from 'app/layout/common/shortcuts/shortcuts.service';
import { ChatService } from 'app/modules/admin/apps/chat/chat.service';
import { forkJoin } from 'rxjs';

export const initialDataResolver = () => {
    const messagesService = inject(MessagesService);
    const navigationService = inject(NavigationService);
    const notificationsService = inject(NotificationsService);
    const chatService = inject(ChatService);
    const shortcutsService = inject(ShortcutsService);
    const userService = inject(UserService);

    // Fork join multiple API endpoint calls to wait all of them to finish
    return forkJoin([
        userService.get(),
        navigationService.get(),
        messagesService.getAll(),
        notificationsService.getAll(),
        chatService.loadAll(),
        shortcutsService.getAll(),
    ]);
};
