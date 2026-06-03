import { NgModule } from '@angular/core';
import { ClientesPageRoutingModule } from './clientes-routing.module';
import { ClientesPage } from './clientes.page';
import { SharedModule } from '../../shared/shared.module';

@NgModule({
  imports: [SharedModule, ClientesPageRoutingModule],
  declarations: [ClientesPage],
})
export class ClientesPageModule {}
