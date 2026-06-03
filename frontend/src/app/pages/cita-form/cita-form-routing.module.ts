import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { CitaFormPage } from './cita-form.page';

const routes: Routes = [
  {
    path: '',
    component: CitaFormPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class CitaFormPageRoutingModule {}
