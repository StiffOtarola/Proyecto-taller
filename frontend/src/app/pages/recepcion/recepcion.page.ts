import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { ToastController } from '@ionic/angular';
import { RecepcionService, ResumenRecepcion } from '../../services/recepcion.service';
import { AuthService } from '../../services/auth.service';

@Component({
  standalone: false,
  selector: 'app-recepcion',
  templateUrl: './recepcion.page.html',
  styleUrls: ['./recepcion.page.scss'],
})
export class RecepcionPage implements OnInit {
  resumen?: ResumenRecepcion;
  citas: any[] = [];
  alertas: any[] = [];
  cargando = true;

  // Etiquetas y colores de los estados de la cita.
  readonly estadoLabel: Record<string, string> = {
    agendado: 'Agendado',
    en_revision: 'En revisión',
    en_mantenimiento: 'En mantenimiento',
    listo: 'Listo',
    entregado: 'Entregado',
    cancelado: 'Cancelado',
  };
  readonly estadoPill: Record<string, string> = {
    agendado: 'indigo',
    en_revision: 'amber',
    en_mantenimiento: 'rose',
    listo: 'green',
    entregado: 'gris',
    cancelado: 'gris',
  };

  creandoOrden: number | null = null;

  constructor(
    private rec: RecepcionService,
    private auth: AuthService,
    private router: Router,
    private toast: ToastController
  ) {}

  ngOnInit() { this.cargar(); }
  ionViewWillEnter() { this.cargar(); }

  get nombre(): string { return this.auth.getUsuario()?.nombre || 'Recepción'; }
  get primerNombre(): string { return this.nombre.split(' ')[0]; }

  get fechaHoy(): string {
    return new Date().toLocaleDateString('es-CR', { weekday: 'long', day: 'numeric', month: 'long' });
  }

  cargar(ev?: any) {
    this.cargando = true;
    let pendientes = 3;
    const listo = () => { if (--pendientes <= 0) this.cargando = false; if (ev) ev.target.complete(); };
    this.rec.getResumen().subscribe({ next: r => { this.resumen = r.data; listo(); }, error: listo });
    this.rec.getCitasHoy().subscribe({ next: r => { this.citas = r.data; listo(); }, error: listo });
    this.rec.getAlertas().subscribe({ next: r => { this.alertas = r.data; listo(); }, error: listo });
  }

  // Ícono y color de cada alerta según su tipo.
  alertaIcono(a: any): string {
    if (a.tipo === 'foto') return 'camera-outline';
    if (a.titulo?.toLowerCase().includes('listo') || a.titulo?.toLowerCase().includes('entrega')) return 'checkmark-circle-outline';
    return 'notifications-outline';
  }
  alertaColor(a: any): string {
    if (a.tipo === 'foto') return 'rose';
    if (a.titulo?.toLowerCase().includes('listo') || a.titulo?.toLowerCase().includes('entrega')) return 'green';
    return 'amber';
  }
  alertaTexto(a: any): string {
    if (a.tipo === 'foto') {
      return `Nueva foto de ${a.tecnico_nombre || 'el mecánico'} · ${a.marca || ''} ${a.modelo || ''} (${a.numero_orden})`;
    }
    return a.titulo ? `${a.titulo} — ${a.mensaje}` : a.mensaje;
  }

  // Timestamp relativo: "Hace 10 min", "Hace 2 h", etc.
  hace(fecha: string): string {
    if (!fecha) return '';
    const diff = Date.now() - new Date(fecha).getTime();
    const min = Math.round(diff / 60000);
    if (min < 1) return 'Recién';
    if (min < 60) return `Hace ${min} min`;
    const h = Math.round(min / 60);
    if (h < 24) return `Hace ${h} h`;
    const d = Math.round(h / 24);
    return `Hace ${d} d`;
  }

  // Crea la orden de trabajo de una cita y abre su pantalla.
  crearOrden(c: any) {
    if (this.creandoOrden) return;
    this.creandoOrden = c.id;
    this.rec.crearOrdenDesdeCita(c.id).subscribe({
      next: async (r) => {
        this.creandoOrden = null;
        c.orden_id = r.data.orden_id;
        c.numero_orden = r.data.numero_orden;
        if (c.estado === 'agendado') c.estado = 'en_revision';
        const t = await this.toast.create({ message: `Orden ${r.data.numero_orden} creada`, duration: 1600, color: 'success' });
        await t.present();
        this.router.navigate(['/detalle-orden', r.data.orden_id]);
      },
      error: async (err) => {
        this.creandoOrden = null;
        const t = await this.toast.create({ message: err.error?.error || 'No se pudo crear la orden', duration: 2400, color: 'danger' });
        await t.present();
      },
    });
  }

  verOrden(c: any) { this.router.navigate(['/detalle-orden', c.orden_id]); }

  logout() {
    this.auth.logout();
    this.router.navigate(['/portal/login'], { replaceUrl: true });
  }
}
