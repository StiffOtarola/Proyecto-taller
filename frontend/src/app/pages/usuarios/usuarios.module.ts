import { NgModule } from '@angular/core';
import { UsuariosPageRoutingModule } from './usuarios-routing.module';
import { UsuariosPage } from './usuarios.page';
import { SharedModule } from '../../shared/shared.module';

@NgModule({
  imports: [SharedModule, UsuariosPageRoutingModule],
  declarations: [UsuariosPage],
})
export class UsuariosPageModule {}
