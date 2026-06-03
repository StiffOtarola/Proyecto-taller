import { NgModule } from '@angular/core';
import { OrdenesPageRoutingModule } from './ordenes-routing.module';
import { OrdenesPage } from './ordenes.page';
import { SharedModule } from '../../shared/shared.module';

@NgModule({
  imports: [SharedModule, OrdenesPageRoutingModule],
  declarations: [OrdenesPage],
})
export class OrdenesPageModule {}
