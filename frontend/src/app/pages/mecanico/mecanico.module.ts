import { NgModule } from '@angular/core';
import { MecanicoPageRoutingModule } from './mecanico-routing.module';
import { MecanicoPage } from './mecanico.page';
import { MecanicoAgendaPage } from './mecanico-agenda.page';
import { SharedModule } from '../../shared/shared.module';

@NgModule({
  imports: [SharedModule, MecanicoPageRoutingModule],
  declarations: [MecanicoPage, MecanicoAgendaPage],
})
export class MecanicoPageModule {}
