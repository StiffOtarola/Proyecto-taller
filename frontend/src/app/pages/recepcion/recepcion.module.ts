import { NgModule } from '@angular/core';
import { RecepcionPageRoutingModule } from './recepcion-routing.module';
import { RecepcionTabsPage } from './recepcion-tabs.page';
import { RecepcionPage } from './recepcion.page';
import { RecepcionAgendarPage } from './recepcion-agendar.page';
import { RecepcionWalkinPage } from './recepcion-walkin.page';
import { RecepcionOrdenesPage } from './recepcion-ordenes.page';
import { RecepcionCotizPage } from './recepcion-cotiz.page';
import { RecepcionMensajesPage } from './recepcion-mensajes.page';
import { RecepcionClientesPage } from './recepcion-clientes.page';
import { RecepcionPerfilPage } from './recepcion-perfil.page';
import { SharedModule } from '../../shared/shared.module';

@NgModule({
  imports: [SharedModule, RecepcionPageRoutingModule],
  declarations: [
    RecepcionTabsPage,
    RecepcionPage,
    RecepcionAgendarPage,
    RecepcionWalkinPage,
    RecepcionOrdenesPage,
    RecepcionCotizPage,
    RecepcionMensajesPage,
    RecepcionClientesPage,
    RecepcionPerfilPage,
  ],
})
export class RecepcionPageModule {}
