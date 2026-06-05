import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { PortalService } from '../../services/portal.service';
import { ESTADO_CITA_LABEL } from '../../utils/servicios';

@Component({
  standalone: false,
  selector: 'app-portal-inicio',
  templateUrl: './portal-inicio.page.html',
  styleUrls: ['./portal-inicio.page.scss'],
})
export class PortalInicioPage implements OnInit {
  resumen: any = null;
  notificaciones: any[] = [];
  cargando = true;
  readonly estadoLabel = ESTADO_CITA_LABEL;

  constructor(public portal: PortalService, private router: Router) {}

  ngOnInit() { this.cargar(); }
  ionViewWillEnter() { this.cargar(); }

  cargar() {
    this.cargando = true;
    this.portal.getResumen().subscribe({
      next: r => { this.resumen = r.data; this.cargando = false; },
      error: () => { this.cargando = false; },
    });
    this.portal.getNotificaciones().subscribe({
      next: r => {
        this.notificaciones = r.data;
        if (r.data.some(n => !n.leida)) this.portal.leerNotificaciones().subscribe();
      },
    });
  }

  // Bloques de recompensa: 6 normales + 1 cortesía (la 7ª).
  get bloques(): boolean[] {
    const ciclo = this.resumen?.recompensas?.ciclo ?? 0;
    return Array.from({ length: this.resumen?.recompensas?.meta || 7 }, (_, i) => i < ciclo);
  }

  irAgendar() { this.router.navigate(['/portal/agendar']); }
  irCitas() { this.router.navigate(['/portal/mis-citas']); }

  logout() {
    this.portal.logout();
    this.router.navigate(['/portal/login'], { replaceUrl: true });
  }
}
