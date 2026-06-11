import { Component, NgZone } from '@angular/core';
import { AccesibilidadService } from './services/accesibilidad.service';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss'],
  standalone: false,
})
export class AppComponent {
  // Estado de conexión para el banner global "sin conexión".
  enLinea = typeof navigator !== 'undefined' ? navigator.onLine : true;

  // Inyectar AccesibilidadService aplica la preferencia de tamaño de texto al arrancar.
  constructor(private zone: NgZone, private _a11y: AccesibilidadService) {
    window.addEventListener('online', () => this.zone.run(() => (this.enLinea = true)));
    window.addEventListener('offline', () => this.zone.run(() => (this.enLinea = false)));
  }
}
