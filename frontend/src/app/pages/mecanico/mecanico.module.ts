import { NgModule } from '@angular/core';
import { MecanicoPageRoutingModule } from './mecanico-routing.module';
import { MecanicoTabsPage } from './mecanico-tabs.page';
import { MecanicoPage } from './mecanico.page';
import { MecanicoTareasPage } from './mecanico-tareas.page';
import { MecanicoContactoPage } from './mecanico-contacto.page';
import { MecanicoAgendaPage } from './mecanico-agenda.page';
import { MecanicoPerfilPage } from './mecanico-perfil.page';
import { SharedModule } from '../../shared/shared.module';

@NgModule({
  imports: [SharedModule, MecanicoPageRoutingModule],
  declarations: [
    MecanicoTabsPage,
    MecanicoPage,
    MecanicoTareasPage,
    MecanicoContactoPage,
    MecanicoAgendaPage,
    MecanicoPerfilPage,
  ],
})
export class MecanicoPageModule {}
