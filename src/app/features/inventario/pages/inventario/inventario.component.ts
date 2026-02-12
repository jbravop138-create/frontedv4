import { Component, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { InventoryService, InventarioItem } from '../services/inventario.service';
import { HttpErrorResponse } from '@angular/common/http';
import { CategoriasApiService, Categoria } from '../../../categorias/categorias.api.service'; 
import { finalize } from 'rxjs';

@Component({
  standalone: true,
  selector: 'app-inventory',
  imports: [CommonModule],
  templateUrl: './inventario.component.html',
  styleUrls: ['./inventario.component.scss'],
})
export class InventoryComponent {
  search = signal('');
  categoria = signal('all');
  stockFilter = signal<'all' | 'zero'>('all');

  loading = signal(true);
  error = signal<string | null>(null);

  items = signal<InventarioItem[]>([]);
  total = computed(() => this.items().length);
  visibleItems = computed(() => {
    const filter = this.stockFilter();
    const all = this.items();

    if (filter === 'zero') return all.filter((it) => it.stock_actual <= 0);
    return all;
  });
  visibleTotal = computed(() => this.visibleItems().length);
  zeroCount = computed(() => this.items().filter((it) => it.stock_actual <= 0).length);
  okCount = computed(() => Math.max(this.total() - this.zeroCount(), 0));
  okPercent = computed(() => this.percent(this.okCount(), this.total()));
  zeroPercent = computed(() => this.percent(this.zeroCount(), this.total()));
  categorias = signal<Categoria[]>([]);

  private searchTimer: ReturnType<typeof setTimeout> | null = null;
  readonly skeletonRows = Array.from({ length: 6 });

  constructor(
    private api: InventoryService,
    private categoriasApi: CategoriasApiService,
  ) {
    this.loadCategorias();
    this.load();
  }

  loadCategorias() {
    this.categoriasApi.list().subscribe({
      next: (cats) => this.categorias.set(cats ?? []),
      error: () => this.categorias.set([]),
    });
  }

  load() {
    this.loading.set(true);
    this.error.set(null);

    this.api
      .list(this.search(), this.categoria())
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (res: { items?: any[]; total?: number; data?: any } | null) => {
          const payload: any = res?.data ?? res ?? {};
          const raw =
            payload?.items ??
            payload?.data ??
            payload?.rows ??
            payload?.inventario ??
            [];

          const mapped: InventarioItem[] = raw.map((it: any) => {
            const stock_actual = this.toNumber(
              it.stock_actual ??
              it.stock ??
              it.productos?.stock_actual ??
              it.productos?.stock ??
              it.producto?.stock_actual ??
              it.producto?.stock ??
              0
            );

            const categoria_nombre =
              it.categoria_nombre ??
              it.categoria ??
              it.categorias?.nombre ??
              it.categoria?.nombre ??
              it.productos?.categoria_nombre ??
              it.productos?.categoria?.nombre ??
              'Sin categoría';

            const talla = it.talla ?? null;
            const color = it.color ?? null;

            return {
              producto_id: String(it.producto_id ?? it.id ?? ''),
              nombre: String(it.nombre ?? ''),
              talla,
              color,
              categoria_id: String(it.categoria_id ?? it.categoria?.id ?? it.productos?.categoria_id ?? ''),
              categoria_nombre: String(categoria_nombre),
              stock_actual,
              updated_at: it.updated_at ?? it.actualizado_at ?? null,
            };
          });

          this.items.set(mapped);
        },
        error: (e: unknown) => {
          const err = e as HttpErrorResponse;
          console.log('INVENTORY ERROR', err);
          const msg = err?.error?.message || 'No se pudo cargar inventario.';
          this.error.set(msg);
        },
      });
  }

  onSearch(v: string) {
    this.search.set(v ?? '');

    if (this.searchTimer) clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => this.load(), 350);
  }

  onCategoria(v: string) {
    this.categoria.set(v || 'all');
    this.load();
  }

  onStockFilter(v: 'all' | 'zero') {
    this.stockFilter.set(v);
  }

  clearFilters() {
    this.search.set('');
    this.categoria.set('all');
    this.stockFilter.set('all');
    this.load();
  }

  trackById(_: number, it: InventarioItem) {
    return it.producto_id;
  }

  private percent(part: number, total: number) {
    if (!total) return 0;
    return Math.round((part / total) * 100);
  }

  private toNumber(val: any) {
    if (typeof val === 'string') {
      const cleaned = val.replace(/,/g, '').trim();
      const n = Number(cleaned);
      return Number.isFinite(n) ? n : 0;
    }
    const n = Number(val);
    return Number.isFinite(n) ? n : 0;
  }
}
