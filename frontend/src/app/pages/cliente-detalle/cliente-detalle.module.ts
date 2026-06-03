import { NgModule } from '@angular/core';
import { ClienteDetallePageRoutingModule } from './cliente-detalle-routing.module';
import { ClienteDetallePage } from './cliente-detalle.page';
import { SharedModule } from '../../shared/shared.module';

@NgModule({
  imports: [SharedModule, ClienteDetallePageRoutingModule],
  declarations: [ClienteDetallePage],
})
export class ClienteDetallePageModule {}
