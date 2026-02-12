import { Injectable, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

export type Role = 'admin' | 'user';

export interface AuthUser {
  id: string;
  email?: string;
  username?: string;
  full_name?: string;
  role: Role;
  is_active?: boolean;
  created_at?: string;
  updated_at?: string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly KEY_TOKEN = 'stock360_token';
  private readonly KEY_USER = 'stock360_user';

  private _token = signal<string | null>(null);
  private _user = signal<AuthUser | null>(null);

  // Exposición estilo “función” para tu UI (como ya lo estás usando)
  token = () => this._token();
  user = () => this._user();

  // Rol computado
  private _role = computed<Role>(() => this._user()?.role ?? 'user');
  role = () => this._role();

  constructor(private http: HttpClient) {}

  login(identifier: string, password: string) {
    return this.http.post<any>(
      `${environment.apiUrl}/auth/login`,
      { identifier, password }
    );
  }

  setSession(token: string, user: AuthUser) {
    this._token.set(token);
    this._user.set(user);

    localStorage.setItem(this.KEY_TOKEN, token);
    localStorage.setItem(this.KEY_USER, JSON.stringify(user));
  }

  restore() {
    try {
      const token = localStorage.getItem(this.KEY_TOKEN);
      const userRaw = localStorage.getItem(this.KEY_USER);

      if (!token || !userRaw) return;
      if (token === 'undefined' || token === 'null') {
        this.logout();
        return;
      }

      const user = JSON.parse(userRaw) as AuthUser;
      this._token.set(token);
      this._user.set(user);
    } catch {
      // si hay JSON corrupto, limpiamos
      localStorage.removeItem(this.KEY_TOKEN);
      localStorage.removeItem(this.KEY_USER);
      this._token.set(null);
      this._user.set(null);
    }
  }

  logout() {
    localStorage.removeItem(this.KEY_TOKEN);
    localStorage.removeItem(this.KEY_USER);
    this._token.set(null);
    this._user.set(null);
  }

  isLoggedIn() {
    const t = this._token();
    return !!t && t !== 'undefined' && t !== 'null';
  }
}
