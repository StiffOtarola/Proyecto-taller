import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { PortalService } from '../../services/portal.service';

@Component({
  standalone: false,
  selector: 'app-portal-ordenes',
  templateUrl: './portal-ordenes.page.html',
  styleUrls: ['./portal-ordenes.page.scss'],
})
export class PortalOrdenesPage implements OnInit {
  ordenes: any[] = [];
  promos: any[] = [];
  fidelidad: { visitas: number; cortesia_disponible: boolean; meta: number; faltan: number } | null = null;
  cargando = true;

  constructor(public portal: PortalService, private router: Router) {}

  ngOnInit() { this.cargar(); }
  ionViewWillEnter() { this.cargar(); }

  cargar() {
    this.cargando = true;
    this.portal.getOrdenes().subscribe({
      next: res => { this.ordenes = res.data; this.cargando = false; },
      error: () => { this.cargando = false; },
    });
    this.portal.getPromos().subscribe(res => this.promos = res.data);
    this.portal.getFidelidad().subscribe(res => this.fidelidad = res.data);
  }

  get progresoFidelidad(): number {
    if (!this.fidelidad) return 0;
    if (this.fidelidad.cortesia_disponible) return 1;
    const hechas = this.fidelidad.meta - this.fidelidad.faltan;
    return hechas / this.fidelidad.meta;
  }

  // Bloques segmentados de la barra de fidelidad (estilo del export)
  get bloques(): boolean[] {
    if (!this.fidelidad) return [];
    const total = this.fidelidad.meta || 0;
    const hechas = this.fidelidad.cortesia_disponible ? total : (total - this.fidelidad.faltan);
    return Array.from({ length: total }, (_, i) => i < hechas);
  }

  // ¿La orden requiere aprobación del cliente?
  requiereAprobacion(o: any): boolean {
    return o.estado === 'esperando_aprobacion' && o.aprobacion_cliente === 'pendiente';
  }

  abrir(id: number) { this.router.navigate(['/portal/orden', id]); }

  logout() {
    this.portal.logout();
    this.router.navigate(['/portal/login'], { replaceUrl: true });
  }
}
