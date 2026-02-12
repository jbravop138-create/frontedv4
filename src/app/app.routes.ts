import { Routes } from '@angular/router';
import { roleGuard } from './core/auth/role.guard';
import { LayoutComponent } from './core/ui/layout/layout.component';
import { LoginComponent } from './features/auth/login/login.component';
import { AdminDashboardComponent } from './features/admin/dashboard/admin-dashboard.component';
import { UserDashboardComponent } from './features/user/dashboard/user-dashboard.component';
import { InventoryComponent } from './features/inventario/pages/inventario/inventario.component';
import { MovimientosComponent } from './features/movimientos/movimientos.component';
import { CategoriasComponent } from './features/categorias/categorias.component';
import { UsuariosComponent } from './features/usuarios/usuarios.component';
import { HistoryComponent } from './features/movimientos/historial/historial.component';


export const routes: Routes = [
  { path: 'login', component: LoginComponent },
  {
    path: 'admin',
    component: LayoutComponent,
    canActivate: [roleGuard(['admin'])],
    children: [
      { path: '', component: AdminDashboardComponent },
      { path: 'inventario', redirectTo: '', pathMatch: 'full' },
      { path: 'movimientos', redirectTo: '', pathMatch: 'full' },
      { path: 'productos', redirectTo: '', pathMatch: 'full' },
      { path: 'categorias', component: CategoriasComponent },
      { path: 'usuarios', component: UsuariosComponent },
      {path: 'historial', component: HistoryComponent},
    ],
  },

  {
    path: 'user',
    component: LayoutComponent,
    canActivate: [roleGuard(['user'])],
    children: [
      { path: '', component: UserDashboardComponent },
      { path: 'inventario', component: InventoryComponent },
      { path: 'movimientos', component: MovimientosComponent }, // ✅ NUEVO
    ],
  },

  { path: '', redirectTo: 'login', pathMatch: 'full' },

  { path: '**', redirectTo: 'login' },
];
