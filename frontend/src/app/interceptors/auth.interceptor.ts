import { Injectable } from '@angular/core';
import { HttpInterceptor, HttpRequest, HttpHandler, HttpEvent, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { PortalService } from '../services/portal.service';

@Injectable()
export class AuthInterceptor implements HttpInterceptor {
  constructor(private auth: AuthService, private portal: PortalService, private router: Router) {}

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    // Las llamadas al portal del cliente usan su propio token; el resto, el del personal.
    const esPortal = req.url.includes('/api/portal');
    const token = esPortal ? this.portal.getToken() : this.auth.getToken();

    const authReq = token
      ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
      : req;

    return next.handle(authReq).pipe(
      catchError((err: HttpErrorResponse) => {
        // No expulsar en el propio login (deja que el componente muestre el error).
        const esLogin = req.url.includes('/login');
        if (err.status === 401 && !esLogin) {
          if (esPortal) {
            this.portal.logout();
            this.router.navigate(['/portal/login']);
          } else {
            this.auth.logout();
            this.router.navigate(['/login']);
          }
        }
        return throwError(() => err);
      })
    );
  }
}
