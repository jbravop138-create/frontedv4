import { Component, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AuthService, Role } from '../../auth/auth.service';

type NavItem = {
  label: string;
  icon: string;
  path: string;
  roles: Role[];
};

@Component({
  standalone: true,
  selector: 'app-sidebar',
  imports: [CommonModule, RouterLink],
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.scss',
})
export class SidebarComponent {
  collapsed = signal(false);

  constructor(public auth: AuthService) {}

  private items: NavItem[] = [
    { label: 'Panel Principal', icon: '▣', path: '', roles: ['admin', 'user'] },

    { label: 'Inventario', icon: '≋', path: 'inventario', roles: ['user'] },

    // ADMIN
    { label: 'Historial', icon: '⟲', path: 'historial', roles: ['admin'] },
    { label: 'Categorías', icon: '☷', path: 'categorias', roles: ['admin'] },
    { label: 'Usuarios', icon: '☺', path: 'usuarios', roles: ['admin'] },

    // USER
    { label: 'Movimientos', icon: '⇅', path: 'movimientos', roles: ['user'] },
  ];

  role = computed(() => this.auth.role());

  basePath = computed(() => (this.role() === 'admin' ? '/admin' : '/user'));

  nav = computed(() => {
    const role = this.role();
    if (!role) return [];
    return this.items
      .filter((i) => i.roles.includes(role))
      .map((i) => ({
        ...i,
        fullPath: i.path ? `${this.basePath()}/${i.path}` : `${this.basePath()}`,
      }));
  });

  toggle() {
    this.collapsed.update((v) => !v);
  }

  logout() {
    this.auth.logout();
    location.href = '/login';
  }
}
