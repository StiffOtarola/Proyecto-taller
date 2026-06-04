import { NgModule } from '@angular/core';
import { PortalPageRoutingModule } from './portal-routing.module';
import { PortalLoginPage } from './portal-login.page';
import { PortalOrdenesPage } from './portal-ordenes.page';
import { PortalOrdenPage } from './portal-orden.page';
import { PortalCitasPage } from './portal-citas.page';
import { SharedModule } from '../../shared/shared.module';

@NgModule({
  imports: [SharedModule, PortalPageRoutingModule],
  declarations: [PortalLoginPage, PortalOrdenesPage, PortalOrdenPage, PortalCitasPage],
})
export class PortalPageModule {}
