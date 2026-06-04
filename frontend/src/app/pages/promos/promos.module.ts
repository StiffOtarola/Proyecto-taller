import { NgModule } from '@angular/core';
import { PromosPageRoutingModule } from './promos-routing.module';
import { PromosPage } from './promos.page';
import { SharedModule } from '../../shared/shared.module';

@NgModule({
  imports: [SharedModule, PromosPageRoutingModule],
  declarations: [PromosPage],
})
export class PromosPageModule {}
