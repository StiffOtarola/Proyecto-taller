import { Component } from '@angular/core';
import { PortalService } from '../../services/portal.service';

// Acceso a "Mi Perfil" desde el encabezado de cada pantalla del portal.
// Se coloca con slot="end" en el toolbar (fuera de la barra de pestañas).
// Muestra la foto de perfil del cliente si la tiene; si no, el ícono genérico.
@Component({
  standalone: false,
  selector: 'app-portal-actions',
  template: `
    <ion-buttons>
      <ion-button [routerLink]="['/portal/notificaciones']" title="Notificaciones" aria-label="Notificaciones">
        <ion-icon slot="icon-only" name="notifications-outline"></ion-icon>
      </ion-button>
      <ion-button [routerLink]="['/portal/perfil']" title="Mi perfil" aria-label="Mi perfil">
        <img *ngIf="(portal.cliente$ | async)?.foto as foto; else icono" class="hdr-avatar" [src]="foto" alt="Mi perfil">
        <ng-template #icono><ion-icon slot="icon-only" name="person-circle-outline"></ion-icon></ng-template>
      </ion-button>
    </ion-buttons>
  `,
  styles: [`
    .hdr-avatar { width: 30px; height: 30px; border-radius: 50%; object-fit: cover;
      border: 1.5px solid rgba(255, 255, 255, 0.3); }
  `],
})
export class PortalActionsComponent {
  constructor(public portal: PortalService) {}
}
