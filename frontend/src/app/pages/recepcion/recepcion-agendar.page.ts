import { Component, OnInit } from '@angular/core';
import { ToastController } from '@ionic/angular';
import { RecepcionService } from '../../services/recepcion.service';

@Component({
  standalone: false,
  selector: 'app-recepcion-agendar',
  templateUrl: './recepcion-agendar.page.html',
  styleUrls: ['./recepcion-agendar.page.scss'],
})
export class RecepcionAgendarPage implements OnInit {
  qCliente = '';
  clientes: any[] = [];
  cliente: any = null;
  motos: any[] = [];
  tecnicos: any[] = [];
  servicios: string[] = [];
  disp: { horas: string[]; max: number; ocupacion: Record<string, number> } | null = null;
  guardando = false;

  form = {
    moto_id: null as number | null,
    tipo_servicio: '',
    tecnico_id: null as number | null,
    fecha: new Date().toISOString().slice(0, 10),
    hora: '',
    motivo: '',
  };

  constructor(private rec: RecepcionService, private toast: ToastController) {}

  ngOnInit() {
    this.rec.getTecnicos().subscribe({ next: r => this.tecnicos = r.data, error: () => {} });
    this.rec.getServicios().subscribe({ next: r => this.servicios = r.data, error: () => {} });
    this.cargarDisponibilidad();
  }

  buscarClientes() {
    const q = this.qCliente.trim();
    if (!q || this.cliente) { this.clientes = []; return; }
    this.rec.getClientes(q).subscribe({ next: r => this.clientes = r.data, error: () => {} });
  }

  seleccionarCliente(c: any) {
    this.cliente = c;
    this.qCliente = `${c.nombre} ${c.apellido || ''}`.trim();
    this.clientes = [];
    this.form.moto_id = null;
    this.rec.getMotos(c.id).subscribe({
      next: r => { this.motos = r.data; if (r.data.length === 1) this.form.moto_id = r.data[0].id; },
      error: () => { this.motos = []; },
    });
  }

  limpiarCliente() {
    this.cliente = null; this.qCliente = ''; this.clientes = [];
    this.motos = []; this.form.moto_id = null;
  }

  cargarDisponibilidad() {
    this.form.hora = '';
    if (!this.form.fecha) { this.disp = null; return; }
    this.rec.getDisponibilidad(this.form.fecha).subscribe({
      next: r => this.disp = r.data,
      error: () => this.disp = null,
    });
  }

  llena(h: string): boolean { return !!this.disp && (this.disp.ocupacion[h] || 0) >= this.disp.max; }
  restantes(h: string): number { return this.disp ? Math.max(0, this.disp.max - (this.disp.ocupacion[h] || 0)) : 0; }
  iniciales(c: any): string {
    return `${(c?.nombre || '?')[0] || ''}${(c?.apellido || '')[0] || ''}`.toUpperCase() || '?';
  }

  get valido(): boolean {
    return !!this.cliente && !!this.form.fecha && !!this.form.hora && !!this.form.tipo_servicio;
  }

  confirmar() {
    if (!this.valido) { this.aviso('Completá cliente, servicio, fecha y hora', 'warning'); return; }
    this.guardando = true;
    this.rec.crearCita({
      cliente_id: this.cliente.id,
      moto_id: this.form.moto_id,
      fecha: this.form.fecha,
      hora: this.form.hora,
      motivo: this.form.motivo.trim() || this.form.tipo_servicio,
      tipo_servicio: this.form.tipo_servicio || null,
      tecnico_id: this.form.tecnico_id,
    }).subscribe({
      next: () => { this.guardando = false; this.aviso('Cita agendada'); this.reset(); },
      error: (e) => { this.guardando = false; this.aviso(e.error?.error || 'No se pudo agendar', 'danger'); },
    });
  }

  private reset() {
    const fecha = this.form.fecha;
    this.limpiarCliente();
    this.form = { moto_id: null, tipo_servicio: '', tecnico_id: null, fecha, hora: '', motivo: '' };
    this.cargarDisponibilidad();
  }

  private async aviso(message: string, color = 'success') {
    const t = await this.toast.create({ message, duration: 1800, color });
    await t.present();
  }
}
