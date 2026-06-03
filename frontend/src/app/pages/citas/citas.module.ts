import { NgModule } from '@angular/core';
import { CitasPageRoutingModule } from './citas-routing.module';
import { CitasPage } from './citas.page';
import { SharedModule } from '../../shared/shared.module';

@NgModule({
  imports: [SharedModule, CitasPageRoutingModule],
  declarations: [CitasPage],
})
export class CitasPageModule {}
