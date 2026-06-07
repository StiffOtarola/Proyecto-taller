import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AlertController, ToastController } from '@ionic/angular';
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
  presupuestos: any[] = [];      // órdenes esperando la aprobación del cliente
  detalle: Record<number, any> = {};
  expandido: number | null = null;
  procesando = false;
  cargando = true;
  readonly estadoLabel = ESTADO_CITA_LABEL;
  readonly fechaHoy = new Date().toLocaleDateString('es-CR', { weekday: 'short', day: 'numeric', month: 'short' });

  // Tiempo relativo legible para el feed de notificaciones ("Hace 2 h").
  hace(fecha: string): string {
    if (!fecha) return '';
    const min = Math.round((Date.now() - new Date(fecha).getTime()) / 60000);
    if (min < 1) return 'Recién';
    if (min < 60) return `Hace ${min} min`;
    const h = Math.round(min / 60);
    if (h < 24) return `Hace ${h} h`;
    return `Hace ${Math.round(h / 24)} d`;
  }

  constructor(
    public portal: PortalService,
    private router: Router,
    private alert: AlertController,
    private toast: ToastController
  ) {}

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
    this.cargarPresupuestos();
  }

  // Solo los presupuestos que esperan una decisión del cliente.
  cargarPresupuestos() {
    this.portal.getOrdenes().subscribe({
      next: r => {
        this.presupuestos = r.data.filter(
          (o: any) => o.estado === 'esperando_aprobacion' && o.aprobacion_cliente === 'pendiente'
        );
      },
      error: () => { this.presupuestos = []; },
    });
  }

  // Bloques de recompensa: 6 normales + 1 cortesía (la 7ª).
  get bloques(): boolean[] {
    const ciclo = this.resumen?.recompensas?.ciclo ?? 0;
    return Array.from({ length: this.resumen?.recompensas?.meta || 7 }, (_, i) => i < ciclo);
  }

  // Abre/cierra el desglose de un presupuesto (carga el detalle la primera vez).
  toggle(o: any) {
    if (this.expandido === o.id) { this.expandido = null; return; }
    this.expandido = o.id;
    if (!this.detalle[o.id]) {
      this.portal.getOrden(o.id).subscribe({ next: r => this.detalle[o.id] = r.data });
    }
  }

  async aprobar(o: any) {
    const al = await this.alert.create({
      header: 'Aprobar presupuesto',
      message: `¿Aprobás el presupuesto de la orden ${o.numero_orden}? El taller comenzará la reparación.`,
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        { text: 'Aprobar', handler: () => this.enviarDecision(o, 'aprobar') },
      ],
    });
    await al.present();
  }

  async rechazar(o: any) {
    const al = await this.alert.create({
      header: 'Rechazar presupuesto',
      message: `Contanos por qué rechazás el presupuesto de la orden ${o.numero_orden} (opcional).`,
      inputs: [{ name: 'motivo', type: 'textarea', placeholder: 'Motivo (opcional)' }],
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        { text: 'Rechazar', role: 'destructive', handler: (d) => this.enviarDecision(o, 'rechazar', d?.motivo) },
      ],
    });
    await al.present();
  }

  private enviarDecision(o: any, decision: 'aprobar' | 'rechazar', motivo?: string) {
    if (this.procesando) return;
    this.procesando = true;
    const req = decision === 'aprobar' ? this.portal.aprobar(o.id) : this.portal.rechazar(o.id, motivo || '');
    req.subscribe({
      next: async () => {
        this.procesando = false;
        this.expandido = null;
        const t = await this.toast.create({
          message: decision === 'aprobar' ? 'Presupuesto aprobado ✓' : 'Presupuesto rechazado',
          duration: 1800,
          color: decision === 'aprobar' ? 'success' : 'medium',
        });
        await t.present();
        this.cargarPresupuestos();
      },
      error: async () => {
        this.procesando = false;
        const t = await this.toast.create({ message: 'No se pudo procesar, intentá de nuevo', duration: 2200, color: 'danger' });
        await t.present();
      },
    });
  }

  irAgendar() { this.router.navigate(['/portal/agendar']); }
  irCitas() { this.router.navigate(['/portal/mis-citas']); }

  logout() {
    this.portal.logout();
    this.router.navigate(['/portal/login'], { replaceUrl: true });
  }
}
