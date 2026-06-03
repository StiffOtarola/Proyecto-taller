import { Pipe, PipeTransform } from '@angular/core';
import { ESTADO_CONFIG, EstadoOrden } from '../models/orden.model';

@Pipe({ name: 'estadoLabel', standalone: false })
export class EstadoLabelPipe implements PipeTransform {
  transform(estado: string | undefined): string {
    if (!estado) return '';
    return ESTADO_CONFIG[estado as EstadoOrden]?.label ?? estado;
  }
}

@Pipe({ name: 'estadoColor', standalone: false })
export class EstadoColorPipe implements PipeTransform {
  transform(estado: string | undefined): string {
    if (!estado) return 'medium';
    return ESTADO_CONFIG[estado as EstadoOrden]?.color ?? 'medium';
  }
}
