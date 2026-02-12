import { Injectable } from '@angular/core';
import {
  HttpEvent,
  HttpHandler,
  HttpInterceptor,
  HttpRequest,
  HttpErrorResponse,
} from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { AuthService } from '../auth/auth.service';

@Injectable()
export class AuthInterceptor implements HttpInterceptor {
  constructor(private auth: AuthService) {}

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    const token = this.auth.token();

    // Nunca forzar auth al login
    const isLogin = req.url.includes('/auth/login');

    // Si no hay token, deja pasar sin Authorization
    if (!token || token === 'undefined' || token === 'null' || isLogin) {
      return next.handle(req).pipe(
        catchError((err: HttpErrorResponse) => throwError(() => err))
      );
    }

    const authReq = req.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`,
      },
    });

    return next.handle(authReq).pipe(
      catchError((err: HttpErrorResponse) => {
        // Debug útil: sabrás si se está enviando token y aun así falla
        if (err.status === 401) {
          console.warn('[401] Request:', req.method, req.url);
          console.warn('[401] Token present:', !!token);
        }
        return throwError(() => err);
      })
    );
  }
}
