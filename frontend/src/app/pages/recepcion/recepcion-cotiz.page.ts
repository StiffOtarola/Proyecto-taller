import { Component, OnInit } from '@angular/core';
import { ToastController, AlertController } from '@ionic/angular';
import { forkJoin } from 'rxjs';
import { RecepcionService } from '../../services/recepcion.service';
import { abrirWhatsApp } from '../../shared/whatsapp.util';

interface PiezaNueva { nombre: string; monto: number | null; }

@Component({
  standalone: false,
  selector: 'app-recepcion-cotiz',
  templateUrl: './recepcion-cotiz.page.html',
  styleUrls: ['./recepcion-cotiz.page.scss'],
})
export class RecepcionCotizPage implements OnInit {
  vista: 'pendiente' | 'enviada' = 'pendiente';
  cotizaciones: any[] = [];
  repuestos: Record<number, any[]> = {};
  cargando = true;

  // --- Formulario de nueva cotización ---
  mostrarForm = false;
  clientes: any[] = [];
  ordenesCliente: any[] = [];
  tecnicos: any[] = [];
  guardando = false;
  form: { cliente_id: number | null; orden_id: number | null; tecnico_id: number | null; piezas: PiezaNueva[]; mano_obra: number | null } = {
    cliente_id: null, orden_id: null, tecnico_id: null, piezas: [{ nombre: '', monto: null }], mano_obra: null,
  };

  // Edición de costos por orden (mano de obra + descuento).
  editandoCostos: number | null = null;
  costosEdit: { costo_mano_obra: number | null; descuento: number | null } = { costo_mano_obra: null, descuento: null };

  readonly aprobLabel: Record<string, string> = { pendiente: 'Pendiente', aprobado: 'Aprobado', rechazado: 'Rechazado' };
  readonly aprobPill: Record<string, string> = { pendiente: 'amber', aprobado: 'green', rechazado: 'rose' };

  constructor(private rec: RecepcionService, private toast: ToastController, private alert: AlertController) {}

  ngOnInit() { this.cargar(); }
  ionViewWillEnter() { this.cargar(); }

  cargar(ev?: any) {
    this.cargando = true;
    this.editandoCostos = null;
    this.rec.getCotizaciones(this.vista).subscribe({
      next: r => {
        this.cotizaciones = r.data;
        this.repuestos = {};
        if (r.data.length) {
          const calls = r.data.map(o => this.rec.getRepuestos(o.id));
          forkJoin(calls).subscribe({
            next: results => { r.data.forEach((o, i) => this.repuestos[o.id] = results[i].data); this.cargando = false; if (ev) ev.target.complete(); },
            error: () => { this.cargando = false; if (ev) ev.target.complete(); },
          });
        } else {
          this.cargando = false; if (ev) ev.target.complete();
        }
      },
      error: () => { this.cargando = false; if (ev) ev.target.complete(); },
    });
  }

  totalCotiz(o: any): number {
    return Number(o.costo_mano_obra || 0) + Number(o.costo_repuestos || 0) - Number(o.descuento || 0);
  }

  // ───── Formulario nueva cotización ─────
  abrirForm() {
    this.mostrarForm = true;
    this.form = { cliente_id: null, orden_id: null, tecnico_id: null, piezas: [{ nombre: '', monto: null }], mano_obra: null };
    this.ordenesCliente = [];
    if (!this.clientes.length) this.rec.getClientes().subscribe({ next: r => this.clientes = r.data });
    if (!this.tecnicos.length) this.rec.getTecnicos().subscribe({ next: r => this.tecnicos = r.data });
  }
  cerrarForm() { this.mostrarForm = false; }

  onClienteChange() {
    this.form.orden_id = null;
    this.ordenesCliente = [];
    if (this.form.cliente_id) {
      this.rec.getOrdenesCliente(this.form.cliente_id).subscribe({ next: r => this.ordenesCliente = r.data });
    }
  }

  agregarPieza() { this.form.piezas.push({ nombre: '', monto: null }); }
  quitarPieza(i: number) { this.form.piezas.splice(i, 1); if (!this.form.piezas.length) this.agregarPieza(); }

  get totalForm(): number {
    const piezas = this.form.piezas.reduce((s, p) => s + (Number(p.monto) || 0), 0);
    return piezas + (Number(this.form.mano_obra) || 0);
  }

  get formValido(): boolean {
    return !!this.form.orden_id && this.form.piezas.some(p => p.nombre.trim() && Number(p.monto) > 0);
  }

