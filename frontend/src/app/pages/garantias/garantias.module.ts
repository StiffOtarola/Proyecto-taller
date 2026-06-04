import { NgModule } from '@angular/core';
import { GarantiasPageRoutingModule } from './garantias-routing.module';
import { GarantiasPage } from './garantias.page';
import { SharedModule } from '../../shared/shared.module';

@NgModule({
  imports: [SharedModule, GarantiasPageRoutingModule],
  declarations: [GarantiasPage],
})
export class GarantiasPageModule {}
