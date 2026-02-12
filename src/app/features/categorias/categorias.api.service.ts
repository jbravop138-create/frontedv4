import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../../environments/environment';

export interface Categoria {
  id: string;
  nombre: string;
  descripcion?: string;
}

@Injectable({ providedIn: 'root' })
export class CategoriasApiService {
  private base = `${environment.apiUrl}/categorias`;

  constructor(private http: HttpClient) {}

  list() {
    return this.http.get<Categoria[]>(this.base);
  }

  create(data: { nombre: string; descripcion?: string }) {
    return this.http.post(this.base, data);
  }

  // IMPORTANTE: backend está con PATCH
  update(id: string, data: { nombre: string; descripcion?: string }) {
    return this.http.patch(`${this.base}/${id}`, data);
  }

  delete(id: string) {
    return this.http.delete(`${this.base}/${id}`);
  }
}