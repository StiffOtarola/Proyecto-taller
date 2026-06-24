import { Component, OnInit, OnDestroy } from '@angular/core';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { PortalService } from '../../services/portal.service';

@Component({
  standalone: false,
  selector: 'app-portal-ofertas',
  templateUrl: './portal-ofertas.page.html',
  styleUrls: ['./portal-ofertas.page.scss'],
})
export class PortalOfertasPage implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  promos: any[] = [];
  fidelidad: { visitas: number; cortesia_disponible: boolean; meta: number; faltan: number } | null = null;
  recompensas: { id: number; fecha: string; descripcion: string; numero_orden: string | null }[] = [];
  histAbierto = false;
  cargando = true;
  abierta = new Set<number>();
  private readonly iconos = ['🛢️', '⛓️', '🔧', '🔋', '🛞', '⚙️'];

  // Bloques de progreso: meta-1 sellos + el último (cortesía/regalo).
  get bloques(): boolean[] {
    if (!this.fidelidad) return [];
    const meta = this.fidelidad.meta || 7;
    const ciclo = this.fidelidad.visitas % meta;
    return Array.from({ length: meta }, (_, i) => i < ciclo);
  }

  // Emoji decorativo para el placeholder cuando la oferta no trae imagen.
  phIcono(i: number): string { return this.iconos[i % this.iconos.length]; }

  constructor(private portal: PortalService) {}

  ngOnInit() { this.cargar(); }
  ionViewWillEnter() { this.cargar(); }

  cargar() {
    this.cargando = true;
    this.portal.getPromos().pipe(takeUntil(this.destroy$)).subscribe({
      next: r => { this.promos = r.data; this.cargando = false; },
      error: () => { this.cargando = false; },
    });
    this.portal.getFidelidad().pipe(takeUntil(this.destroy$)).subscribe({
      next: r => { this.fidelidad = r.data; },
      error: () => { this.fidelidad = null; },
    });
    this.portal.getRecompensas().pipe(takeUntil(this.destroy$)).subscribe({
      next: r => { this.recompensas = r.data; },
      error: () => { this.recompensas = []; },
    });
  }

  ngOnDestroy() { this.destroy$.next(); this.destroy$.complete(); }

  toggleHistorial() { this.histAbierto = !this.histAbierto; }

  toggle(id: number) {
    this.abierta.has(id) ? this.abierta.delete(id) : this.abierta.add(id);
  }
}
