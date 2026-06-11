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
  confirmando = false;

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

  // Confirmar asistencia (solo cuando la cita está agendada y aún no se confirmó).
  get puedeConfirmar(): boolean {
    return this.cita?.estado === 'agendado' && !this.cita?.confirmada_cliente;
  }
  confirmar() {
    if (this.confirmando) return;
    this.confirmando = true;
    this.portal.confirmarCita(this.cita.id).subscribe({
      next: async () => {
        this.cita.confirmada_cliente = 1;
        this.confirmando = false;
        const t = await this.toast.create({ message: '¡Asistencia confirmada! Te esperamos.', duration: 2200, color: 'success' });
        await t.present();
      },
      error: async (e) => {
        this.confirmando = false;
        const t = await this.toast.create({ message: e.error?.error || 'No se pudo confirmar', duration: 2400, color: 'danger' });
        await t.present();
      },
    });
  }

  // ¿Hay algo que valga la pena exportar? (orden vinculada o monto/entrega)
  get puedeDescargar(): boolean {
    return !!(this.orden || this.cita?.monto || this.cita?.estado === 'entregado');
  }

  // Genera un comprobante imprimible (→ "Guardar como PDF" desde el diálogo de impresión).
  // Sin dependencias nuevas: abre una ventana con HTML formateado y lanza print().
  descargarComprobante() {
    const c = this.cita;
    const o = this.orden;
    const cli = this.portal.getCliente();
    const money = (n: any) => '₡' + Number(n || 0).toLocaleString('es-CR', { maximumFractionDigits: 0 });
    const esc = (s: any) => String(s ?? '').replace(/[&<>]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' } as any)[m]);
    const fecha = c.fecha ? new Date(`${String(c.fecha).slice(0, 10)}T00:00:00`).toLocaleDateString('es-CR') : '';

    const filas: string[] = [];
    if (o?.repuestos?.length) {
      for (const r of o.repuestos) {
        const sub = (r.cantidad || 1) * (r.costo_unitario || 0);
        filas.push(`<tr><td>${esc(r.nombre)}${r.cantidad > 1 ? ' ×' + r.cantidad : ''}</td><td class="r">${money(sub)}</td></tr>`);
      }
    }
    if (o) {
      filas.push(`<tr><td>Mano de obra</td><td class="r">${money(o.costo_mano_obra)}</td></tr>`);
      if (o.descuento > 0) filas.push(`<tr><td>Descuento</td><td class="r">− ${money(o.descuento)}</td></tr>`);
    }
    const total = o ? Number(o.total || 0) : Number(c.monto || 0);

    const html = `<!doctype html><html lang="es"><head><meta charset="utf-8">
      <title>Comprobante ${esc(c.numero_orden || c.id)}</title>
      <style>
        * { box-sizing: border-box; } body { font-family: -apple-system, 'Segoe UI', Roboto, sans-serif; color: #1a1a1a; margin: 0; padding: 28px; }
        .doc { max-width: 620px; margin: 0 auto; }
        .hd { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #e11d48; padding-bottom: 14px; margin-bottom: 18px; }
        .hd h1 { font-size: 22px; margin: 0; color: #e11d48; letter-spacing: -.02em; }
        .hd .sub { font-size: 12px; color: #666; margin-top: 2px; }
        .hd .num { text-align: right; font-size: 12px; color: #444; }
        .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 16px; font-size: 13px; margin-bottom: 18px; }
        .grid .k { color: #888; } .grid .v { font-weight: 600; }
        table { width: 100%; border-collapse: collapse; font-size: 13px; margin-bottom: 8px; }
        td { padding: 8px 0; border-bottom: 1px solid #eee; } td.r { text-align: right; font-variant-numeric: tabular-nums; }
        .total { display: flex; justify-content: space-between; font-size: 17px; font-weight: 800; padding-top: 10px; }
        .diag { background: #f7f7f7; border-radius: 8px; padding: 12px; font-size: 12.5px; color: #444; margin-bottom: 16px; }
        .ft { margin-top: 24px; text-align: center; font-size: 11px; color: #999; }
        h3 { font-size: 12px; text-transform: uppercase; letter-spacing: .08em; color: #999; margin: 0 0 6px; }
      </style></head><body><div class="doc">
      <div class="hd">
        <div><h1>MS Motos</h1><div class="sub">Comprobante de servicio</div></div>
        <div class="num"><strong>${esc(c.numero_orden || ('Cita #' + c.id))}</strong><br>${esc(fecha)}</div>
      </div>
      <div class="grid">
        <div><div class="k">Cliente</div><div class="v">${esc(cli ? cli.nombre + ' ' + cli.apellido : '—')}</div></div>
        <div><div class="k">Moto</div><div class="v">${esc(c.marca)} ${esc(c.modelo)}${c.placa ? ' · ' + esc(c.placa) : ''}</div></div>
        <div><div class="k">Servicio</div><div class="v">${esc(c.tipo_servicio || c.motivo || '—')}</div></div>
        <div><div class="k">Mecánico</div><div class="v">${esc(c.tecnico_nombre || 'Por asignar')}</div></div>
      </div>
      ${o?.diagnostico ? `<div class="diag"><strong>Diagnóstico:</strong> ${esc(o.diagnostico)}</div>` : ''}
      ${filas.length ? `<h3>Detalle</h3><table>${filas.join('')}</table>` : ''}
      <div class="total"><span>Total</span><span>${money(total)}</span></div>
      <div class="ft">Gracias por confiar en MS Motos · Documento generado el ${new Date().toLocaleDateString('es-CR')}</div>
      </div>
      <script>window.onload = function(){ window.print(); }</script>
      </body></html>`;

    const w = window.open('', '_blank');
    if (!w) {
      this.toast.create({ message: 'Permití las ventanas emergentes para descargar el comprobante.', duration: 3000, color: 'warning' }).then(t => t.present());
      return;
    }
    w.document.open();
    w.document.write(html);
    w.document.close();
  }

  async cancelar() {
    const al = await this.alert.create({
      cssClass: 'portal-alert',
      header: 'Cancelar cita',
      message: 'Esta acción no se puede deshacer. ¿Querés cancelar esta cita?',
      buttons: [
        { text: 'No', role: 'cancel' },
        { text: 'Sí, cancelar', role: 'destructive', cssClass: 'portal-alert-danger', handler: () => this.confirmarCancelar() },
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
      cssClass: 'portal-alert',
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
