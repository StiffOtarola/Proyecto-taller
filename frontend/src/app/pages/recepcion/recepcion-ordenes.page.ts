import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { ToastController } from '@ionic/angular';
import { RecepcionService } from '../../services/recepcion.service';
import { comprimirImagen } from '../../shared/image.util';
import { abrirWhatsApp } from '../../shared/whatsapp.util';

@Component({
  standalone: false,
  selector: 'app-recepcion-ordenes',
  templateUrl: './recepcion-ordenes.page.html',
  styleUrls: ['./recepcion-ordenes.page.scss'],
})
export class RecepcionOrdenesPage implements OnInit {
  vista: 'activas' | 'completadas' = 'activas';
  ordenes: any[] = [];
  cargando = true;
  subiendo = new Set<number>();

  // Filtros (client-side sobre la lista ya cargada): texto + etapa + sucursal + prioridad.
  busqueda = '';
  estadoFiltro = '';
  sucursalFiltro: number | '' = '';
  prioridadFiltro = '';

  // Prioridades (se filtran solo las no-normales presentes).
  readonly prioridadOrden = ['urgente', 'emergencia', 'garantia'];
  readonly prioridadLabel: Record<string, string> = { urgente: 'Urgente', emergencia: 'Emergencia', garantia: 'Garantía' };

  // Etapas posibles por vista (para los chips de filtro).
  readonly chipsActivas = ['recepcion', 'diagnostico', 'esperando_aprobacion', 'esperando_repuestos', 'en_reparacion', 'lista_entrega'];
  readonly chipsCompletadas = ['entregada', 'cancelada'];

  // Fotos cargadas por orden (prefetch de las que tienen evidencia).
  fotos: Record<number, any[]> = {};
  // Nota corta opcional que la recepción agrega al mensaje del cliente.
  notas: Record<number, string> = {};

  // Flujo de estados de la OT para la barra de progreso.
  readonly flujo = ['recepcion', 'diagnostico', 'esperando_aprobacion', 'esperando_repuestos', 'en_reparacion', 'lista_entrega', 'entregada'];
  readonly estadoLabel: Record<string, string> = {
    recepcion: 'Recepción',
    diagnostico: 'Diagnóstico',
    esperando_aprobacion: 'Aprobación',
    esperando_repuestos: 'Repuestos',
    en_reparacion: 'En proceso',
    lista_entrega: 'Lista',
    entregada: 'Entregada',
    cancelada: 'Cancelada',
  };
  readonly estadoPill: Record<string, string> = {
    recepcion: 'gris',
    diagnostico: 'indigo',
    esperando_aprobacion: 'amber',
    esperando_repuestos: 'amber',
    en_reparacion: 'indigo',
    lista_entrega: 'green',
    entregada: 'gris',
    cancelada: 'gris',
  };

  constructor(private rec: RecepcionService, private router: Router, private toast: ToastController) {}

  ngOnInit() { this.cargar(); }

  // Abre el detalle completo de la orden (diagnóstico, costos, estados, tiempos).
  abrirDetalle(o: any) { this.router.navigate(['/detalle-orden', o.id]); }
  ionViewWillEnter() { this.cargar(); }

  // Al cambiar de vista cambian las etapas: se descartan los filtros.
  cambiarVista() { this.estadoFiltro = ''; this.sucursalFiltro = ''; this.prioridadFiltro = ''; this.cargar(); }

  // Sucursales presentes en la lista cargada (para los chips; solo si hay más de una).
  get sucursalesPresentes(): { id: number; nombre: string }[] {
    const map = new Map<number, string>();
    for (const o of this.ordenes) {
      if (o.sucursal_id && o.sucursal_nombre && !map.has(o.sucursal_id)) map.set(o.sucursal_id, o.sucursal_nombre);
    }
    return [...map].map(([id, nombre]) => ({ id, nombre })).sort((a, b) => a.nombre.localeCompare(b.nombre));
  }
  // Prioridades no-normales presentes, con su conteo (para los chips).
  get prioridadesPresentes(): { valor: string; label: string; n: number }[] {
    return this.prioridadOrden
      .map(p => ({ valor: p, label: this.prioridadLabel[p], n: this.ordenes.filter(o => o.prioridad === p).length }))
      .filter(p => p.n > 0);
  }
  setSucursalFiltro(id: number) { this.sucursalFiltro = this.sucursalFiltro === id ? '' : id; }
  setPrioridadFiltro(p: string) { this.prioridadFiltro = this.prioridadFiltro === p ? '' : p; }

