import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { MecanicoPage } from './mecanico.page';
import { MecanicoAgendaPage } from './mecanico-agenda.page';

const routes: Routes = [
  { path: '', component: MecanicoPage },
  { path: 'agenda', component: MecanicoAgendaPage },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class MecanicoPageRoutingModule {}
