import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { NuevaOrdenPage } from './nueva-orden.page';

const routes: Routes = [
  {
    path: '',
    component: NuevaOrdenPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class NuevaOrdenPageRoutingModule {}
