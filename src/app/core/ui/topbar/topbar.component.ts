import { Component, EventEmitter, Input, Output, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService, Role } from '../../auth/auth.service';

type NavItem = {
  label: string;
  icon: string;
  path: string;
  exact?: boolean;
  roles: Role[];
};

@Component({
  standalone: true,
  selector: 'app-topbar',
  imports: [CommonModule, RouterLink, RouterLinkActive],
  templateUrl: './topbar.component.html',
  styleUrl: './topbar.component.scss',
})
export class TopbarComponent {
  @Input() mobileOpen = false;

  @Output() toggleMobile = new EventEmitter<void>();
  @Output() closeMobile = new EventEmitter<void>();

  constructor(public auth: AuthService) {}

  private items: NavItem[] = [
    { label: 'Panel', icon: '▣', path: '', exact: true, roles: ['admin', 'user'] },
    { label: 'Inventario', icon: '≋', path: 'inventario', roles: ['user'] },
    { label: 'Historial', icon: '⟲', path: 'historial', roles: ['admin'] },
    { label: 'Categorías', icon: '☷', path: 'categorias', roles: ['admin'] },
    { label: 'Usuarios', icon: '☺', path: 'usuarios', roles: ['admin'] },
    { label: 'Movimientos', icon: '⇅', path: 'movimientos', roles: ['user'] },
  ];

  role = computed(() => this.auth.role());
  user = computed(() => this.auth.user());
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

  confirmLogoutOpen = signal(false);

  openLogout() {
    this.confirmLogoutOpen.set(true);
  }

  closeLogout() {
    this.confirmLogoutOpen.set(false);
  }

  logout() {
    this.auth.logout();
    location.href = '/login';
  }
}
