import { CommonModule } from '@angular/common';
import { Component, computed, OnDestroy, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MovimientosApiService, TipoMovimiento } from './services/movimientos.api.service';
import { CategoriasApiService, Categoria } from '../categorias/categorias.api.service';
import { ProductosApiService, Producto } from '../productos/pages/productos/productos.api.service';
import { HttpErrorResponse } from '@angular/common/http';
import { finalize, Subscription } from 'rxjs';
import { RfidService, RfidProducto } from '../../services/rfid.service';

@Component({
  standalone: true,
  selector: 'app-movimientos',
  imports: [CommonModule, FormsModule],
  templateUrl: './movimientos.component.html',
  styleUrls: ['./movimientos.component.scss'],
})
export class MovimientosComponent implements OnDestroy {
  loading = signal(false);
  saving = signal(false);
  errorMsg = signal<string | null>(null);
  successMsg = signal<string | null>(null);
  showDetalles = signal(false);
  
  // Control del Modal y Escaneo
  showRfid = signal(false);
  isScanning = signal(false);
  rfidTipo = signal<TipoMovimiento>('ENTRADA');
  
  // 1. AGREGAMOS ESTA VARIABLE PARA LA VISTA
  scannedUid = signal<string | null>(null); // <--- NUEVO: Guarda el UID visualmente
  rfidProducto = signal<RfidProducto | null>(null);
  rfidNombre = signal('');
  rfidCategoriaId = signal('');
  rfidCantidad = signal(1);
  rfidTalla = signal('');
  rfidColor = signal('');
  rfidDescripcion = signal('');
  rfidError = signal<string | null>(null);
  rfidDetallesOpen = signal(false);
  rfidDuplicadoConfirm = signal(false);
  rfidInfo = signal<string | null>(null);
  rfidEliminarDecision = signal<'delete' | 'keep' | null>(null);
  rfidAjusteTipo = signal<'ENTRADA' | 'SALIDA'>('SALIDA');
  uidLookupError = signal<string | null>(null);
  uidProducto = signal<RfidProducto | null>(null);
  uidDetallesOpen = signal(false);
  private uidLookupSeq = 0;
  
  private rfidSub?: Subscription;

  // ... (Tus filtros, listas y computados siguen igual) ...
  tipoFiltro = signal<'ALL' | TipoMovimiento>('ALL');
  searchText = signal('');
  movimientos = signal<MovimientoView[]>([]);
  categorias = signal<Categoria[]>([]);
  productos = signal<Producto[]>([]);

  totalMovs = computed(() => this.movimientos().length);
  entradasTotal = computed(() => this.movimientos().filter((m) => m.tipo === 'ENTRADA').reduce((a, m) => a + m.cantidad, 0));
  salidasTotal = computed(() => this.movimientos().filter((m) => m.tipo === 'SALIDA').reduce((a, m) => a + m.cantidad, 0));
  ajustesTotal = computed(() => this.movimientos().filter((m) => m.tipo === 'AJUSTE').reduce((a, m) => a + m.cantidad, 0));
  balance = computed(() => this.entradasTotal() - this.salidasTotal());

  form = {
    tipo: 'ENTRADA' as TipoMovimiento,
    ajuste_tipo: 'SALIDA' as 'ENTRADA' | 'SALIDA',
    categoria_id: '',
    producto_id: '',
    nombre: '',
    talla: '',
    color: '',
    descripcion: '',
    cantidad: 1,
    motivo: '',
    uid: '',
    eliminar_producto: null as boolean | null,
  };

  productosOrdenados = computed(() => [...this.productos()].sort((a, b) => String(a.nombre ?? '').localeCompare(String(b.nombre ?? ''))));

  filtered = computed(() => {
    const t = this.tipoFiltro();
    const q = this.searchText().trim().toLowerCase();
    let list = this.movimientos();
    if (t !== 'ALL') list = list.filter((m) => m.tipo === t);
    if (!q) return list;
    return list.filter((m) => `${m.producto} ${m.tipo}`.toLowerCase().includes(q));
  });

