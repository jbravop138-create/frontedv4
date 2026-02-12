import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../../../../environments/environment';

export interface InventarioItem {
  producto_id: string;
  nombre: string;
  talla?: string | null;
  color?: string | null;

  categoria_id: string;
  categoria_nombre: string;

  stock_actual: number;

  updated_at?: string | null;
}

@Injectable({ providedIn: 'root' })
export class InventoryService {
  constructor(private http: HttpClient) {}

  list(search: string, categoriaId: string) {
    let params = new HttpParams();

    if (search?.trim()) params = params.set('search', search.trim());

    if (categoriaId && categoriaId !== 'all') {
      params = params.set('categoria', categoriaId);
      params = params.set('categoria_id', categoriaId);
    }

    return this.http.get<{ items: any[]; total?: number }>(`${environment.apiUrl}/inventario`, { params });
  }
}
