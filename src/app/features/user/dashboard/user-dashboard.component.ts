import { CommonModule } from '@angular/common';
import { Component, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { finalize } from 'rxjs';
import { UserDashboardService } from './user-dashboard.service';
import { MovimientosService } from './user-movimientos.service';
import { CategoriasApiService, Categoria } from '../../categorias/categorias.api.service';
import { ProductosApiService, Producto } from '../../productos/pages/productos/productos.api.service';

type Tipo = 'ENTRADA' | 'SALIDA' | 'AJUSTE';
type Filter = 'ALL' | Tipo;

type Row = {
  tipo: Tipo | string;
  ajuste_tipo?: 'ENTRADA' | 'SALIDA' | null;
  producto: string;
  cantidad: number;
  motivo?: string | null;
  fecha: string | Date;
};

@Component({
  standalone: true,
  selector: 'app-user-dashboard',
  imports: [CommonModule, FormsModule],
  templateUrl: './user-dashboard.component.html',
  styleUrls: ['./user-dashboard.component.scss'],
})
export class UserDashboardComponent {
  loading = signal(true);

  // data del backend (tal cual venga)
  data = signal<any>(null);

  // theme solo para user
  theme = signal<'dark' | 'light'>(this.readTheme());

  // filtro
  filter = signal<Filter>('ALL');

  // modal + form
  modalOpen = signal(false);
  historyOpen = signal(false);
  saving = signal(false);
  errorMsg = signal<string | null>(null);
  showLowStock = signal(false);
  showDetalles = signal(false);
  consejo = signal<string>('');

  categorias = signal<Categoria[]>([]);
  productos = signal<Producto[]>([]);

  form: {
    tipo: Tipo;
    categoria_id: string;
    producto_id: string;
    nombre: string;
    talla: string;
    color: string;
    descripcion: string;
    cantidad: number;
    motivo: string;
  } = {
    tipo: 'ENTRADA',
    categoria_id: '',
    producto_id: '',
    nombre: '',
    talla: '',
    color: '',
    descripcion: '',
    cantidad: 1,
    motivo: '',
  };

  constructor(
    private api: UserDashboardService,
    private movApi: MovimientosService,
    private categoriasApi: CategoriasApiService,
    private productosApi: ProductosApiService,
    private router: Router,
  ) {
    this.applyTheme(this.theme());
  }

  ngOnInit() {
    this.load();
    this.loadCategorias();
    this.setConsejo();
  }

  // ✅ ViewModel para no explotar en el HTML
  vm = computed(() => {
    const d = this.data();
    const resumen = d?.resumen ?? {};
    const movs = d?.movimientos_recientes ?? [];

    // low stock opcional (si backend lo manda)
    const low = d?.alertas?.stock_bajo ?? [];
    const lowCount = d?.alertas?.stock_bajo_count ?? 0;

    return {
      movimientosHoy: resumen.movimientos_hoy ?? 0,
      movimientosRecientesCount: movs?.length ?? 0,
      movimientos: movs,
      lowStockCount: lowCount,
      lowStockList: low,
    };
  });

  rows = computed<Row[]>(() => {
    const v = this.vm();
    return (v.movimientos ?? []).map((m: any) => {
      const motivoRaw = String(m.motivo ?? '');
      const ajusteTipo = this.extractAjusteTipo(motivoRaw) ?? (m.ajuste_tipo as 'ENTRADA' | 'SALIDA' | undefined) ?? null;
      const tipo: Tipo | string = ajusteTipo ? 'AJUSTE' : (m.tipo ?? 'AJUSTE');
      return {
        tipo,
        ajuste_tipo: ajusteTipo,
        cantidad: m.cantidad,
        motivo: this.stripAjusteMotivo(motivoRaw),
        fecha: m.created_at ?? m.fecha ?? new Date(),
        producto: m.productos?.nombre ?? m.producto ?? 'Producto',
      };
    });
  });

  filteredRows = computed(() => {
    const f = this.filter();
    const list = this.rows();
    if (f === 'ALL') return list;
    return list.filter((r) => r.tipo === f);
  });

  // ---- DATA ----
  load() {
    this.loading.set(true);
    this.api
      .getDashboard()
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (d) => {
          const payload: any = (d as any)?.data ?? d ?? {};
          this.data.set(payload);
        },
        error: (e) => {
          console.log('USER DASH ERROR', e);
          this.errorMsg.set(e?.error?.message ?? 'No se pudo cargar el dashboard.');
        },
      });
  }

  // ---- MODAL ----
  openModal() {
    this.errorMsg.set(null);
    this.form = {
      tipo: 'ENTRADA',
      categoria_id: '',
      producto_id: '',
      nombre: '',
      talla: '',
      color: '',
      descripcion: '',
      cantidad: 1,
      motivo: '',
    };
    this.productos.set([]);
    this.showDetalles.set(false);
    this.modalOpen.set(true);
  }

  closeModal() {
    this.modalOpen.set(false);
  }

  openHistory() {
    this.historyOpen.set(true);
  }

  closeHistory() {
    this.historyOpen.set(false);
  }

  submitMovimiento() {
    this.errorMsg.set(null);

    const categoriaId = this.form.categoria_id.trim();
    if (!categoriaId) {
      this.errorMsg.set('Selecciona una categoría.');
      return;
    }

    const isEntrada = this.form.tipo === 'ENTRADA';
    const tieneProducto = !!this.form.producto_id.trim();
    const tieneNombre = !!this.form.nombre.trim();

    if (isEntrada && !tieneNombre) {
      this.errorMsg.set('Debes ingresar el nombre del producto.');
      return;
    }
    if (!isEntrada && !tieneProducto) {
      this.errorMsg.set('Selecciona un producto.');
      return;
    }
    if (!this.form.cantidad || this.form.cantidad < 1) {
      this.errorMsg.set('Cantidad inválida.');
      return;
    }

    const payload: any = {
      tipo: this.form.tipo,
      cantidad: Number(this.form.cantidad),
      motivo: this.form.motivo?.trim() || null,
      categoria_id: categoriaId,
    };

    if (isEntrada) {
      payload.nombre = this.form.nombre.trim();
      payload.talla = this.form.talla?.trim() || undefined;
      payload.color = this.form.color?.trim() || undefined;
      payload.descripcion = this.form.descripcion?.trim() || undefined;
    } else {
      payload.producto_id = this.form.producto_id.trim();
    }

    this.saving.set(true);

    this.movApi.registrarMovimiento(payload).subscribe({
      next: () => {
        this.closeModal();
        this.load();
      },
      error: (e) => {
        console.log('REGISTRAR MOV ERROR', e);
        this.errorMsg.set(e?.error?.message ?? 'No se pudo guardar el movimiento.');
      },
      complete: () => this.saving.set(false),
    });
  }

  private applyTheme(t: 'dark' | 'light') {
    document.body.classList.toggle('user-light', t === 'light');
    document.body.classList.toggle('user-dark', t === 'dark');
  }

  private persistTheme(t: 'dark' | 'light') {
    localStorage.setItem('user_theme', t);
  }

  private readTheme(): 'dark' | 'light' {
    const t = localStorage.getItem('user_theme');
    return (t === 'light' || t === 'dark') ? t : 'dark';
  }

  private setConsejo() {
    const tips = [
      'Revisa los ajustes al cierre del turno para evitar descuadres.',
      'Confirma el motivo en cada salida para mantener trazabilidad.',
      'Si el stock llega a 0, decide si debes eliminar el producto.',
      'Usa RFID para acelerar entradas y evitar duplicados.',
      'Antes de ajustar, valida el stock disponible.',
    ];
    const key = 'user_dashboard_tip_last';
    const raw = localStorage.getItem(key);
    const last = raw ? Number(raw) : -1;
    let idx = Math.floor(Math.random() * tips.length);
    if (tips.length > 1 && idx === last) {
      idx = (idx + 1) % tips.length;
    }
    localStorage.setItem(key, String(idx));
    this.consejo.set(tips[idx]);
  }

  verMovimientos() {
    this.router.navigate(['/user/movimientos']);
  }

  irInventario() {
    this.router.navigate(['/user/inventario']);
  }

  setTipo(tipo: Tipo) {
    this.form.tipo = tipo;
    if (tipo === 'ENTRADA') {
      this.form.producto_id = '';
    } else {
      this.form.nombre = '';
      this.form.talla = '';
      this.form.color = '';
      this.form.descripcion = '';
      this.showDetalles.set(false);
      if (this.form.categoria_id) this.loadProductos(this.form.categoria_id);
    }
  }

  setCategoria(id: string) {
    this.form.categoria_id = id ?? '';
    this.form.producto_id = '';
    if (this.form.tipo !== 'ENTRADA' && this.form.categoria_id) {
      this.loadProductos(this.form.categoria_id);
    } else {
      this.productos.set([]);
    }
  }

  loadCategorias() {
    this.categoriasApi.list().subscribe({
      next: (cats) => this.categorias.set(cats ?? []),
      error: () => this.categorias.set([]),
    });
  }

  loadProductos(categoriaId: string) {
    this.productosApi.list('', categoriaId).subscribe({
      next: (list) => this.productos.set(list ?? []),
      error: () => this.productos.set([]),
    });
  }

  productosOrdenados = computed(() =>
    [...this.productos()].sort((a, b) =>
      String(a.nombre ?? '').localeCompare(String(b.nombre ?? ''))
    )
  );

  private extractAjusteTipo(motivo: string): 'ENTRADA' | 'SALIDA' | null {
    const m = motivo.toUpperCase();
    if (m.startsWith('AJUSTE:ENTRADA')) return 'ENTRADA';
    if (m.startsWith('AJUSTE:SALIDA')) return 'SALIDA';
    return null;
  }

  private stripAjusteMotivo(motivo: string): string | null {
    const m = motivo ?? '';
    if (!m.toUpperCase().startsWith('AJUSTE:')) return m || null;
    const idx = m.indexOf('-');
    if (idx === -1) return null;
    return m.slice(idx + 1).trim() || null;
  }
}
