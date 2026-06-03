import { NgModule } from '@angular/core';
import { DetalleOrdenPageRoutingModule } from './detalle-orden-routing.module';
import { DetalleOrdenPage } from './detalle-orden.page';
import { SharedModule } from '../../shared/shared.module';

@NgModule({
  imports: [SharedModule, DetalleOrdenPageRoutingModule],
  declarations: [DetalleOrdenPage],
})
export class DetalleOrdenPageModule {}
