import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { PortalService } from '../../services/portal.service';

@Component({
  standalone: false,
  selector: 'app-portal-notificaciones',
  templateUrl: './portal-notificaciones.page.html',
  styleUrls: ['./portal-notificaciones.page.scss'],
})
export class PortalNotificacionesPage {
  notificaciones: any[] = [];
  cargando = true;

  constructor(private portal: PortalService, private router: Router) {}

  ionViewWillEnter() { this.cargar(); }

  cargar(ev?: any) {
    this.cargando = true;
    this.portal.getNotificaciones().subscribe({
      next: r => {
        this.notificaciones = r.data;
        this.cargando = false;
        if (ev) ev.target.complete();
        // Marca como leídas las nuevas (apenas el usuario abre el feed).
        if (r.data.some(n => !n.leida)) this.portal.leerNotificaciones().subscribe();
      },
      error: () => { this.cargando = false; if (ev) ev.target.complete(); },
    });
  }

  // Tiempo relativo legible ("Hace 2 h").
  hace(fecha: string): string {
    if (!fecha) return '';
    const min = Math.round((Date.now() - new Date(fecha).getTime()) / 60000);
    if (min < 1) return 'Recién';
    if (min < 60) return `Hace ${min} min`;
    const h = Math.round(min / 60);
    if (h < 24) return `Hace ${h} h`;
    return `Hace ${Math.round(h / 24)} d`;
  }

  // Al tocar una notificación: si está ligada a una cita, abre su detalle; si no, las citas.
  abrir(n: any) {
    if (n?.cita_id) this.router.navigate(['/portal/cita', n.cita_id]);
    else this.router.navigate(['/portal/mis-citas']);
  }
}
