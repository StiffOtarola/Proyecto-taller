import { NgModule } from '@angular/core';
import { FacturaPageRoutingModule } from './factura-routing.module';
import { FacturaPage } from './factura.page';
import { SharedModule } from '../../shared/shared.module';

@NgModule({
  imports: [SharedModule, FacturaPageRoutingModule],
  declarations: [FacturaPage],
})
export class FacturaPageModule {}
