import { Component, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { UsuariosApiService, Usuario, Rol } from './usuarios.api.service';

type ModalMode = 'create' | 'edit';

@Component({
  standalone: true,
  selector: 'app-usuarios',
  imports: [CommonModule, FormsModule],
  templateUrl: './usuarios.component.html',
  styleUrl: './usuarios.component.scss',
})
export class UsuariosComponent {
  loading = signal(false);
  error = signal<string | null>(null);

  search = signal('');
  usuarios = signal<Usuario[]>([]);
  deletedIds = signal<string[]>([]);

  modalOpen = signal(false);
  modalMode = signal<ModalMode>('create');
  confirmOpen = signal(false);
  confirmUser = signal<Usuario | null>(null);

  // Form modal
  form = signal({
    id: '',
    full_name: '',
    username: '',
    password: '',
    role: 'user' as Rol,
    is_active: true,
  });

  filtered = computed(() => {
    const q = this.search().trim().toLowerCase();
    if (!q) return this.usuarios();

    return this.usuarios().filter((u) => {
      const hay =
        `${u.full_name} ${u.username} ${u.role} ${u.email ?? ''}`.toLowerCase();
      return hay.includes(q);
    });
  });

  constructor(private api: UsuariosApiService) {
    this.load();
  }

  load() {
    this.error.set(null);
    this.loading.set(true);

    this.api.list().subscribe({
      next: (res) => {
        const hidden = new Set(this.deletedIds());
        this.usuarios.set((res ?? []).filter((u) => !hidden.has(u.id)));
      },
      error: (e: any) => this.error.set(e?.error?.message ?? 'No se pudo cargar usuarios'),
      complete: () => this.loading.set(false),
    });
  }

  openCreate() {
    this.modalMode.set('create');
    this.form.set({
      id: '',
      full_name: '',
      username: '',
      password: '',
      role: 'user',
      is_active: true,
    });
    this.error.set(null);
    this.modalOpen.set(true);
  }

  openEdit(u: Usuario) {
    this.modalMode.set('edit');
    this.form.set({
      id: u.id,
      full_name: u.full_name ?? '',
      username: u.username ?? '',
      password: '', // opcional: solo si quieres cambiar clave
      role: (u.role ?? 'user') as Rol,
      is_active: !!u.is_active,
    });
    this.error.set(null);
    this.modalOpen.set(true);
  }

  closeModal() {
    this.modalOpen.set(false);
    this.error.set(null);
  }

  openDelete(u: Usuario) {
    if (u.is_active) {
      this.error.set('Para eliminar definitivamente, primero desactiva el usuario.');
      return;
    }
    this.confirmUser.set(u);
    this.confirmOpen.set(true);
    this.error.set(null);
  }

  closeDelete() {
    this.confirmOpen.set(false);
    this.confirmUser.set(null);
  }

  updateForm(patch: Partial<ReturnType<typeof this.form>>) {
    this.form.update((current) => ({ ...current, ...patch }));
  }

  save() {
    this.error.set(null);
    const f = this.form();

    // Validaciones mínimas
    if (!f.full_name.trim()) return this.error.set('Nombre completo es obligatorio.');
    if (!f.username.trim()) return this.error.set('Username es obligatorio.');

    if (this.modalMode() === 'create') {
      if (!f.password || f.password.length < 6) {
        return this.error.set('Password mínimo 6 caracteres.');
      }

      this.loading.set(true);
      this.api
        .create({
          full_name: f.full_name.trim(),
          username: f.username.trim(),
          password: f.password,
          role: f.role,
        })
        .subscribe({
          next: () => {
            this.closeModal();
            this.load();
          },
          error: (e: any) => {
            this.error.set(e?.error?.message ?? 'No se pudo crear usuario.');
            this.loading.set(false);
          },
          complete: () => this.loading.set(false),
        });

      return;
    }

    // edit
    const payload: any = {
      full_name: f.full_name.trim(),
      username: f.username.trim(),
      role: f.role,
      is_active: f.is_active,
    };

    // Si pone password, lo enviamos; si no, no tocamos password
    if (f.password && f.password.length >= 6) payload.password = f.password;

    this.loading.set(true);
    this.api.update(f.id, payload).subscribe({
      next: () => {
        this.closeModal();
        this.load();
      },
      error: (e: any) => {
        this.error.set(e?.error?.message ?? 'No se pudo actualizar usuario.');
        this.loading.set(false);
      },
      complete: () => this.loading.set(false),
    });
  }

  toggleActive(u: Usuario) {
    this.loading.set(true);
    this.api.update(u.id, { is_active: !u.is_active }).subscribe({
      next: () => this.load(),
      error: (e: any) => {
        this.error.set(e?.error?.message ?? 'No se pudo cambiar el estado.');
        this.loading.set(false);
      },
      complete: () => this.loading.set(false),
    });
  }

  removeConfirmed() {
    const u = this.confirmUser();
    if (!u) return;

    this.loading.set(true);
    this.api.delete(u.id).subscribe({
      next: () => {
        this.closeDelete();
        this.deletedIds.update((ids) => [...ids, u.id]);
        this.usuarios.update((list) => list.filter((x) => x.id !== u.id));
      },
      error: (e: any) => {
        if (e?.status === 401) {
          this.error.set('Sesión expirada o sin permisos para eliminar.');
        } else {
          this.error.set(e?.error?.message ?? 'No se pudo eliminar.');
        }
        this.loading.set(false);
      },
      complete: () => this.loading.set(false),
    });
  }

  // util para iniciales
  initials(name: string) {
    const parts = (name ?? '').trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return '?';
    const a = parts[0]?.[0] ?? '';
    const b = parts[1]?.[0] ?? '';
    return (a + b).toUpperCase();
  }
}
