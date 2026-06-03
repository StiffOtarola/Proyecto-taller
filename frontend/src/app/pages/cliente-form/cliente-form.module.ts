import { NgModule } from '@angular/core';
import { ClienteFormPageRoutingModule } from './cliente-form-routing.module';
import { ClienteFormPage } from './cliente-form.page';
import { SharedModule } from '../../shared/shared.module';

@NgModule({
  imports: [SharedModule, ClienteFormPageRoutingModule],
  declarations: [ClienteFormPage],
})
export class ClienteFormPageModule {}
