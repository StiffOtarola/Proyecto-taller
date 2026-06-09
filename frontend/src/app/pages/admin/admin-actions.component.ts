import { Component } from '@angular/core';

// Acciones del encabezado del panel admin (lado derecho del topbar):
// badge con la fecha de hoy + botón "Nueva cita". Se coloca con slot="end".
@Component({
  standalone: false,
  selector: 'app-admin-actions',
  template: `
    <span class="adm-date">{{ fecha }}</span>
    <ion-button class="adm-nueva" size="small" [routerLink]="['/cita-form']">+ Nueva cita</ion-button>
  `,
})
export class AdminActionsComponent {
  fecha = this.hoyStr();

  private hoyStr(): string {
    const d = new Date();
    const dows = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
    const meses = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
    return `${dows[d.getDay()]} ${d.getDate()} ${meses[d.getMonth()]} ${d.getFullYear()}`;
  }
}
