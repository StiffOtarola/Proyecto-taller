import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { ToastController, AlertController } from '@ionic/angular';
import { PortalService } from '../../services/portal.service';
import { FLUJO_CITA, ESTADO_CITA_LABEL } from '../../utils/servicios';

@Component({
  standalone: false,
  selector: 'app-portal-citas',
  templateUrl: './portal-citas.page.html',
  styleUrls: ['./portal-citas.page.scss'],
})
export class PortalCitasPage implements OnInit {
  citas: any[] = [];
  cargando = true;
  vista: 'pendientes' | 'historial' = 'pendientes';
  reporteAbierto = new Set<number>();

  readonly flujo = FLUJO_CITA;
  readonly estadoLabel = ESTADO_CITA_LABEL;

  constructor(private portal: PortalService, private toast: ToastController, private alert: AlertController, private router: Router) {}

  ngOnInit() { this.cargar(); }
  ionViewWillEnter() { this.cargar(); }

  cargar() {
    this.cargando = true;
    this.portal.getCitas().subscribe({
      next: r => { this.citas = r.data; this.cargando = false; },
      error: () => { this.cargando = false; },
    });
  }

  get pendientes(): any[] {
    return this.citas.filter(c => !['entregado', 'cancelado'].includes(c.estado));
  }
  get historial(): any[] {
    return this.citas.filter(c => ['entregado', 'cancelado'].includes(c.estado));
  }
  get totalPagado(): number {
    return this.historial.filter(c => c.estado === 'entregado').reduce((s, c) => s + Number(c.monto || 0), 0);
  }

  // Índice del estado en el flujo (para la barra de progreso). -1 si cancelado.
  pasoActual(estado: string): number {
    return this.flujo.indexOf(estado);
  }
  progresoPct(estado: string): number {
    const i = this.pasoActual(estado);
    if (i < 0) return 0;
    return Math.round((i / (this.flujo.length - 1)) * 100);
  }

  toggleReporte(id: number) {
    this.reporteAbierto.has(id) ? this.reporteAbierto.delete(id) : this.reporteAbierto.add(id);
  }

  async calificar(cita: any) {
    const al = await this.alert.create({
      header: '¿Cómo fue el servicio?',
      inputs: [1, 2, 3, 4, 5].map(n => ({ type: 'radio' as const, label: '★'.repeat(n) + ` (${n})`, value: n })),
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        { text: 'Enviar', handler: (n) => this.enviarCalif(cita, n) },
      ],
    });
    await al.present();
  }

  private enviarCalif(cita: any, n: number) {
    if (!n) return;
    this.portal.calificarCita(cita.id, n).subscribe({
      next: async () => {
        cita.calificacion = n;
        const t = await this.toast.create({ message: '¡Gracias por tu opinión!', duration: 2000, color: 'success' });
        await t.present();
      },
      error: async (err) => {
        const t = await this.toast.create({ message: err.error?.error || 'No se pudo calificar', duration: 2200, color: 'danger' });
        await t.present();
      },
    });
  }

  estrellas(n: number): string { return '★'.repeat(n) + '☆'.repeat(5 - n); }

  // El presupuesto se aprueba en Inicio (donde está el flujo aprobar/rechazar).
  irAInicio() { this.router.navigate(['/portal/inicio']); }
}
