import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { PortalGuard } from '../../guards/portal.guard';
import { PortalLoginPage } from './portal-login.page';
import { PortalOrdenesPage } from './portal-ordenes.page';
import { PortalOrdenPage } from './portal-orden.page';

const routes: Routes = [
  { path: 'login', component: PortalLoginPage },
  { path: '', component: PortalOrdenesPage, canActivate: [PortalGuard] },
  { path: 'orden/:id', component: PortalOrdenPage, canActivate: [PortalGuard] },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class PortalPageRoutingModule {}
