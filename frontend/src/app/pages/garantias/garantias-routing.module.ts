import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { GarantiasPage } from './garantias.page';

const routes: Routes = [
  {
    path: '',
    component: GarantiasPage,
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class GarantiasPageRoutingModule {}
