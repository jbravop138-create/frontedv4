import { Component, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { finalize } from 'rxjs';
import { AdminDashboardService } from './admin-dashboard.service';

type MovimientoTipo = 'ENTRADA' | 'SALIDA' | 'AJUSTE';
type Movimiento = {
  tipo: MovimientoTipo;
  ajuste_tipo?: 'ENTRADA' | 'SALIDA' | null;
  producto: string;
  cantidad: number;
  fecha: string | Date;
  categoria?: string | null;
};
type BarItem = { day: string; entradas: number; salidas: number };
type DashboardCore = {
  total_productos: number;
  productos_bajo_stock: number;
  total_categorias: number;
};

@Component({
  standalone: true,
  selector: 'app-admin-dashboard',
  imports: [CommonModule],
  templateUrl: './admin-dashboard.component.html',
  styleUrls: ['./admin-dashboard.component.scss'],
})
export class AdminDashboardComponent {
  loading = signal(true);
  error = signal<string | null>(null);

  data = signal<DashboardCore>({
    total_productos: 0,
    productos_bajo_stock: 0,
    total_categorias: 0,
  });
  movimientos = signal<Movimiento[]>([]);
  weekMovimientos = computed(() => this.filterLastDays(this.movimientos(), 7));

  // ===== BARRAS (Resumen Movimientos) =====
  barData = signal<BarItem[]>([]);

  maxBar = computed(() => {
    const max = Math.max(...this.barData().map((x) => Math.max(x.entradas, x.salidas)));
    return Math.max(max, 1);
  });

  barHover = signal<BarItem | null>(null);

  // ===== KPIs dinámicos =====
  movimientosTotal = computed(() => this.weekMovimientos().length);
  entradasTotal = computed(() =>
    this.weekMovimientos().filter((m) => m.tipo === 'ENTRADA').reduce((a, m) => a + m.cantidad, 0)
  );
  salidasTotal = computed(() =>
    this.weekMovimientos().filter((m) => m.tipo === 'SALIDA').reduce((a, m) => a + m.cantidad, 0)
  );
  ajustesTotal = computed(() =>
    this.weekMovimientos().filter((m) => m.tipo === 'AJUSTE').reduce((a, m) => a + m.cantidad, 0)
  );
  balance = computed(() => this.entradasTotal() - this.salidasTotal());
  recentMovimientos = computed(() => this.weekMovimientos().slice(0, 8));

  constructor(private api: AdminDashboardService) {
    this.load();
  }

  load() {
    this.loading.set(true);
    this.error.set(null);

    this.api
      .getDashboard(this.lastRange(7))
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (raw) => {
          const normalized = this.normalize(raw ?? {});
          this.data.set(normalized.core);
          this.movimientos.set(normalized.movimientos);
          this.barData.set(normalized.barData);
        },
        error: (e: unknown) => {
          const err = e as HttpErrorResponse;
          const msg = err?.error?.message || 'No se pudo cargar el dashboard.';
          this.error.set(msg);
        },
      });
  }

  // altura % para las barras
  h(val: number) {
    return Math.round((val / this.maxBar()) * 100);
  }

  trackByMovimiento(_: number, m: Movimiento) {
    return `${m.tipo}-${m.producto}-${new Date(m.fecha).getTime()}-${m.cantidad}`;
  }

  private normalize(raw: any) {
    const payload: any = raw?.data ?? raw ?? {};
    const resumen = payload?.resumen ?? payload ?? {};

    const core: DashboardCore = {
      total_productos: this.toNumber(resumen?.total_productos ?? resumen?.productos_total ?? resumen?.totalProductos),
      productos_bajo_stock: this.toNumber(resumen?.productos_bajo_stock ?? resumen?.bajo_stock ?? resumen?.low_stock),
      total_categorias: this.toNumber(resumen?.total_categorias ?? resumen?.categorias_total ?? resumen?.totalCategorias),
    };

    // Prefer movimientos_recientes (trae nombre de producto), rango queda para barras
    const rawMovs = Array.isArray(payload?.movimientos_recientes)
      ? payload.movimientos_recientes
      : Array.isArray(payload?.movimientos)
      ? payload.movimientos
      : Array.isArray(payload?.movimientos_rango)
        ? payload.movimientos_rango
        : Array.isArray(payload?.items)
          ? payload.items
        : Array.isArray(payload?.data)
          ? payload.data
          : [];

    const movimientos = rawMovs
      .map((m: any) => this.normalizeMovimiento(m))
      .filter((m: Movimiento | null): m is Movimiento => !!m)
      .sort((a: Movimiento, b: Movimiento) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());

    const weekMovs = this.filterLastDays(movimientos, 7);

    const barData = this.normalizeBars(
      payload?.resumen_semanal ??
        payload?.resumen_movimientos ??
        payload?.movimientos_resumen ??
        payload?.barras ??
        payload?.resumen?.movimientos ??
        payload?.resumen?.movimientos_semanales,
      weekMovs
    );

    return { core, movimientos, barData };
  }

  private normalizeMovimiento(m: any): Movimiento | null {
    if (!m) return null;
    const tipo = (m.tipo ?? m.tipo_movimiento ?? m.movimiento ?? 'AJUSTE') as MovimientoTipo;
    const producto = String(
      m.producto_nombre ??
        m.productos?.nombre ??
        m.producto?.nombre ??
        m.producto ??
        m.nombre ??
        m.producto_id ??
        m.item ??
        'Producto'
    );
    const cantidad = this.toNumber(m.cantidad ?? m.qty ?? m.stock ?? 0);
    const fecha = m.fecha ?? m.created_at ?? m.updated_at ?? new Date();
    const categoria = m.categoria ?? m.categoria_nombre ?? m.categoriaNombre ?? null;

    const motivoRaw = String(m.motivo ?? '');
    const ajusteTipo = this.extractAjusteTipo(motivoRaw) ?? (m.ajuste_tipo as 'ENTRADA' | 'SALIDA' | undefined) ?? null;
    const finalTipo: MovimientoTipo = ajusteTipo ? 'AJUSTE' : tipo;

    return { tipo: finalTipo, ajuste_tipo: ajusteTipo, producto, cantidad, fecha, categoria };
  }

  private normalizeBars(raw: any, movimientos: Movimiento[]): BarItem[] {
    const days = this.lastDays(7);
    const map = new Map<string, { entradas: number; salidas: number }>();
    for (const d of days) map.set(d.key, { entradas: 0, salidas: 0 });

    const hasRaw = Array.isArray(raw) && raw.length;
    if (hasRaw) {
      for (const x of raw) {
        const key = this.resolveBarKey(x, days);
        if (!key || !map.has(key)) continue;
        const cur = map.get(key)!;
        cur.entradas += this.toNumber(x.entradas ?? x.in ?? x.ingresos ?? 0);
        cur.salidas += this.toNumber(x.salidas ?? x.out ?? x.egresos ?? 0);
        map.set(key, cur);
      }
    }

    if (!hasRaw) {
      for (const m of movimientos) {
        const key = this.dateKey(new Date(m.fecha));
        if (!map.has(key)) continue;
        const cur = map.get(key)!;
        if (m.tipo === 'ENTRADA') cur.entradas += m.cantidad;
        if (m.tipo === 'SALIDA') cur.salidas += m.cantidad;
        if (m.tipo === 'AJUSTE') {
          if (m.ajuste_tipo === 'ENTRADA') cur.entradas += m.cantidad;
          if (m.ajuste_tipo === 'SALIDA') cur.salidas += m.cantidad;
        }
        map.set(key, cur);
      }
    }

    return days.map((d) => ({
      day: d.label,
      entradas: map.get(d.key)?.entradas ?? 0,
      salidas: map.get(d.key)?.salidas ?? 0,
    }));
  }

  private lastDays(count: number) {
    const out: { key: string; label: string }[] = [];
    const labels = ['Dom', 'Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab'];
    for (let i = count - 1; i >= 0; i -= 1) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      out.push({ key: this.dateKey(d), label: labels[d.getDay()] });
    }
    return out;
  }

  private dateKey(d: Date) {
    const y = d.getFullYear();
    const m = `${d.getMonth() + 1}`.padStart(2, '0');
    const day = `${d.getDate()}`.padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  private toNumber(val: any) {
    const n = Number(val);
    return Number.isFinite(n) ? n : 0;
  }

  private filterLastDays(items: Movimiento[], count: number) {
    const from = new Date();
    from.setDate(from.getDate() - (count - 1));
    from.setHours(0, 0, 0, 0);
    return items.filter((m) => new Date(m.fecha).getTime() >= from.getTime());
  }

  private lastRange(count: number) {
    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - (count - 1));
    return {
      from: new Date(from.getFullYear(), from.getMonth(), from.getDate(), 0, 0, 0, 0).toISOString(),
      to: new Date(to.getFullYear(), to.getMonth(), to.getDate(), 23, 59, 59, 999).toISOString(),
    };
  }

  private extractAjusteTipo(motivo: string): 'ENTRADA' | 'SALIDA' | null {
    const m = motivo.toUpperCase();
    if (m.startsWith('AJUSTE:ENTRADA')) return 'ENTRADA';
    if (m.startsWith('AJUSTE:SALIDA')) return 'SALIDA';
    return null;
  }

  private resolveBarKey(x: any, days: { key: string; label: string }[]) {
    const rawKey = String(x.key ?? x.date ?? x.fecha ?? x.day_key ?? '').trim();
    if (rawKey && rawKey.length >= 10) return rawKey.slice(0, 10);
    const label = String(x.day ?? x.dia ?? x.label ?? '').trim();
    const match = days.find((d) => d.label === label);
    return match?.key ?? '';
  }
}
