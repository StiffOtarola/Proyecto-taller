import { NgModule } from '@angular/core';
import { PreloadAllModules, RouterModule, Routes } from '@angular/router';
import { AuthGuard } from './guards/auth.guard';

const routes: Routes = [
  { path: '', redirectTo: 'tabs', pathMatch: 'full' },
  {
    path: 'login',
    loadChildren: () => import('./pages/login/login.module').then(m => m.LoginPageModule),
  },
  {
    path: 'portal',
    loadChildren: () => import('./pages/portal/portal.module').then(m => m.PortalPageModule),
  },
  {
    path: 'tabs',
    canActivate: [AuthGuard],
    loadChildren: () => import('./pages/tabs/tabs.module').then(m => m.TabsPageModule),
  },
  {
    path: 'nueva-orden',
    canActivate: [AuthGuard],
    loadChildren: () => import('./pages/nueva-orden/nueva-orden.module').then(m => m.NuevaOrdenPageModule),
  },
  {
    path: 'detalle-orden/:id',
    canActivate: [AuthGuard],
    loadChildren: () => import('./pages/detalle-orden/detalle-orden.module').then(m => m.DetalleOrdenPageModule),
  },
  {
    path: 'cliente-form',
    canActivate: [AuthGuard],
    loadChildren: () => import('./pages/cliente-form/cliente-form.module').then(m => m.ClienteFormPageModule),
  },
  {
    path: 'cliente-form/:id',
    canActivate: [AuthGuard],
    loadChildren: () => import('./pages/cliente-form/cliente-form.module').then(m => m.ClienteFormPageModule),
  },
  {
    path: 'cliente-detalle/:id',
    canActivate: [AuthGuard],
    loadChildren: () => import('./pages/cliente-detalle/cliente-detalle.module').then(m => m.ClienteDetallePageModule),
  },
  {
    path: 'moto-form',
    canActivate: [AuthGuard],
    loadChildren: () => import('./pages/moto-form/moto-form.module').then(m => m.MotoFormPageModule),
  },
  {
    path: 'moto-form/:id',
    canActivate: [AuthGuard],
    loadChildren: () => import('./pages/moto-form/moto-form.module').then(m => m.MotoFormPageModule),
  },
  {
    path: 'moto-historial/:id',
    canActivate: [AuthGuard],
    loadChildren: () => import('./pages/moto-historial/moto-historial.module').then(m => m.MotoHistorialPageModule),
  },
  {
    path: 'cita-form',
    canActivate: [AuthGuard],
    loadChildren: () => import('./pages/cita-form/cita-form.module').then(m => m.CitaFormPageModule),
  },
  {
    path: 'cita-form/:id',
    canActivate: [AuthGuard],
    loadChildren: () => import('./pages/cita-form/cita-form.module').then(m => m.CitaFormPageModule),
  },
  {
    path: 'usuarios',
    canActivate: [AuthGuard],
    loadChildren: () => import('./pages/usuarios/usuarios.module').then(m => m.UsuariosPageModule),
  },
  {
    path: 'garantias',
    canActivate: [AuthGuard],
    loadChildren: () => import('./pages/garantias/garantias.module').then(m => m.GarantiasPageModule),
  },
  {
    path: 'factura/:id',
    canActivate: [AuthGuard],
    loadChildren: () => import('./pages/factura/factura.module').then(m => m.FacturaPageModule),
  },
  {
    path: 'promociones',
    canActivate: [AuthGuard],
    loadChildren: () => import('./pages/promos/promos.module').then(m => m.PromosPageModule),
  },
];

@NgModule({
  imports: [RouterModule.forRoot(routes, { preloadingStrategy: PreloadAllModules })],
  exports: [RouterModule],
})
export class AppRoutingModule {}
