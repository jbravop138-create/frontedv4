import { ApplicationConfig, APP_INITIALIZER } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptorsFromDi, HTTP_INTERCEPTORS } from '@angular/common/http';

import { routes } from './app.routes';
import { AuthInterceptor } from './core/interceptors/auth.interceptor';
import { AuthService } from './core/auth/auth.service';

const restoreAuth = (auth: AuthService) => () => auth.restore();

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),

    // ÚNICO HttpClient provider
    provideHttpClient(withInterceptorsFromDi()),

    // Restaurar sesión ANTES de que las pantallas hagan requests
    { provide: APP_INITIALIZER, useFactory: restoreAuth, deps: [AuthService], multi: true },

    // Interceptor en DI
    { provide: HTTP_INTERCEPTORS, useClass: AuthInterceptor, multi: true },
  ],
};
