import { inject } from '@angular/core';
import {
    ActivatedRouteSnapshot,
    Router,
    RouterStateSnapshot,
    Routes,
} from '@angular/router';
import { ContactsComponent } from 'app/modules/admin/apps/contacts/contacts.component';
import { ContactsService } from 'app/modules/admin/apps/contacts/contacts.service';

import { UsersListComponent } from 'app/modules/admin/apps/contacts/list/list.component';
import { catchError, throwError } from 'rxjs';
import { UsersProfileComponent } from './profile/user-profile.component';
import { UsersService } from '@fuse/services/users/users.service';

/**
 * Contact resolver
 *
 * @param route
 * @param state
 */
const contactResolver = (
    route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot
) => {
    const contactsService = inject(ContactsService);
    const router = inject(Router);

    return contactsService.getContactById(route.paramMap.get('id')).pipe(
        // Error here means the requested contact is not available
        catchError((error) => {
            // Log the error
            console.error(error);

            // Get the parent url
            const parentUrl = state.url.split('/').slice(0, -1).join('/');

            // Navigate to there
            router.navigateByUrl(parentUrl);

            // Throw an error
            return throwError(error);
        })
    );
};

export const userResolver = (route: ActivatedRouteSnapshot) => {
    const usersService = inject(UsersService);
    const router = inject(Router);

    const id = Number(route.paramMap.get('id'));

    if (!id) {
        router.navigateByUrl('/apps/contacts');
        return throwError(() => new Error('Invalid user id'));
    }

    return usersService.getUserById(id).pipe(
        catchError((err) => {
            console.error(err);
            router.navigateByUrl('/apps/contacts');
            return throwError(() => err);
        })
    );
};

/**
 * Can deactivate contacts details
 *
 * @param component
 * @param currentRoute
 * @param currentState
 * @param nextState
 */

export default [
    {
        path: '',
        component: ContactsComponent,
        resolve: {
            tags: () => inject(ContactsService).getTags(),
        },
        children: [
            // ✅ FULL PAGE PROFILE (εκτός list)
            {
                path: ':id/view',
                component: UsersProfileComponent,
                resolve: { user: userResolver },
            },

            // ✅ LIST PAGE (με drawer)
            {
                path: '',
                component: UsersListComponent,
                resolve: {
                    contacts: () => inject(ContactsService).getContacts(),
                    countries: () => inject(ContactsService).getCountries(),
                },
                children: [
                    {
                        path: ':id',
                        component: UsersProfileComponent,
                    },
                ],
            },
        ],
    },
] as Routes;

