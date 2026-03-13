import {
    ChangeDetectionStrategy,
    Component,
    Input,
    ViewEncapsulation,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDrawer } from '@angular/material/sidenav';
import { BOChatDetail, BOGroupChatDetail } from 'app/modules/admin/apps/chat/chat.types';

@Component({
    selector: 'chat-contact-info',
    templateUrl: './contact-info.component.html',
    encapsulation: ViewEncapsulation.None,
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: true,
    imports: [MatButtonModule, MatIconModule],
})
export class ContactInfoComponent {
    @Input() chat: BOChatDetail | null = null;
    @Input() groupChat: BOGroupChatDetail | null = null;
    @Input() isGroup: boolean = false;
    @Input() drawer: MatDrawer;
}
