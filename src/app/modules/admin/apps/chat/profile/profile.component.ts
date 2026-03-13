import {
    ChangeDetectionStrategy,
    Component,
    Input,
    OnInit,
    ViewEncapsulation,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDrawer } from '@angular/material/sidenav';
import { AuthService, BOCurrentUser } from 'app/core/auth/auth.service';

@Component({
    selector: 'chat-profile',
    templateUrl: './profile.component.html',
    encapsulation: ViewEncapsulation.None,
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: true,
    imports: [MatButtonModule, MatIconModule],
})
export class ProfileComponent implements OnInit {
    @Input() drawer: MatDrawer;
    profile: BOCurrentUser | null = null;

    constructor(private _auth: AuthService) { }

    ngOnInit(): void {
        this.profile = this._auth.currentUser;
    }
}
