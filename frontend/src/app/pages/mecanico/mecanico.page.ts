import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AlertController, ToastController } from '@ionic/angular';
import { MecanicoService, ResumenMecanico } from '../../services/mecanico.service';
import { AuthService } from '../../services/auth.service';

@Component({
  standalone: false,
  selector: 'app-mecanico',
  templateUrl: './mecanico.page.html',
  styleUrls: ['./mecanico.page.scss'],
})
export class MecanicoPage implements OnInit {
  resumen?: ResumenMecanico;
  citas: any[] = [];
  cargando = true;
  notasAbiertas = new Set<number>();
  hoy = new Date().toISOString().slice(0, 10);

  readonly estados = ['agendado', 'en_revision', 'en_mantenimiento', 'listo', 'entregado', 'cancelado'];
  readonly estadoLabel: Record<string, string> = {
    agendado: 'Agendado',
    en_revision: 'En revisión',
    en_mantenimiento: 'En mantenimiento',
    listo: 'Listo',
    entregado: 'Entregado',
    cancelado: 'Cancelado',
  };
  // Clase del badge (coincide con el SCSS .st-badge.<x>).
  readonly estadoBadge: Record<string, string> = {
    agendado: 'agendado',
    en_revision: 'revision',
    en_mantenimiento: 'mantenimiento',
    listo: 'listo',
    entregado: 'entregado',
    cancelado: 'cancelado',
  };
  readonly progreso: Record<string, number> = {
    agendado: 10, en_revision: 35, en_mantenimiento: 65, listo: 85, entregado: 100, cancelado: 0,
  };

  constructor(
    private mecanico: MecanicoService,
    private auth: AuthService,
    private router: Router,
    private alert: AlertController,
    private toast: ToastController
  ) {}

  ngOnInit() { this.cargar(); }
  ionViewWillEnter() { this.cargar(); }

  get nombre(): string { return (this.auth.getUsuario()?.nombre || 'Mecánico').split(' ')[0]; }

  cargar(ev?: any) {
    this.cargando = true;
    this.mecanico.getResumen().subscribe({ next: r => this.resumen = r.data });
    this.mecanico.getCitas().subscribe({
      next: r => { this.citas = r.data; this.cargando = false; if (ev) ev.target.complete(); },
      error: () => { this.cargando = false; if (ev) ev.target.complete(); },
    });
  }

  // En el Inicio se muestran las citas de hoy + cualquier trabajo activo (no se esconde nada en curso).
  get citasHoy(): any[] {
    return this.citas.filter(c =>
      c.fecha?.slice(0, 10) === this.hoy || ['en_revision', 'en_mantenimiento'].includes(c.estado)
    );
  }

  progresoPct(estado: string): number { return this.progreso[estado] ?? 0; }

  toggleNotas(id: number) {
    this.notasAbiertas.has(id) ? this.notasAbiertas.delete(id) : this.notasAbiertas.add(id);
  }

  necesitaMonto(estado: string): boolean { return estado === 'listo' || estado === 'entregado'; }

  // Cambio desde el <select>: si pide monto, lo pregunta; si se cancela, la vista revierte sola.
  onEstadoChange(cita: any, nuevo: string) {
    if (!nuevo || nuevo === cita.estado) return;
    this.cambiarEstado(cita, nuevo);
  }

  async cambiarEstado(cita: any, estado: string) {
    if (this.necesitaMonto(estado)) {
      const al = await this.alert.create({
        header: this.estadoLabel[estado],
        message: 'Monto cobrado por el servicio (₡)',
        inputs: [{ name: 'monto', type: 'number', value: cita.monto || '', placeholder: '0' }],
        buttons: [
          { text: 'Cancelar', role: 'cancel' },
          { text: 'Guardar', handler: (data) => this.aplicarEstado(cita, estado, data.monto) },
        ],
      });
      await al.present();
      return;
    }
    this.aplicarEstado(cita, estado);
  }

  private aplicarEstado(cita: any, estado: string, monto?: any) {
    this.mecanico.cambiarEstado(cita.id, estado, monto !== undefined ? Number(monto) || 0 : undefined).subscribe({
      next: async () => {
        cita.estado = estado;
        if (monto !== undefined) cita.monto = Number(monto) || 0;
        this.mecanico.getResumen().subscribe({ next: r => this.resumen = r.data });
        const t = await this.toast.create({ message: 'Estado actualizado', duration: 1400, color: 'success' });
        await t.present();
      },
      error: async () => {
        const t = await this.toast.create({ message: 'No se pudo actualizar', duration: 2000, color: 'danger' });
        await t.present();
      },
    });
  }

  formatMin(min: number | null | undefined): string {
    if (!min) return '—';
    const h = Math.floor(min / 60);
    const m = Math.round(min % 60);
    return h ? `${h}h ${m}m` : `${m}m`;
  }

  estrellas(prom: number | null): string {
    if (!prom) return '—';
    const llenas = Math.round(prom);
    return '★'.repeat(llenas) + '☆'.repeat(5 - llenas);
  }

  irAgenda() { this.router.navigate(['/mecanico/agenda']); }

  logout() {
    this.auth.logout();
    this.router.navigate(['/portal/login'], { replaceUrl: true });
  }
}
