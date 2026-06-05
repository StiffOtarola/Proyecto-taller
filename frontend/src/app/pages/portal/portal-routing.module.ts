import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { PortalGuard } from '../../guards/portal.guard';
import { PortalLoginPage } from './portal-login.page';
import { PortalRegistroPage } from './portal-registro.page';
import { PortalRecuperarPage } from './portal-recuperar.page';
import { PortalOrdenesPage } from './portal-ordenes.page';
import { PortalOrdenPage } from './portal-orden.page';
import { PortalCitasPage } from './portal-citas.page';

const routes: Routes = [
  { path: 'login', component: PortalLoginPage },
  { path: 'registro', component: PortalRegistroPage },
  { path: 'recuperar', component: PortalRecuperarPage },
  { path: '', component: PortalOrdenesPage, canActivate: [PortalGuard] },
  { path: 'orden/:id', component: PortalOrdenPage, canActivate: [PortalGuard] },
  { path: 'citas', component: PortalCitasPage, canActivate: [PortalGuard] },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class PortalPageRoutingModule {}
