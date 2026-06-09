import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { MecanicoTabsPage } from './mecanico-tabs.page';
import { MecanicoPage } from './mecanico.page';
import { MecanicoHistorialPage } from './mecanico-historial.page';
import { MecanicoTareasPage } from './mecanico-tareas.page';
import { MecanicoContactoPage } from './mecanico-contacto.page';
import { MecanicoAgendaPage } from './mecanico-agenda.page';
import { MecanicoPerfilPage } from './mecanico-perfil.page';

const routes: Routes = [
  {
    path: '',
    component: MecanicoTabsPage,
    children: [
      { path: '', redirectTo: 'inicio', pathMatch: 'full' },
      { path: 'inicio', component: MecanicoPage },
      { path: 'historial', component: MecanicoHistorialPage },
      { path: 'tareas', component: MecanicoTareasPage },
      { path: 'contacto', component: MecanicoContactoPage },
      { path: 'agenda', component: MecanicoAgendaPage },
      { path: 'perfil', component: MecanicoPerfilPage },
    ],
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class MecanicoPageRoutingModule {}
