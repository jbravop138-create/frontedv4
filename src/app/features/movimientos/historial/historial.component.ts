import { Component, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { finalize } from 'rxjs';
import { MovimientosApiService, TipoMovimiento } from '../services/movimientos.api.service';
import { FormsModule } from '@angular/forms';
import { ProductosApiService, Producto } from '../../productos/pages/productos/productos.api.service';
import { CategoriasApiService, Categoria } from '../../categorias/categorias.api.service';

interface MovimientoView {
  id: string;
  fecha: string;
  tipo: TipoMovimiento;
  ajuste_tipo?: 'ENTRADA' | 'SALIDA' | null;
  cantidad: number;
  producto_nombre: string;
  producto_id: string;
  categoria_id: string;
  categoria_nombre: string;
  usuario_nombre: string;
  motivo: string;
}

@Component({
  standalone: true,
  selector: 'app-history',
  imports: [CommonModule, FormsModule],
  templateUrl: './historial.component.html',
  styleUrls: ['./historial.component.scss'],
})
export class HistoryComponent {
  search = signal('');
  categoria = signal('all');
  tipo = signal<'all' | TipoMovimiento>('all');

  loading = signal(true);
  error = signal<string | null>(null);
  items = signal<MovimientoView[]>([]);

  editOpen = signal(false);
  editLoading = signal(false);
  editError = signal<string | null>(null);
  categorias = signal<Categoria[]>([]);
  productos = signal<Producto[]>([]);
  editForm = signal({
    id: '',
    nombre: '',
    categoria_id: '',
    talla: '',
    color: '',
    descripcion: '',
  });

  updateEditForm<K extends keyof ReturnType<typeof this.editForm>>(key: K, value: ReturnType<typeof this.editForm>[K]) {
    this.editForm.update((current) => ({ ...current, [key]: value }));
  }

  filteredItems = computed(() => {
    const q = this.search().trim().toLowerCase();
    const cat = this.categoria();
    const tipo = this.tipo();
    return this.items().filter((m) => {
      if (cat !== 'all' && !this.matchesCategoria(m, cat)) return false;
      if (tipo !== 'all' && m.tipo !== tipo) return false;
      if (!q) return true;
      return (
        (m.producto_nombre ?? '').toLowerCase().includes(q) ||
        (m.usuario_nombre ?? '').toLowerCase().includes(q) ||
        (m.motivo ?? '').toLowerCase().includes(q)
      );
    });
  });

  total = computed(() => this.filteredItems().length);
  entradas = computed(() => this.filteredItems().filter((m) => m.tipo === 'ENTRADA').length);
  salidas = computed(() => this.filteredItems().filter((m) => m.tipo === 'SALIDA').length);
  ajustes = computed(() => this.filteredItems().filter((m) => m.tipo === 'AJUSTE').length);

  constructor(
    private api: MovimientosApiService,
    private productosApi: ProductosApiService,
    private categoriasApi: CategoriasApiService
  ) {}

  ngOnInit() {
    this.loadCategorias();
    this.loadProductos();
    this.load();
  }

  load() {
    this.loading.set(true);
    this.error.set(null);

    this.api
      .historial({
        limit: 50,
        offset: 0,
      })
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (res) => {
          const payload: any = (res as any)?.data ?? res ?? {};
          const raw =
            Array.isArray(payload) ? payload :
            Array.isArray((res as any)?.data) ? (res as any).data :
            payload?.items ??
            payload?.data ??
            payload?.movimientos ??
            payload?.rows ??
            [];
          const list = Array.isArray(raw)
            ? raw
            : Array.isArray(raw?.items)
              ? raw.items
              : Array.isArray(raw?.rows)
                ? raw.rows
                : Array.isArray(raw?.data)
                  ? raw.data
                  : [];
          const mapped: MovimientoView[] = (list as any[])
            .map((m) => this.normalize(m))
            .filter((m): m is MovimientoView => !!m);
          this.items.set(mapped);
        },
        error: (e: unknown) => {
          const err = e as HttpErrorResponse;
          const msg = err?.error?.message || 'No se pudo cargar el historial de movimientos';
          this.error.set(msg);
        },
      });
  }

  onSearch(value: string) {
    this.search.set(value ?? '');
  }

  onCategoria(value: string) {
    this.categoria.set(value || 'all');
  }

  onTipo(value: string) {
    this.tipo.set((value as TipoMovimiento) || 'all');
  }

  clearFilters() {
    this.search.set('');
    this.categoria.set('all');
    this.tipo.set('all');
  }

  trackById(_: number, m: MovimientoView) {
    return m.id;
  }

  openEdit(m: MovimientoView) {
    if (!m.producto_id) {
      this.error.set('No se encontró el producto para editar.');
      return;
    }

    this.editError.set(null);
    this.editOpen.set(true);
    this.editLoading.set(true);
    this.editForm.set({
      id: m.producto_id,
      nombre: m.producto_nombre ?? '',
      categoria_id: '',
      talla: '',
      color: '',
      descripcion: '',
    });

    this.productosApi
      .get(m.producto_id)
      .pipe(finalize(() => this.editLoading.set(false)))
      .subscribe({
        next: (res) => {
          const p = (res as any)?.data ?? res ?? {};
          const producto: Partial<Producto> = p?.producto ?? p ?? {};
          this.editForm.set({
            id: String(producto.id ?? m.producto_id),
            nombre: String(producto.nombre ?? m.producto_nombre ?? ''),
            categoria_id: String(producto.categoria_id ?? ''),
            talla: String(producto.talla ?? ''),
            color: String(producto.color ?? ''),
            descripcion: String((producto as any).descripcion ?? (producto as any).detalles ?? ''),
          });
        },
        error: (e: unknown) => {
          const err = e as HttpErrorResponse;
          this.editError.set(err?.error?.message ?? 'No se pudo cargar el producto.');
        },
      });
  }

  closeEdit() {
    this.editOpen.set(false);
    this.editError.set(null);
  }

  saveEdit() {
    const f = this.editForm();
    if (!f.nombre.trim()) {
      this.editError.set('Nombre es obligatorio.');
      return;
    }

    this.editLoading.set(true);
    this.editError.set(null);
    const payload: Partial<Producto> = {
      nombre: f.nombre.trim(),
      categoria_id: f.categoria_id || undefined,
      talla: f.talla?.trim() || undefined,
      color: f.color?.trim() || undefined,
    };
    if (f.descripcion?.trim()) {
      (payload as any).descripcion = f.descripcion.trim();
    }

    this.productosApi
      .update(f.id, payload)
      .pipe(finalize(() => this.editLoading.set(false)))
      .subscribe({
        next: () => {
          this.items.update((list) =>
            list.map((m) =>
              m.producto_id === f.id ? { ...m, producto_nombre: f.nombre.trim() } : m
            )
          );
          this.closeEdit();
        },
        error: (e: unknown) => {
          const err = e as HttpErrorResponse;
          this.editError.set(err?.error?.message ?? 'No se pudo actualizar el producto.');
        },
      });
  }

  private normalize(m: any): MovimientoView | null {
    if (!m) return null;
    const tipoRaw = String(m.tipo ?? m.tipo_movimiento ?? m.movimiento ?? '').trim();
    const tipoUpper = tipoRaw.toUpperCase();
    let tipo: TipoMovimiento = 'AJUSTE';
    if (tipoUpper.includes('ENTRADA') || tipoUpper.includes('INGRESO')) tipo = 'ENTRADA';
    else if (tipoUpper.includes('SALIDA') || tipoUpper.includes('EGRESO')) tipo = 'SALIDA';
    else if (tipoUpper.includes('AJUSTE')) tipo = 'AJUSTE';
    const motivoRaw = String(m.motivo ?? '');
    const ajusteTipo = this.extractAjusteTipo(motivoRaw) ?? (m.ajuste_tipo as 'ENTRADA' | 'SALIDA' | undefined) ?? null;
    if (ajusteTipo) tipo = 'AJUSTE';
    const productoIdRaw =
      m.producto_id ??
      m.productos?.id ??
      m.producto?.id ??
      (typeof m.producto === 'object' ? m.producto?.id : undefined);

    return {
      id: String(m.id ?? ''),
      fecha: m.created_at ?? m.fecha ?? m.updated_at ?? new Date().toISOString(),
      tipo,
      cantidad: Number(m.cantidad ?? m.qty ?? 0),
      motivo: this.stripAjusteMotivo(motivoRaw) ?? '—',
      ajuste_tipo: ajusteTipo,
      producto_nombre: m.productos?.nombre ?? m.producto?.nombre ?? m.producto_nombre ?? '—',
      producto_id: String(productoIdRaw ?? ''),
      categoria_id: String(
        m.categoria_id ??
          m.categoria?.id ??
          m.productos?.categoria_id ??
          m.productos?.categoria?.id ??
          m.producto?.categoria_id ??
          m.producto?.categoria?.id ??
          ''
      ),
      categoria_nombre:
        m.categoria?.nombre ??
        m.categoria_nombre ??
        m.productos?.categoria_nombre ??
        m.productos?.categoria?.nombre ??
        m.producto?.categoria_nombre ??
        m.producto?.categoria?.nombre ??
        'Sin categoría',
      usuario_nombre:
        m.profiles?.full_name ??
        m.profiles?.username ??
        m.usuario?.nombre ??
        '—',
    };
  }

  private extractAjusteTipo(motivo: string): 'ENTRADA' | 'SALIDA' | null {
    const m = motivo.toUpperCase();
    if (m.startsWith('AJUSTE:ENTRADA')) return 'ENTRADA';
    if (m.startsWith('AJUSTE:SALIDA')) return 'SALIDA';
    return null;
  }

  private stripAjusteMotivo(motivo: string): string {
    const m = motivo ?? '';
    if (!m.toUpperCase().startsWith('AJUSTE:')) return m;
    const idx = m.indexOf('-');
    if (idx === -1) return '—';
    return m.slice(idx + 1).trim() || '—';
  }

  private loadCategorias() {
    this.categoriasApi.list().subscribe({
      next: (cats) => this.categorias.set(cats ?? []),
      error: () => this.categorias.set([]),
    });
  }

  private matchesCategoria(m: MovimientoView, catId: string) {
    const idMatch = String(m.categoria_id ?? '') === String(catId);
    if (idMatch) return true;
    const productos = this.productos();
    if (!productos.length) return false;

    const prodById = productos.find((p) => String(p.id) === String(m.producto_id));
    if (prodById && String(prodById.categoria_id) === String(catId)) return true;

    const movNombre = String(m.producto_nombre ?? '').trim().toLowerCase();
    if (!movNombre) return false;
    const prodByName = productos.find(
      (p) => String(p.nombre ?? '').trim().toLowerCase() === movNombre
    );
    return !!prodByName && String(prodByName.categoria_id) === String(catId);
  }

  private loadProductos() {
    this.productosApi.list().subscribe({
      next: (list) => this.productos.set(list ?? []),
      error: () => this.productos.set([]),
    });
  }

}
