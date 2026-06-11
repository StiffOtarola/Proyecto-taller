import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ToastController, AlertController } from '@ionic/angular';
import { PortalService } from '../../services/portal.service';
import { FLUJO_CITA, ESTADO_CITA_LABEL } from '../../utils/servicios';

@Component({
  standalone: false,
  selector: 'app-portal-cita-detalle',
  templateUrl: './portal-cita-detalle.page.html',
  styleUrls: ['./portal-cita-detalle.page.scss'],
})
export class PortalCitaDetallePage implements OnInit {
  cita: any = null;
  orden: any = null;        // detalle de la orden vinculada (si hay)
  cargando = true;

  readonly flujo = FLUJO_CITA;
  readonly estadoLabel = ESTADO_CITA_LABEL;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private portal: PortalService,
    private toast: ToastController,
    private alert: AlertController,
  ) {}

  // El presupuesto se aprueba/rechaza en Inicio (donde está ese flujo).
  irAInicio() { this.router.navigate(['/portal/inicio']); }

  ngOnInit() {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    if (id) this.cargar(id);
  }

  cargar(id: number) {
    this.cargando = true;
    this.portal.getCita(id).subscribe({
      next: r => {
        this.cita = r.data;
        this.cargando = false;
        if (this.cita?.orden_id) {
          this.portal.getOrden(this.cita.orden_id).subscribe({ next: o => this.orden = o.data, error: () => {} });
        }
      },
      error: () => { this.cargando = false; },
    });
  }

  progresoPct(estado: string): number {
    const i = this.flujo.indexOf(estado);
    if (i < 0) return 0;
    return Math.round((i / (this.flujo.length - 1)) * 100);
  }

  // Total: el de la orden vinculada si existe; si no, el monto de la cita.
  get total(): number {
    if (this.orden) return Number(this.orden.total || 0);
    return Number(this.cita?.monto || 0);
  }

  estrellas(n: number): string { return '★'.repeat(n) + '☆'.repeat(5 - n); }

  // El cliente puede cancelar/editar solo mientras la cita sigue 'agendado' (sin orden).
  // La ventana mínima de horas la valida el backend (mensaje claro si es muy tarde).
  get puedeCancelar(): boolean {
    return this.cita?.estado === 'agendado' && !this.cita?.orden_id;
  }

  editar() { this.router.navigate(['/portal/cita', this.cita.id, 'editar']); }

  async cancelar() {
    const al = await this.alert.create({
      header: 'Cancelar cita',
      message: 'Esta acción no se puede deshacer. ¿Querés cancelar esta cita?',
      buttons: [
        { text: 'No', role: 'cancel' },
        { text: 'Sí, cancelar', role: 'destructive', handler: () => this.confirmarCancelar() },
      ],
    });
    await al.present();
  }

  private confirmarCancelar() {
    this.portal.cancelarCita(this.cita.id).subscribe({
      next: async () => {
        this.cita.estado = 'cancelado';
        const t = await this.toast.create({ message: 'Cita cancelada', duration: 2000, color: 'medium' });
        await t.present();
      },
      error: async (e) => {
        const t = await this.toast.create({ message: e.error?.error || 'No se pudo cancelar', duration: 2400, color: 'danger' });
        await t.present();
      },
    });
  }

  async calificar() {
    const al = await this.alert.create({
      header: '¿Cómo fue el servicio?',
      inputs: [1, 2, 3, 4, 5].map(n => ({ type: 'radio' as const, label: '★'.repeat(n) + ` (${n})`, value: n })),
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        { text: 'Enviar', handler: (n) => this.enviarCalif(n) },
      ],
    });
    await al.present();
  }

  private enviarCalif(n: number) {
    if (!n) return;
    this.portal.calificarCita(this.cita.id, n).subscribe({
      next: async () => {
        this.cita.calificacion = n;
        const t = await this.toast.create({ message: '¡Gracias por tu opinión!', duration: 2000, color: 'success' });
        await t.present();
      },
      error: async (err) => {
        const t = await this.toast.create({ message: err.error?.error || 'No se pudo calificar', duration: 2200, color: 'danger' });
        await t.present();
      },
    });
  }
}
