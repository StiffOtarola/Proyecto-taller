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
  vista: 'hoy' | 'pendientes' | 'todas' = 'hoy';
  notasAbiertas = new Set<number>();

  hoy = new Date().toISOString().slice(0, 10);

  // Etiquetas y colores de los estados del flujo del mecánico.
  readonly estadoLabel: Record<string, string> = {
    agendado: 'Agendado',
    en_revision: 'En revisión',
    en_mantenimiento: 'En mantenimiento',
    listo: 'Listo',
    entregado: 'Entregado',
    cancelado: 'Cancelado',
  };
  readonly estadoPill: Record<string, string> = {
    agendado: 'gris',
    en_revision: 'amber',
    en_mantenimiento: 'rose',
    listo: 'indigo',
    entregado: 'green',
    cancelado: 'gris',
  };
  // Transiciones permitidas desde cada estado.
  readonly siguientes: Record<string, string[]> = {
    agendado: ['en_revision', 'cancelado'],
    en_revision: ['en_mantenimiento', 'listo', 'cancelado'],
    en_mantenimiento: ['listo', 'cancelado'],
    listo: ['entregado', 'cancelado'],
    entregado: [],
    cancelado: [],
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

  get nombre(): string { return this.auth.getUsuario()?.nombre || 'Mecánico'; }

  cargar() {
    this.cargando = true;
    this.mecanico.getResumen().subscribe({ next: r => this.resumen = r.data });
    this.mecanico.getCitas().subscribe({
      next: r => { this.citas = r.data; this.cargando = false; },
      error: () => { this.cargando = false; },
    });
  }

  // Lista filtrada según el segment activo.
  get citasFiltradas(): any[] {
    if (this.vista === 'hoy') return this.citas.filter(c => c.fecha?.slice(0, 10) === this.hoy);
    if (this.vista === 'pendientes') return this.citas.filter(c => ['en_revision', 'en_mantenimiento'].includes(c.estado));
    return this.citas;
  }

  toggleNotas(id: number) {
    this.notasAbiertas.has(id) ? this.notasAbiertas.delete(id) : this.notasAbiertas.add(id);
  }

  necesitaMonto(estado: string): boolean {
    return estado === 'listo' || estado === 'entregado';
  }

  async cambiarEstado(cita: any, estado: string) {
    // Al pasar a listo/entregado, pedir el monto cobrado.
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
        const t = await this.toast.create({ message: 'Estado actualizado', duration: 1500, color: 'success' });
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
    if (!prom) return 'Sin calificaciones';
    const llenas = Math.round(prom);
    return '★'.repeat(llenas) + '☆'.repeat(5 - llenas);
  }

  irAgenda() { this.router.navigate(['/mecanico/agenda']); }

  logout() {
    this.auth.logout();
    this.router.navigate(['/portal/login'], { replaceUrl: true });
  }
}
