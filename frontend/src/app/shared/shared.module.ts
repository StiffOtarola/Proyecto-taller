import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { EstadoLabelPipe, EstadoColorPipe } from './estado.pipe';

@NgModule({
  declarations: [EstadoLabelPipe, EstadoColorPipe],
  imports: [CommonModule, FormsModule, IonicModule],
  exports: [CommonModule, FormsModule, IonicModule, EstadoLabelPipe, EstadoColorPipe],
})
export class SharedModule {}
