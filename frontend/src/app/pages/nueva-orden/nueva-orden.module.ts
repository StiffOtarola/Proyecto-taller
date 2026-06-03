import { NgModule } from '@angular/core';
import { NuevaOrdenPageRoutingModule } from './nueva-orden-routing.module';
import { NuevaOrdenPage } from './nueva-orden.page';
import { SharedModule } from '../../shared/shared.module';

@NgModule({
  imports: [SharedModule, NuevaOrdenPageRoutingModule],
  declarations: [NuevaOrdenPage],
})
export class NuevaOrdenPageModule {}
