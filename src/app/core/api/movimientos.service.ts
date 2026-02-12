import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../../environments/environment';

export type TipoMovimiento = 'ENTRADA' | 'SALIDA' | 'AJUSTE';

@Injectable({ providedIn: 'root' })
export class MovimientosService {
  private base = `${environment.apiUrl}/movimientos`;

  constructor(private http: HttpClient) {}

  historial(params?: {
    producto_id?: string;
    tipo?: TipoMovimiento;
    from?: string;
    to?: string;
    limit?: number;
    offset?: number;
  }) {
    let p = new HttpParams();
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== '') p = p.set(k, String(v));
      });
    }
    return this.http.get<any>(this.base, { params: p });
  }

  registrarMovimiento(payload: {
    producto_id?: string;
    codigo?: string;   // compat backend
    nombre?: string;   // si ya implementaste por nombre
    tipo: TipoMovimiento;
    cantidad: number;
    motivo?: string;
  }) {
    return this.http.post<any>(this.base, payload);
  }
}
