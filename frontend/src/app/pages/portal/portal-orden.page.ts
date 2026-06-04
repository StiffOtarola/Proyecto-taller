import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AlertController, LoadingController, ToastController } from '@ionic/angular';
import { PortalService } from '../../services/portal.service';
import { EstadoOrden, ESTADO_CONFIG } from '../../models/orden.model';

@Component({
  standalone: false,
  selector: 'app-portal-orden',
  templateUrl: './portal-orden.page.html',
  styleUrls: ['./portal-orden.page.scss'],
})
export class PortalOrdenPage implements OnInit {
  orden: any = null;
  cargando = true;

  // Etapas visibles en la línea de tiempo (excluye cancelada)
  readonly flujo: EstadoOrden[] = [
    'recepcion', 'diagnostico', 'esperando_aprobacion',
    'esperando_repuestos', 'en_reparacion', 'lista_entrega', 'entregada',
  ];

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private portal: PortalService,
    private alert: AlertController,
    private loading: LoadingController,
    private toast: ToastController
  ) {}

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) this.cargar(+id);
  }

  cargar(id: number) {
    this.cargando = true;
    this.portal.getOrden(id).subscribe({
      next: res => { this.orden = res.data; this.cargando = false; },
      error: () => { this.cargando = false; },
    });
  }

  // encuesta de satisfacción
  calificacionSel = 0;
  comentarioEncuesta = '';

  estadoLabel(e: string) { return ESTADO_CONFIG[e as EstadoOrden]?.label ?? e; }
  estadoColor(e: string) { return ESTADO_CONFIG[e as EstadoOrden]?.color ?? 'medium'; }

  get puedeCalificar(): boolean {
    return this.orden?.estado === 'entregada' && !this.orden?.calificacion;
  }

  enviarEncuesta() {
    if (!this.calificacionSel) return;
    this.portal.enviarEncuesta(this.orden.id, this.calificacionSel, this.comentarioEncuesta).subscribe({
      next: () => {
        this.orden.calificacion = this.calificacionSel;
        this.orden.comentario_satisfaccion = this.comentarioEncuesta;
        this.mostrarToast('¡Gracias por tu opinión!');
      },
      error: (err: any) => this.mostrarToast(err.error?.error || 'No se pudo enviar', 'danger'),
    });
  }

  // índice de la etapa actual dentro del flujo (para marcar completadas)
  get etapaActual(): number {
    return this.flujo.indexOf(this.orden?.estado);
  }

  get esperandoAprobacion(): boolean {
    return this.orden?.estado === 'esperando_aprobacion' && this.orden?.aprobacion_cliente === 'pendiente';
  }

  async aprobar() {
    const conf = await this.alert.create({
      header: 'Aprobar presupuesto',
      message: `¿Aprobás el presupuesto de ₡${(this.orden.total || 0).toLocaleString('es-CR')}? El taller comenzará la reparación.`,
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        { text: 'Aprobar', handler: () => this.ejecutar(this.portal.aprobar(this.orden.id), 'Presupuesto aprobado') },
      ],
    });
    await conf.present();
  }

  async rechazar() {
    const conf = await this.alert.create({
      header: 'Rechazar presupuesto',
      message: 'Contanos por qué (opcional):',
      inputs: [{ name: 'motivo', type: 'textarea', placeholder: 'Motivo del rechazo' }],
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        { text: 'Rechazar', role: 'destructive', handler: (data) => this.ejecutar(this.portal.rechazar(this.orden.id, data.motivo || ''), 'Presupuesto rechazado') },
      ],
    });
    await conf.present();
  }

  private async ejecutar(obs: any, msgOk: string) {
    const l = await this.loading.create({ message: 'Enviando...' });
    await l.present();
    obs.subscribe({
      next: async () => { await l.dismiss(); this.cargar(this.orden.id); this.mostrarToast(msgOk); },
      error: async (err: any) => { await l.dismiss(); this.mostrarToast(err.error?.error || 'Ocurrió un error', 'danger'); },
    });
  }

  async verFoto(url: string) {
    const a = await this.alert.create({ message: `<img src="${url}" style="width:100%;border-radius:8px" />`, buttons: ['Cerrar'] });
    await a.present();
  }

  private async mostrarToast(message: string, color = 'success') {
    const t = await this.toast.create({ message, duration: 2200, color });
    await t.present();
  }
}
