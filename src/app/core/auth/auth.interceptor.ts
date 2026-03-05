import {
    HttpErrorResponse,
    HttpEvent,
    HttpHandlerFn,
    HttpRequest,
} from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from 'app/core/auth/auth.service';
import { AuthUtils } from 'app/core/auth/auth.utils';
import { Observable, catchError, throwError } from 'rxjs';

export const authInterceptor = (
    req: HttpRequest<unknown>,
    next: HttpHandlerFn
): Observable<HttpEvent<unknown>> => {
    const authService = inject(AuthService);
    const router = inject(Router);

    let newReq = req.clone();

    const token = authService.boAccessToken;

    if (token && !AuthUtils.isTokenExpired(token)) {
        newReq = req.clone({
            headers: req.headers.set('Authorization', 'Bearer ' + token),
        });
    }

    return next(newReq).pipe(
        catchError((error) => {
            if (error instanceof HttpErrorResponse && error.status === 401) {
                authService.signOut();
                router.navigateByUrl('/sign-in');
            }
            return throwError(() => error);
        })
    );
};
