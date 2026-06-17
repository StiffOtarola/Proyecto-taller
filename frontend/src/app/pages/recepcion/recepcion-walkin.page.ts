import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { ToastController } from '@ionic/angular';
import { RecepcionService } from '../../services/recepcion.service';

// "Cliente sin cita" (walk-in): abre una orden de trabajo al toque para un cliente
// que llegó sin reserva. Reusa la búsqueda de clientes, sus motos y POST /api/ordenes.
@Component({
  standalone: false,
  selector: 'app-recepcion-walkin',
  templateUrl: './recepcion-walkin.page.html',
  styleUrls: ['./recepcion-walkin.page.scss'],
})
export class RecepcionWalkinPage implements OnInit {
  qCliente = '';
  clientes: any[] = [];
  cliente: any = null;
  motos: any[] = [];
  sucursales: any[] = [];
  guardando = false;

  form = {
    moto_id: null as number | null,
    sucursal_id: null as number | null,
    problema_reportado: '',
    kilometraje_ingreso: null as number | null,
    prioridad: 'normal',
  };

  constructor(private rec: RecepcionService, private router: Router, private toast: ToastController) {}

  ngOnInit() {
    this.rec.getSucursales().subscribe({
      next: r => {
        this.sucursales = r.data || [];
        if (this.sucursales.length === 1) this.form.sucursal_id = this.sucursales[0].id;
      },
      error: () => { this.sucursales = []; },
    });
  }

  // Al volver de crear un cliente/moto, refresca las motos del cliente elegido.
  ionViewWillEnter() {
    if (this.cliente) this.cargarMotos(this.cliente.id);
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
    this.cargarMotos(c.id);
  }

  private cargarMotos(clienteId: number) {
    this.rec.getMotos(clienteId).subscribe({
      next: r => { this.motos = r.data; if (r.data.length === 1) this.form.moto_id = r.data[0].id; },
      error: () => { this.motos = []; },
    });
  }

  limpiarCliente() {
    this.cliente = null; this.qCliente = ''; this.clientes = [];
    this.motos = []; this.form.moto_id = null;
  }

  // Crear cliente nuevo / registrar moto: reusan los formularios existentes.
  crearCliente() { this.router.navigate(['/cliente-form']); }
  registrarMoto() {
    if (this.cliente) this.router.navigate(['/moto-form'], { queryParams: { cliente_id: this.cliente.id } });
  }

  iniciales(c: any): string {
    return `${(c?.nombre || '?')[0] || ''}${(c?.apellido || '')[0] || ''}`.toUpperCase() || '?';
  }

  get valido(): boolean {
    return !!this.cliente && !!this.form.moto_id && !!this.form.problema_reportado.trim()
      && (this.sucursales.length <= 1 || !!this.form.sucursal_id);
  }

  confirmar() {
    if (!this.valido) { this.aviso('Elegí cliente, moto y describí el problema', 'warning'); return; }
    this.guardando = true;
    this.rec.crearOrden({
      cliente_id: this.cliente.id,
      moto_id: this.form.moto_id!,
      problema_reportado: this.form.problema_reportado.trim(),
      sucursal_id: this.form.sucursal_id,
      kilometraje_ingreso: this.form.kilometraje_ingreso || null,
      prioridad: this.form.prioridad || 'normal',
    }).subscribe({
      next: (r) => {
        this.guardando = false;
        this.aviso(`Orden ${r.data.numero_orden} creada`);
        this.router.navigate(['/detalle-orden', r.data.id]);
      },
      error: (e) => { this.guardando = false; this.aviso(e.error?.error || 'No se pudo crear la orden', 'danger'); },
    });
  }

  private async aviso(message: string, color = 'success') {
    const t = await this.toast.create({ message, duration: 1800, color });
    await t.present();
  }
}