  // —— Filtros ——
  // Chips de etapa presentes en la lista cargada (solo las que tienen órdenes), con su conteo.
  get chipsConteo(): { estado: string; label: string; n: number }[] {
    const fuente = this.vista === 'activas' ? this.chipsActivas : this.chipsCompletadas;
    return fuente
      .map(e => ({ estado: e, label: this.estadoLabel[e] || e, n: this.ordenes.filter(o => o.estado === e).length }))
      .filter(c => c.n > 0);
  }

  setEstadoFiltro(e: string) { this.estadoFiltro = this.estadoFiltro === e ? '' : e; }

  // Lista aplicando búsqueda (número / cliente / placa / moto) + etapa.
  get ordenesVista(): any[] {
    const q = this.busqueda.trim().toLowerCase();
    return this.ordenes.filter(o => {
      if (this.estadoFiltro && o.estado !== this.estadoFiltro) return false;
      if (this.sucursalFiltro && o.sucursal_id !== this.sucursalFiltro) return false;
      if (this.prioridadFiltro && o.prioridad !== this.prioridadFiltro) return false;
      if (q) {
        const txt = `${o.numero_orden} ${o.cliente_nombre} ${o.cliente_apellido} ${o.placa || ''} ${o.marca || ''} ${o.modelo || ''}`.toLowerCase();
        if (!txt.includes(q)) return false;
      }
      return true;
    });
  }

  cargar(ev?: any) {
    this.cargando = true;
    this.rec.getOrdenes(this.vista).subscribe({
      next: r => {
        this.ordenes = r.data;
        this.fotos = {};
        this.cargando = false;
        if (ev) ev.target.complete();
        // Prefetch de evidencias para mostrar los thumbnails directamente.
        r.data.filter(o => o.total_fotos > 0).forEach(o => {
          this.rec.getFotosOrden(o.id).subscribe({ next: f => this.fotos[o.id] = f.data });
        });
      },
      error: () => { this.cargando = false; if (ev) ev.target.complete(); },
    });
  }

  progresoPct(estado: string): number {
    if (estado === 'cancelada') return 0;
    const i = this.flujo.indexOf(estado);
    if (i < 0) return 0;
    return Math.round((i / (this.flujo.length - 1)) * 100);
  }

  // Selecciona un archivo, lo comprime y lo sube como evidencia.
  subirFoto(o: any) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      this.subiendo.add(o.id);
      try {
        const url = await comprimirImagen(file);
        this.rec.subirFoto(o.id, { url, tipo: 'avance' }).subscribe({
          next: r => {
            this.fotos[o.id] = [...(this.fotos[o.id] || []), r.data];
            o.total_fotos = (o.total_fotos || 0) + 1;
            this.subiendo.delete(o.id);
            this.aviso('Foto subida', 'success');
          },
          error: () => { this.subiendo.delete(o.id); this.aviso('No se pudo subir', 'danger'); },
        });
      } catch {
        this.subiendo.delete(o.id);
        this.aviso('No se pudo procesar la imagen', 'danger');
      }
    };
    input.click();
  }

  enviarAlCliente(o: any) {
    const link = `${window.location.origin}/portal`;
    const nota = (this.notas[o.id] || '').trim();
    const base = `Hola ${o.cliente_nombre}, novedad de tu ${o.marca} ${o.modelo} (orden ${o.numero_orden}).`;
    const cuerpo = nota ? ` ${nota}` : ' Te enviamos evidencias del avance.';
    const msg = `${base}${cuerpo} Revisalas en el portal: ${link}`;
    abrirWhatsApp(o.cliente_telefono, msg);
  }

  private async aviso(message: string, color: string) {
    const t = await this.toast.create({ message, duration: 1600, color });
    await t.present();
  }
}
