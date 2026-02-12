import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../../../../environments/environment';

export interface Producto {
  id: string;
  nombre: string;
  categoria_id: string;
  categoria_nombre?: string;
  stock_actual?: number | null;
  talla?: string;
  color?: string;
}

@Injectable({ providedIn: 'root' })
export class ProductosApiService {
  private base = `${environment.apiUrl}/productos`;

  constructor(private http: HttpClient) {}

  list(search?: string, categoria_id?: string) {
    let params = new HttpParams();

    if (search && search.trim()) {
      const s = search.trim();
      // compat: por si tu backend lee q o search
      params = params.set('q', s);
      params = params.set('search', s);
    }

    if (categoria_id && categoria_id !== 'all') {
      params = params.set('categoria_id', categoria_id);
    }

    return this.http.get<Producto[]>(this.base, { params });
  }

  get(id: string) {
    return this.http.get<Producto>(`${this.base}/${id}`);
  }

  update(
    id: string,
    data: Partial<Producto> & { descripcion?: string; detalles?: string }
  ) {
    return this.http.patch(`${this.base}/${id}`, data);
  }
}