  dailySeries = computed(() => {
      const days = this.lastDays(7);
      const map = new Map<string, { entradas: number; salidas: number }>();
      for (const d of days) map.set(d.key, { entradas: 0, salidas: 0 });
      for (const m of this.movimientos()) {
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
      const max = Math.max(1, ...Array.from(map.values()).flatMap((x) => [x.entradas, x.salidas]));
      return days.map((d) => ({
        label: d.label,
        entradas: map.get(d.key)?.entradas ?? 0,
        salidas: map.get(d.key)?.salidas ?? 0,
        entradasW: this.percent(map.get(d.key)?.entradas ?? 0, max),
        salidasW: this.percent(map.get(d.key)?.salidas ?? 0, max),
      }));
  });

  constructor(
    private api: MovimientosApiService,
    private categoriasApi: CategoriasApiService,
    private productosApi: ProductosApiService,
    private rfidService: RfidService
  ) {}

  ngOnInit() {
    this.showDetalles.set(this.form.tipo === 'ENTRADA');
    this.loadCategorias();
    this.cargar();
  }

  ngOnDestroy() {
    this.closeRfid();
  }

  // ----------------------------------------------------------------------
  // LÓGICA RFID CORREGIDA
  // ----------------------------------------------------------------------
  
  openRfid() {
    this.rfidTipo.set(this.form.tipo);
    this.showRfid.set(true);
    this.isScanning.set(true);
    this.scannedUid.set(null); // <--- NUEVO: Reseteamos al abrir
    this.rfidProducto.set(null);
    this.rfidNombre.set('');
    this.rfidCategoriaId.set('');
    this.rfidCantidad.set(1);
    this.rfidTalla.set('');
    this.rfidColor.set('');
    this.rfidDescripcion.set('');
    this.rfidError.set(null);
    this.rfidDetallesOpen.set(false);
    this.rfidDuplicadoConfirm.set(false);
    this.rfidInfo.set(null);
    this.rfidEliminarDecision.set(null);
    this.rfidAjusteTipo.set('SALIDA');
    this.uidProducto.set(null);
    this.uidDetallesOpen.set(false);
    this.successMsg.set(null);

    this.rfidService.iniciarEscucha();

    this.rfidSub = this.rfidService.nuevoTag$.subscribe((uid) => {
      console.log('🎯 TAG DETECTADO:', uid);
      this.procesarTagDetectado(uid);
    });
  }

  closeRfid() {
    this.showRfid.set(false);
    this.isScanning.set(false);
    this.successMsg.set(null);
    this.rfidService.detenerEscucha();
    if (this.rfidSub) {
      this.rfidSub.unsubscribe();
      this.rfidSub = undefined;
    }
  }

  setRfidTipo(tipo: TipoMovimiento) {
    this.rfidTipo.set(tipo);
    this.rfidEliminarDecision.set(null);
    if (tipo !== 'AJUSTE') this.rfidAjusteTipo.set('SALIDA');
    if (tipo !== 'ENTRADA' && this.scannedUid() && !this.rfidProducto()) {
      this.rfidError.set('UID no encontrado en productos para SALIDA/AJUSTE.');
    } else {
      this.rfidError.set(null);
    }
  }

  // 2. CAMBIADO: Usamos la variable visual para confirmar
  confirmRfid() {
    const uid = this.scannedUid();
    
    if (!uid) {
        alert("Primero escanea una etiqueta");
        return;
    }

    this.form.uid = uid;

    const producto = this.rfidProducto();
    const tipo = this.rfidTipo();
    const tipoPayload = tipo === 'AJUSTE' ? this.rfidAjusteTipo() : tipo;

    if (producto && tipo === 'ENTRADA') {
      if (!this.rfidDuplicadoConfirm()) {
        this.rfidInfo.set('Este producto ya existe. ¿Deseas agregar más al stock?');
        this.rfidDetallesOpen.set(true);
        this.rfidDuplicadoConfirm.set(true);
        return;
      }
    }

    if (!producto && tipo !== 'ENTRADA') {
      this.rfidError.set('UID no encontrado. Para SALIDA/AJUSTE debes escanear un producto existente.');
      return;
    }

    const cantidad = Number(this.rfidCantidad() ?? 1);
    if (!cantidad || cantidad < 1) {
      this.rfidError.set('Cantidad inválida.');
      return;
    }

    if (producto) {
      if (tipo === 'AJUSTE') {
        const stockActual = this.getRfidStockActual();
        if (stockActual !== null && stockActual < 0) {
          this.rfidError.set('No se puede ajustar: el producto tiene stock negativo.');
          return;
        }
      }
      if (this.needsDeleteDecision()) {
        const decision = this.rfidEliminarDecision();
        if (!decision) {
          this.rfidError.set('Esta salida deja el stock en 0. Elige si deseas eliminar el producto.');
          return;
        }
      }
      const motivo = this.form.motivo?.trim();
      if (!motivo) {
        this.rfidError.set('Ingresa el motivo para registrar la salida/ajuste.');
        return;
      }
      this.registrarDesdeRfid({
        uid,
        tipo: tipoPayload,
        cantidad,
        producto_id: producto.id,
        eliminar_producto: this.needsDeleteDecision() ? this.rfidEliminarDecision() === 'delete' : undefined,
      });
      return;
    }

    const nombre = this.rfidNombre().trim();
    const categoriaId = this.rfidCategoriaId().trim();
    const talla = this.rfidTalla().trim();
    const color = this.rfidColor().trim();
    const descripcion = this.rfidDescripcion().trim();

    if (!nombre) { this.rfidError.set('Ingresa el nombre del producto.'); return; }
    if (!categoriaId) { this.rfidError.set('Selecciona una categoría.'); return; }
    if (!talla) { this.rfidError.set('Ingresa la talla.'); return; }
    if (!color) { this.rfidError.set('Ingresa el color.'); return; }

    this.registrarDesdeRfid({
      uid,
      tipo: 'ENTRADA',
      cantidad,
      categoria_id: categoriaId,
      nombre,
      talla,
      color,
      descripcion,
    });
  }

  async procesarTagDetectado(uid: string) {
    // 3. CAMBIADO: Actualizamos la variable visual y QUITAMOS el setTimeout
    // Esto hace que el modal se quede abierto mostrando el código
    this.scannedUid.set(uid); 
    this.isScanning.set(false);
    this.rfidError.set(null);
    this.rfidInfo.set(null);
    this.rfidDuplicadoConfirm.set(false);
    this.rfidEliminarDecision.set(null);

    const lookup = await this.rfidService.buscarProductoPorUid(uid);
    if (lookup.duplicates?.length) {
      this.rfidProducto.set(null);
      this.rfidError.set('Hay más de un producto con ese UID. Usa producto_id.');
      return;
    }
    const producto = lookup.producto;
    if (producto) {
      this.rfidProducto.set(producto);
      this.rfidDetallesOpen.set(false);
      this.rfidEliminarDecision.set(null);
      this.form.uid = uid;
      if (producto.categoria_id) {
        this.form.categoria_id = String(producto.categoria_id);
        this.loadProductos(this.form.categoria_id);
      }
      this.form.producto_id = String(producto.id ?? '');
      if (this.form.tipo === 'ENTRADA') {
        this.form.nombre = producto.nombre ?? this.form.nombre;
      }
      return;
    }

    this.rfidProducto.set(null);
    if (this.rfidTipo() !== 'ENTRADA') {
      this.rfidError.set('UID no encontrado en productos para SALIDA/AJUSTE.');
    }
  }

  // ----------------------------------------------------------------------
  private registrarDesdeRfid(payload: {
    uid: string;
    tipo: TipoMovimiento;
    cantidad: number;
    producto_id?: string;
    categoria_id?: string;
    nombre?: string;
    talla?: string;
    color?: string;
    descripcion?: string;
    eliminar_producto?: boolean;
  }) {
    this.errorMsg.set(null);
    this.rfidError.set(null);
    this.successMsg.set(null);
    this.saving.set(true);

    this.api.registrarMovimiento({
      tipo: payload.tipo,
      cantidad: Number(payload.cantidad ?? 1),
      motivo: this.buildMotivo(this.rfidTipo(), this.rfidAjusteTipo(), this.form.motivo),
      uid: payload.uid,
      producto_id: payload.producto_id,
      categoria_id: payload.categoria_id,
      nombre: payload.nombre,
      talla: payload.talla?.trim() || undefined,
      color: payload.color?.trim() || undefined,
      descripcion: payload.descripcion?.trim() || undefined,
      eliminar_producto: payload.eliminar_producto,
    })
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: () => {
          this.form.uid = '';
          this.successMsg.set('Movimiento RFID registrado');
          this.cargar();
          this.closeRfid();
        },
        error: (e) => {
          console.log('REGISTRAR RFID ERROR', e);
          this.errorMsg.set(e?.error?.message ?? 'No se pudo registrar movimiento RFID');
        },
      });
  }

  cargar() {
    this.loading.set(true);
    this.api.historial({ limit: 20, offset: 0 })
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (res) => {
          const payload: any = (res as any)?.data ?? res ?? {};
          const raw = Array.isArray(payload) ? payload : Array.isArray((res as any)?.data) ? (res as any).data : payload?.items ?? payload?.data ?? payload?.movimientos ?? payload?.rows ?? [];
          const list = Array.isArray(raw) ? raw : Array.isArray(raw?.items) ? raw.items : Array.isArray(raw?.rows) ? raw.rows : Array.isArray(raw?.data) ? raw.data : [];
          const mapped = (list as any[]).map((m) => this.normalize(m)).filter(Boolean) as MovimientoView[];
          this.movimientos.set(mapped);
        },
        error: (e: unknown) => {
          const err = e as HttpErrorResponse;
          this.errorMsg.set(err?.error?.message ?? 'Error cargando movimientos');
        },
      });
  }

  setTipo(tipo: TipoMovimiento) {
    this.form.tipo = tipo;
    this.uidLookupError.set(null);
    this.uidProducto.set(null);
    this.uidDetallesOpen.set(false);
    this.form.eliminar_producto = null;
    if (tipo !== 'AJUSTE') this.form.ajuste_tipo = 'SALIDA';
    if (tipo === 'ENTRADA') {
      this.form.producto_id = '';
      this.showDetalles.set(true);
    } else {
      this.form.nombre = '';
      this.form.talla = '';
      this.form.color = '';
      this.form.descripcion = '';
      this.showDetalles.set(false);
      if (this.form.categoria_id) this.loadProductos(this.form.categoria_id);
    }
  }

  registrar() {
    this.errorMsg.set(null);
    const categoriaId = this.form.categoria_id.trim();
    const wasEntrada = this.form.tipo === 'ENTRADA';
    if (!categoriaId) { this.errorMsg.set('Selecciona una categoría.'); return; }
    const isEntrada = this.form.tipo === 'ENTRADA';
    const tieneProducto = !!this.form.producto_id.trim();
    const tieneNombre = !!this.form.nombre.trim();
    if (isEntrada && !tieneNombre) { this.errorMsg.set('Debes ingresar el nombre del producto.'); return; }
    if (!isEntrada && !tieneProducto) { this.errorMsg.set('Selecciona un producto.'); return; }
    if (!this.form.cantidad || this.form.cantidad < 1) { this.errorMsg.set('Cantidad inválida.'); return; }

    this.saving.set(true);

    const descripcion = isEntrada ? this.form.descripcion.trim() || undefined : undefined;
    const manualStock = this.getManualStockActual();
    if (this.form.tipo === 'AJUSTE' && manualStock !== null && manualStock < 0) {
      this.errorMsg.set('No se puede ajustar: el producto tiene stock negativo.');
      this.saving.set(false);
      return;
    }
    if (this.needsManualDeleteDecision()) {
      if (this.form.eliminar_producto === null || this.form.eliminar_producto === undefined) {
        this.errorMsg.set('Elige si deseas eliminar el producto cuando quede en 0.');
        this.saving.set(false);
        return;
      }
    }

    const tipoPayload = this.form.tipo === 'AJUSTE' ? this.form.ajuste_tipo : this.form.tipo;
    const motivoPayload = this.buildMotivo(this.form.tipo, this.form.ajuste_tipo, this.form.motivo);

    this.api.registrarMovimiento({
      tipo: tipoPayload,
      cantidad: Number(this.form.cantidad),
      motivo: motivoPayload,
      categoria_id: categoriaId,
      producto_id: !isEntrada ? this.form.producto_id.trim() : undefined,
      nombre: isEntrada ? this.form.nombre.trim() : undefined,
      talla: isEntrada ? this.form.talla.trim() || undefined : undefined,
      color: isEntrada ? this.form.color.trim() || undefined : undefined,
      descripcion,
      // Si tu backend soporta guardar el UID, descomenta esto:
      uid: this.form.uid,
      eliminar_producto: this.needsManualDeleteDecision() ? (this.form.eliminar_producto ?? undefined) : undefined,
    })
    .pipe(finalize(() => this.saving.set(false)))
    .subscribe({
      next: () => {
        this.form.categoria_id = wasEntrada ? categoriaId : '';
        this.form.producto_id = '';
        this.form.nombre = '';
        this.form.talla = '';
        this.form.color = '';
        this.form.descripcion = '';
        this.form.motivo = '';
        this.form.cantidad = 1;
        this.form.uid = ''; 
        this.form.eliminar_producto = null;
        this.productos.set([]);
        this.showDetalles.set(false);
        this.cargar();
      },
      error: (e) => {
        this.errorMsg.set(e?.error?.message ?? 'No se pudo registrar movimiento');
      },
    });
  }

  loadCategorias() {
    this.categoriasApi.list().subscribe({
      next: (cats) => this.categorias.set(cats ?? []),
      error: () => this.categorias.set([]),
    });
  }

  setCategoria(id: string) {
    this.form.categoria_id = id ?? '';
    this.form.producto_id = '';
    this.form.eliminar_producto = null;
    if (this.form.tipo !== 'ENTRADA' && this.form.categoria_id) {
      this.loadProductos(this.form.categoria_id);
    } else {
      this.productos.set([]);
    }
  }

  loadProductos(categoriaId: string) {
    this.productosApi.list('', categoriaId).subscribe({
      next: (list) => this.productos.set(list ?? []),
      error: () => this.productos.set([]),
    });
  }

  async onUidChange(uid: string) {
    this.form.uid = uid ?? '';
    this.uidLookupError.set(null);

    const cleaned = this.form.uid.trim();
    if (!cleaned) {
      this.form.producto_id = '';
      this.uidProducto.set(null);
      this.uidDetallesOpen.set(false);
      return;
    }

    const seq = ++this.uidLookupSeq;
    const lookup = await this.rfidService.buscarProductoPorUid(cleaned);
    if (seq !== this.uidLookupSeq) return;

    if (lookup.duplicates?.length) {
      this.form.producto_id = '';
      this.uidLookupError.set('Hay más de un producto con ese UID. Usa producto_id.');
      this.uidProducto.set(null);
      this.uidDetallesOpen.set(false);
      return;
    }

    const producto = lookup.producto;
    if (!producto) {
      this.form.producto_id = '';
      this.uidLookupError.set('UID no encontrado en productos.');
      this.uidProducto.set(null);
      this.uidDetallesOpen.set(false);
      return;
    }

    if (producto.categoria_id) {
      this.form.categoria_id = String(producto.categoria_id);
      this.loadProductos(this.form.categoria_id);
    }

    this.form.producto_id = String(producto.id ?? '');
    this.uidProducto.set(producto);
    this.uidDetallesOpen.set(false);

    if (this.form.tipo === 'ENTRADA') {
      this.form.nombre = producto.nombre ?? this.form.nombre;
    }
  }

  setTipoFiltro(v: 'ALL' | TipoMovimiento) { this.tipoFiltro.set(v); }
  setSearch(v: string) { this.searchText.set(v ?? ''); }
  trackById(_: number, m: MovimientoView) { return m.id ?? `${m.tipo}-${m.producto}-${new Date(m.fecha).getTime()}-${m.cantidad}`; }

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
    return {
      id: String(m.id ?? ''),
      tipo,
      ajuste_tipo: ajusteTipo,
      producto: String(m.producto ?? m.producto_nombre ?? m.productos?.nombre ?? m.nombre ?? m.producto_id ?? 'Producto'),
      cantidad: Number(m.cantidad ?? m.qty ?? 0),
      fecha: m.fecha ?? m.created_at ?? m.updated_at ?? new Date(),
      motivo: this.stripAjusteMotivo(motivoRaw) ?? null,
    };
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

  private percent(part: number, total: number) {
    if (!total) return 0;
    return Math.round((part / total) * 100);
  }

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

  private buildMotivo(tipo: TipoMovimiento, ajusteTipo: 'ENTRADA' | 'SALIDA', motivo?: string | null) {
    const base = (motivo ?? '').trim();
    if (tipo !== 'AJUSTE') return base || null;
    const prefix = `AJUSTE:${ajusteTipo}`;
    if (!base) return prefix;
    if (base.toUpperCase().startsWith('AJUSTE:')) return base;
    return `${prefix} - ${base}`;
  }

  getRfidStockActual(): number | null {
    const p = this.rfidProducto();
    if (!p) return null;
    const v = Number(p.stock_actual ?? p.stock ?? NaN);
    return Number.isNaN(v) ? null : v;
  }

  getRfidRestante(): number | null {
    const stock = this.getRfidStockActual();
    if (stock === null) return null;
    const qty = Number(this.rfidCantidad() ?? 0);
    return stock - qty;
  }

  needsDeleteDecision(): boolean {
    const restante = this.getRfidRestante();
    const tipoPayload = this.getRfidTipoPayload();
    return tipoPayload === 'SALIDA' && restante !== null && restante <= 0;
  }

  getRfidTipoPayload(): TipoMovimiento {
    return this.rfidTipo() === 'AJUSTE' ? this.rfidAjusteTipo() : this.rfidTipo();
  }

  getManualProducto() {
    return this.productos().find((p) => p.id === this.form.producto_id) ?? null;
  }

  getManualStockActual(): number | null {
    const p = this.getManualProducto();
    if (!p) return null;
    const v = Number((p as any).stock_actual ?? (p as any).stock ?? NaN);
    return Number.isNaN(v) ? null : v;
  }

  getManualRestante(): number | null {
    const stock = this.getManualStockActual();
    if (stock === null) return null;
    const qty = Number(this.form.cantidad ?? 0);
    return stock - qty;
  }

  needsManualDeleteDecision(): boolean {
    const restante = this.getManualRestante();
    const tipoPayload = this.getManualTipoPayload();
    return tipoPayload === 'SALIDA' && restante !== null && restante <= 0;
  }

  getManualTipoPayload(): TipoMovimiento {
    return this.form.tipo === 'AJUSTE' ? this.form.ajuste_tipo : this.form.tipo;
  }
}

type MovimientoView = {
  id?: string;
  tipo: TipoMovimiento;
  ajuste_tipo?: 'ENTRADA' | 'SALIDA' | null;
  producto: string;
  cantidad: number;
  fecha: string | Date;
  motivo?: string | null;
};