  guardarCotizacion() {
    if (!this.formValido) { this.aviso('Elegí una orden y al menos una pieza con monto', 'warning'); return; }
    this.guardando = true;
    const piezas = this.form.piezas
      .filter(p => p.nombre.trim() && Number(p.monto) > 0)
      .map(p => ({ nombre: p.nombre.trim(), cantidad: 1, costo_unitario: Number(p.monto) || 0 }));
    // Una sola llamada transaccional: si algo falla, no queda nada a medias.
    this.rec.armarCotizacion(this.form.orden_id!, {
      tecnico_id: this.form.tecnico_id,
      piezas,
      costo_mano_obra: Number(this.form.mano_obra) || 0,
      descuento: 0,
    }).subscribe({
      next: () => {
        this.guardando = false;
        this.mostrarForm = false;
        this.aviso('Cotización guardada', 'success');
        this.cargar();
      },
      error: () => {
        this.guardando = false;
        this.aviso('No se pudo guardar la cotización', 'danger');
      },
    });
  }

  // ───── Edición de piezas existentes ─────
  async editarPieza(o: any, pieza: any) {
    const al = await this.alert.create({
      header: 'Editar pieza',
      inputs: [
        { name: 'nombre', type: 'text', value: pieza.nombre, placeholder: 'Nombre' },
        { name: 'costo_unitario', type: 'number', value: pieza.costo_unitario, placeholder: 'Monto (₡)' },
      ],
      buttons: [
        { text: 'Eliminar', role: 'destructive', handler: () => this.eliminarPieza(o, pieza) },
        { text: 'Cancelar', role: 'cancel' },
        { text: 'Guardar', handler: (d) => this.guardarPieza(o, pieza, d) },
      ],
    });
    await al.present();
  }

  private guardarPieza(o: any, pieza: any, d: any) {
    this.rec.updateRepuesto(o.id, pieza.id, { nombre: d.nombre, cantidad: pieza.cantidad || 1, costo_unitario: Number(d.costo_unitario) || 0 })
      .subscribe({ next: () => { this.aviso('Pieza actualizada', 'success'); this.cargar(); }, error: () => this.aviso('No se pudo actualizar', 'danger') });
  }

  private eliminarPieza(o: any, pieza: any) {
    this.rec.deleteRepuesto(o.id, pieza.id).subscribe({ next: () => { this.aviso('Pieza eliminada', 'success'); this.cargar(); }, error: () => this.aviso('No se pudo eliminar', 'danger') });
  }

  // ───── Edición de costos (mano de obra + descuento) ─────
  toggleEditCostos(o: any) {
    if (this.editandoCostos === o.id) { this.editandoCostos = null; return; }
    this.editandoCostos = o.id;
    this.costosEdit = { costo_mano_obra: Number(o.costo_mano_obra) || 0, descuento: Number(o.descuento) || 0 };
  }
  guardarCostos(o: any) {
    this.rec.updateCostos(o.id, { costo_mano_obra: Number(this.costosEdit.costo_mano_obra) || 0, descuento: Number(this.costosEdit.descuento) || 0 })
      .subscribe({ next: () => { this.editandoCostos = null; this.aviso('Costos actualizados', 'success'); this.cargar(); }, error: () => this.aviso('No se pudo actualizar', 'danger') });
  }

  // ───── Acciones de la cotización ─────
  enviar(o: any) {
    this.rec.enviarCotizacion(o.id).subscribe({
      next: () => {
        const total = this.totalCotiz(o);
        const link = `${window.location.origin}/portal`;
        const msg = `Hola ${o.cliente_nombre}, el presupuesto de tu ${o.marca} ${o.modelo} (orden ${o.numero_orden}) está listo${total ? ` por ₡${total.toLocaleString('es-CR')}` : ''}. Podés revisarlo y aprobarlo desde el portal: ${link}`;
        abrirWhatsApp(o.cliente_telefono, msg);
        this.aviso('Cotización enviada', 'success');
        this.cargar();
      },
      error: () => this.aviso('No se pudo enviar (revisá el estado de la orden)', 'danger'),
    });
  }

  aprobar(o: any) {
    this.rec.aprobarCotizacion(o.id).subscribe({
      next: () => { this.aviso('Marcada como aprobada', 'success'); this.cargar(); },
      error: () => this.aviso('No se pudo aprobar', 'danger'),
    });
  }

  private async aviso(message: string, color: string) {
    const t = await this.toast.create({ message, duration: 1800, color });
    await t.present();
  }
}
