import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';

export type TipoMovimiento = 'ENTRADA' | 'SALIDA' | 'AJUSTE';

@Injectable({ providedIn: 'root' })
export class MovimientosService {
  historial(arg0: { limit: number; offset: number; }) {
    throw new Error('Method not implemented.');
  }
  createMovimiento(arg0: { tipo: "ENTRADA" | "SALIDA"; producto: string; cantidad: number; motivo: string | null; }) {
    throw new Error('Method not implemented.');
  }
  constructor(private http: HttpClient) {}

  // ✅ POST /movimientos (tu backend real)
  registrarMovimiento(payload: {
    tipo: TipoMovimiento;
    cantidad: number;
    motivo?: string | null;

    // uno de estos (tu backend resuelve el producto)
    producto_id?: string;
    nombre?: string;
    categoria_id?: string;
    talla?: string;
    color?: string;
    descripcion?: string;
  }) {
    return this.http.post(`${environment.apiUrl}/movimientos`, payload);
  }
}
