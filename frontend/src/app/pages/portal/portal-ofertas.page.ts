import { Component, OnInit } from '@angular/core';
import { PortalService } from '../../services/portal.service';

@Component({
  standalone: false,
  selector: 'app-portal-ofertas',
  templateUrl: './portal-ofertas.page.html',
  styleUrls: ['./portal-ofertas.page.scss'],
})
export class PortalOfertasPage implements OnInit {
  promos: any[] = [];
  cargando = true;
  abierta = new Set<number>();
  private readonly iconos = ['🛢️', '⛓️', '🔧', '🔋', '🛞', '⚙️'];

  // Emoji decorativo para el placeholder cuando la oferta no trae imagen.
  phIcono(i: number): string { return this.iconos[i % this.iconos.length]; }

  constructor(private portal: PortalService) {}

  ngOnInit() { this.cargar(); }
  ionViewWillEnter() { this.cargar(); }

  cargar() {
    this.cargando = true;
    this.portal.getPromos().subscribe({
      next: r => { this.promos = r.data; this.cargando = false; },
      error: () => { this.cargando = false; },
    });
  }

  toggle(id: number) {
    this.abierta.has(id) ? this.abierta.delete(id) : this.abierta.add(id);
  }
}
