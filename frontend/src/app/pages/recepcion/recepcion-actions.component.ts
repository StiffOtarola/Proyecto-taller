import { Component } from '@angular/core';

// Acciones del encabezado de recepción: accesos rápidos a Agendar y Perfil.
// Se coloca con slot="end" en el toolbar de cada pantalla.
@Component({
  standalone: false,
  selector: 'app-recepcion-actions',
  template: `
    <ion-buttons>
      <ion-button [routerLink]="['/recepcion/agendar']" title="Agendar cita">
        <ion-icon slot="icon-only" name="add-circle-outline"></ion-icon>
      </ion-button>
      <ion-button [routerLink]="['/recepcion/perfil']" title="Mi perfil">
        <ion-icon slot="icon-only" name="person-circle-outline"></ion-icon>
      </ion-button>
    </ion-buttons>
  `,
})
export class RecepcionActionsComponent {}
