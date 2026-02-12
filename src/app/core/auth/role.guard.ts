import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService, Role } from './auth.service';

export function roleGuard(allowed: Role[]): CanActivateFn {
  return () => {
    const auth = inject(AuthService);
    const router = inject(Router);

    if (!auth.isLoggedIn()) {
      router.navigateByUrl('/login');
      return false;
    }

    const role = auth.role();
    if (!allowed.includes(role)) {
      router.navigateByUrl(role === 'admin' ? '/admin' : '/user');
      return false;
    }

    return true;
  };
}