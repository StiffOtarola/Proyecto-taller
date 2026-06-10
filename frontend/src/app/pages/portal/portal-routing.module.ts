import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { PortalGuard } from '../../guards/portal.guard';
import { PortalLoginPage } from './portal-login.page';
import { PortalRegistroPage } from './portal-registro.page';
import { PortalRecuperarPage } from './portal-recuperar.page';
import { PortalTabsPage } from './portal-tabs.page';
import { PortalInicioPage } from './portal-inicio.page';
import { PortalAgendarPage } from './portal-agendar.page';
import { PortalCitasPage } from './portal-citas.page';
import { PortalMotosPage } from './portal-motos.page';
import { PortalOfertasPage } from './portal-ofertas.page';
import { PortalPerfilPage } from './portal-perfil.page';

const routes: Routes = [
  { path: 'login', component: PortalLoginPage },
  { path: 'registro', component: PortalRegistroPage },
  { path: 'recuperar', component: PortalRecuperarPage },
  {
    path: '',
    component: PortalTabsPage,
    canActivate: [PortalGuard],
    children: [
      { path: '', redirectTo: 'inicio', pathMatch: 'full' },
      { path: 'inicio', component: PortalInicioPage },
      { path: 'agendar', component: PortalAgendarPage },
      { path: 'mis-citas', component: PortalCitasPage },
      { path: 'motos', component: PortalMotosPage },
      { path: 'perfil', component: PortalPerfilPage },
      { path: 'ofertas', component: PortalOfertasPage },
    ],
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class PortalPageRoutingModule {}
