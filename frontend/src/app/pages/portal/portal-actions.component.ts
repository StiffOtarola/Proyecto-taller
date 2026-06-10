import { Component } from '@angular/core';

// Acceso a "Mi Perfil" desde el encabezado de cada pantalla del portal.
// Se coloca con slot="end" en el toolbar (fuera de la barra de pestañas).
@Component({
  standalone: false,
  selector: 'app-portal-actions',
  template: `
    <ion-buttons>
      <ion-button [routerLink]="['/portal/perfil']" title="Mi perfil">
        <ion-icon slot="icon-only" name="person-circle-outline"></ion-icon>
      </ion-button>
    </ion-buttons>
  `,
})
export class PortalActionsComponent {}
