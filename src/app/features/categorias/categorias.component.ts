import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CategoriasApiService, Categoria } from './categorias.api.service';

@Component({
  standalone: true,
  selector: 'app-categorias',
  imports: [CommonModule, FormsModule],
  templateUrl: './categorias.component.html',
  styleUrl: './categorias.component.scss',
})
export class CategoriasComponent {
  loading = signal(false);
  error = signal<string | null>(null);

  categorias = signal<Categoria[]>([]);

  // Panel inline “CREAR NODO”
  creating = signal(false);
  nombreNuevo = signal('');
  descripcionNueva = signal('');

  // Si luego quieres “editar”, lo dejamos preparado sin estorbar el flujo
  editingId = signal<string | null>(null);

  constructor(private api: CategoriasApiService) {
    this.load();
  }

  trackById = (_: number, item: Categoria) => item.id;

  load() {
    this.loading.set(true);
    this.error.set(null);

    this.api.list().subscribe({
      next: (res) => this.categorias.set(res ?? []),
      error: () => this.error.set('No se pudo cargar categorías'),
      complete: () => this.loading.set(false),
    });
  }

  // UI actions
  openCreate() {
    this.error.set(null);
    this.editingId.set(null);
    this.creating.set(true);
    this.nombreNuevo.set('');
    this.descripcionNueva.set('');
  }

  cancelCreate() {
    this.creating.set(false);
    this.nombreNuevo.set('');
    this.descripcionNueva.set('');
    this.error.set(null);
  }

  create() {
    this.error.set(null);
    const nombre = this.nombreNuevo().trim();
    const descripcion = this.descripcionNueva().trim();

    if (!nombre) {
      this.error.set('El nombre es obligatorio');
      return;
    }

    this.loading.set(true);

    this.api
      .create({ nombre, descripcion: descripcion ? descripcion : undefined })
      .subscribe({
        next: () => {
          this.cancelCreate();
          this.load();
        },
        error: () => {
          this.error.set('Error guardando categoría');
          this.loading.set(false);
        },
        complete: () => this.loading.set(false),
      });
  }

  // Opcional: Editar (si lo quieres mantener)
  startEdit(cat: Categoria) {
    this.error.set(null);
    this.creating.set(false);
    this.editingId.set(cat.id);
    this.nombreNuevo.set(cat.nombre);
    this.descripcionNueva.set(cat.descripcion ?? '');
  }

  saveEdit() {
    const id = this.editingId();
    if (!id) return;

    this.error.set(null);
    const nombre = this.nombreNuevo().trim();
    const descripcion = this.descripcionNueva().trim();

    if (!nombre) {
      this.error.set('El nombre es obligatorio');
      return;
    }

    this.loading.set(true);

    this.api
      .update(id, { nombre, descripcion: descripcion ? descripcion : undefined })
      .subscribe({
        next: () => {
          this.editingId.set(null);
          this.nombreNuevo.set('');
          this.descripcionNueva.set('');
          this.load();
        },
        error: () => {
          this.error.set('No se pudo actualizar la categoría');
          this.loading.set(false);
        },
        complete: () => this.loading.set(false),
      });
  }

  cancelEdit() {
    this.editingId.set(null);
    this.nombreNuevo.set('');
    this.descripcionNueva.set('');
    this.error.set(null);
  }

  remove(id: string) {
    this.error.set(null);
    if (!confirm('¿Eliminar esta categoría?')) return;

    this.loading.set(true);

    this.api.delete(id).subscribe({
      next: () => this.load(),
      error: () => {
        this.error.set('No se pudo eliminar');
        this.loading.set(false);
      },
      complete: () => this.loading.set(false),
    });
  }
}