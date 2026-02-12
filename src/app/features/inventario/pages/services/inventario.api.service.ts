import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../../environments/environment';

type TipoMovimiento = 'ENTRADA' | 'SALIDA' | 'AJUSTE';

@Injectable({ providedIn: 'root' })
export class InventarioApiService {
  private base = `${environment.apiUrl}/inventario`;

  constructor(private http: HttpClient) {}

  movimiento(payload: {
    producto_id: string;
    tipo: TipoMovimiento;
    cantidad?: number;
    nuevo_stock?: number;
    motivo?: string;
    referencia?: string;
  }) {
    return this.http.post(`${this.base}/movimientos`, payload);
  }
}