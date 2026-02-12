import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

export type Rol = 'admin' | 'user';

export interface Usuario {
  id: string;
  username: string;
  full_name: string;
  role: Rol;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
  email?: string | null;
}

@Injectable({ providedIn: 'root' })
export class UsuariosApiService {
  private base = `${environment.apiUrl}/usuarios`;

  constructor(private http: HttpClient) {}

  list(q?: string) {
    const url = q ? `${this.base}?q=${encodeURIComponent(q)}` : this.base;
    return this.http.get<Usuario[]>(url);
  }

  create(data: { username: string; password: string; full_name: string; role: Rol }) {
    return this.http.post(this.base, data);
  }

  update(
    id: string,
    data: Partial<Usuario> & { password?: string }
  ) {
    return this.http.put(`${this.base}/${id}`, data);
  }

  delete(id: string) {
    return this.http.delete(`${this.base}/${id}`);
  }
}