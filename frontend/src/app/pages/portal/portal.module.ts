import { NgModule } from '@angular/core';
import { PortalPageRoutingModule } from './portal-routing.module';
import { PortalLoginPage } from './portal-login.page';
import { PortalRegistroPage } from './portal-registro.page';
import { PortalRecuperarPage } from './portal-recuperar.page';
import { PortalTabsPage } from './portal-tabs.page';
import { PortalInicioPage } from './portal-inicio.page';
import { PortalAgendarPage } from './portal-agendar.page';
import { PortalCitasPage } from './portal-citas.page';
import { PortalMotosPage } from './portal-motos.page';
import { PortalOfertasPage } from './portal-ofertas.page';
import { SharedModule } from '../../shared/shared.module';

@NgModule({
  imports: [SharedModule, PortalPageRoutingModule],
  declarations: [
    PortalLoginPage, PortalRegistroPage, PortalRecuperarPage,
    PortalTabsPage, PortalInicioPage, PortalAgendarPage,
    PortalCitasPage, PortalMotosPage, PortalOfertasPage,
  ],
})
export class PortalPageModule {}
