import { NgModule } from '@angular/core';
import { CitaFormPageRoutingModule } from './cita-form-routing.module';
import { CitaFormPage } from './cita-form.page';
import { SharedModule } from '../../shared/shared.module';

@NgModule({
  imports: [SharedModule, CitaFormPageRoutingModule],
  declarations: [CitaFormPage],
})
export class CitaFormPageModule {}
