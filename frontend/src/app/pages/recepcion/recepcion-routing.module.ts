import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { RecepcionTabsPage } from './recepcion-tabs.page';
import { RecepcionPage } from './recepcion.page';
import { RecepcionAgendarPage } from './recepcion-agendar.page';
import { RecepcionWalkinPage } from './recepcion-walkin.page';
import { RecepcionOrdenesPage } from './recepcion-ordenes.page';
import { RecepcionCotizPage } from './recepcion-cotiz.page';
import { RecepcionMensajesPage } from './recepcion-mensajes.page';
import { RecepcionClientesPage } from './recepcion-clientes.page';
import { RecepcionPerfilPage } from './recepcion-perfil.page';

const routes: Routes = [
  {
    path: '',
    component: RecepcionTabsPage,
    children: [
      { path: '', redirectTo: 'inicio', pathMatch: 'full' },
      { path: 'inicio', component: RecepcionPage },
      { path: 'agendar', component: RecepcionAgendarPage },
      { path: 'walkin', component: RecepcionWalkinPage },
      { path: 'ordenes', component: RecepcionOrdenesPage },
      { path: 'cotizaciones', component: RecepcionCotizPage },
      { path: 'mensajes', component: RecepcionMensajesPage },
      { path: 'clientes', component: RecepcionClientesPage },
      { path: 'perfil', component: RecepcionPerfilPage },
    ],
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class RecepcionPageRoutingModule {}
