import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../../../environments/environment';
import { Observable } from 'rxjs';

export type TipoMovimiento = 'ENTRADA' | 'SALIDA' | 'AJUSTE';

export interface MovimientoDto {
  id: string;
  fecha: string; // ISO string (ideal) o string parseable por DatePipe
  tipo: TipoMovimiento;
  cantidad: number;
  producto_nombre: string;
  usuario_nombre: string;
  motivo: string;
}

export interface MovimientosResponse {
  data: never[];
  items: MovimientoDto[];
  total?: number;
  limit?: number;
  offset?: number;
}

export interface HistorialParams {
  producto_id?: string;
  tipo?: TipoMovimiento;
  from?: string;   // yyyy-mm-dd
  to?: string;     // yyyy-mm-dd
  limit?: number;
  offset?: number;

  // Opcional: si el backend lo soporta
  search?: string;
}

export interface RegistrarMovimientoPayload {
  tipo: TipoMovimiento;
  cantidad: number;
  motivo?: string | null;

  // según tu backend: puedes registrar por producto_id o por codigo/nombre
  producto_id?: string;
  codigo?: string;
  nombre?: string;

  // datos para crear producto si no existe
  categoria_id?: string;
  descripcion?: string;
  detalles?: string;
  talla?: string;
  color?: string;

  // desactivar producto cuando stock quede en 0
  eliminar_producto?: boolean;

  // NUEVO CAMPO AGREGADO
  uid?: string; 
}

@Injectable({ providedIn: 'root' })
export class MovimientosApiService {
  private readonly baseUrl = `${environment.apiUrl}/movimientos`;

  constructor(private http: HttpClient) {}

  // GET /movimientos
  historial(params?: HistorialParams): Observable<MovimientosResponse> {
    let httpParams = new HttpParams();

    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== '') {
          httpParams = httpParams.set(k, String(v));
        }
      });
    }

    return this.http.get<MovimientosResponse>(this.baseUrl, {
      params: httpParams,
    });
  }

  // POST /movimientos
  registrarMovimiento(payload: RegistrarMovimientoPayload): Observable<any> {
    return this.http.post(this.baseUrl, payload);
  }
}
