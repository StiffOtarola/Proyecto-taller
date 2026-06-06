import { Component, OnInit } from '@angular/core';
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

  constructor(private rec: RecepcionService, private toast: ToastController) {}

  ngOnInit() { this.cargar(); }
  ionViewWillEnter() { this.cargar(); }

  cambiarVista() { this.cargar(); }

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
