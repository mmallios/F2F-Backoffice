import {
    Directive,
    ElementRef,
    HostListener,
    Input,
    OnChanges,
    OnInit,
    Renderer2,
    Self,
} from '@angular/core';
import { MatTooltip } from '@angular/material/tooltip';

const NO_PERMISSION_MSG =
    'Δεν έχετε πρόσβαση σε αυτή την ενέργεια λόγω ελλιπών δικαιωμάτων.';

/**
 * Directive that applies to action buttons and wires up the permission check,
 * the disabled state and a tooltip — all in one place.
 *
 * Usage (replaces the old `[disabled]="!claimsService.canEdit('X')"` pattern):
 *
 *   <button [boPermission]="claimsService.canEdit('USERS')" (click)="…">
 *     Add User
 *   </button>
 *
 * When the value is `false`:
 *   • The button is disabled.
 *   • pointer-events is reset to `auto` so the tooltip can still fire on hover.
 *   • A Greek "no permission" tooltip message is shown automatically.
 *
 * When the value is `true` no changes are made to the button.
 */
@Directive({
    selector: 'button[boPermission]',
    standalone: true,
    // Attach MatTooltip to the same host button so we can configure it.
    hostDirectives: [{ directive: MatTooltip }],
})
export class BoPermissionDirective implements OnInit, OnChanges {

    @Input({ required: true }) boPermission!: boolean;

    constructor(
        private _el: ElementRef<HTMLButtonElement>,
        private _renderer: Renderer2,
        @Self() private _tooltip: MatTooltip,
    ) { }

    ngOnInit(): void { this._apply(); }
    ngOnChanges(): void { this._apply(); }

    /** Block all click events when the permission is denied. */
    @HostListener('click', ['$event'])
    onHostClick(event: MouseEvent): void {
        if (!this.boPermission) {
            event.preventDefault();
            event.stopImmediatePropagation();
        }
    }

    private _apply(): void {
        const btn = this._el.nativeElement;

        if (!this.boPermission) {
            // Disable the button
            this._renderer.setAttribute(btn, 'disabled', '');

            // Angular Material sets pointer-events:none on disabled buttons which
            // prevents the tooltip from triggering.  Override it so hover works.
            this._renderer.setStyle(btn, 'pointer-events', 'auto');

            // Cursor shows "not allowed" so users get a visual hint
            this._renderer.setStyle(btn, 'cursor', 'not-allowed');

            // Wire up the tooltip
            this._tooltip.message = NO_PERMISSION_MSG;
            this._tooltip.showDelay = 200;
        } else {
            this._renderer.removeAttribute(btn, 'disabled');
            this._renderer.removeStyle(btn, 'pointer-events');
            this._renderer.removeStyle(btn, 'cursor');
            this._tooltip.message = '';
        }
    }
}
