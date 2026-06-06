import { NgModule } from '@angular/core';
import { RecepcionPageRoutingModule } from './recepcion-routing.module';
import { RecepcionTabsPage } from './recepcion-tabs.page';
import { RecepcionPage } from './recepcion.page';
import { RecepcionOrdenesPage } from './recepcion-ordenes.page';
import { RecepcionCotizPage } from './recepcion-cotiz.page';
import { RecepcionMensajesPage } from './recepcion-mensajes.page';
import { RecepcionClientesPage } from './recepcion-clientes.page';
import { SharedModule } from '../../shared/shared.module';

@NgModule({
  imports: [SharedModule, RecepcionPageRoutingModule],
  declarations: [
    RecepcionTabsPage,
    RecepcionPage,
    RecepcionOrdenesPage,
    RecepcionCotizPage,
    RecepcionMensajesPage,
    RecepcionClientesPage,
  ],
})
export class RecepcionPageModule {}
