import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { DetalleOrdenPage } from './detalle-orden.page';

const routes: Routes = [
  {
    path: '',
    component: DetalleOrdenPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class DetalleOrdenPageRoutingModule {}
