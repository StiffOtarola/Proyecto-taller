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

  // Fotos cargadas por orden (se piden al expandir la evidencia).
  fotos: Record<number, any[]> = {};
  abiertas = new Set<number>();

  // Flujo de estados de la OT para la barra de progreso.
  readonly flujo = ['recepcion', 'diagnostico', 'esperando_aprobacion', 'esperando_repuestos', 'en_reparacion', 'lista_entrega', 'entregada'];
  readonly estadoLabel: Record<string, string> = {
    recepcion: 'Recepción',
    diagnostico: 'Diagnóstico',
    esperando_aprobacion: 'Aprobación',
    esperando_repuestos: 'Repuestos',
    en_reparacion: 'Reparación',
    lista_entrega: 'Lista',
    entregada: 'Entregada',
    cancelada: 'Cancelada',
  };
  readonly estadoPill: Record<string, string> = {
    recepcion: 'gris',
    diagnostico: 'indigo',
    esperando_aprobacion: 'amber',
    esperando_repuestos: 'amber',
    en_reparacion: 'rose',
    lista_entrega: 'green',
    entregada: 'gris',
    cancelada: 'gris',
  };

  constructor(private rec: RecepcionService, private toast: ToastController) {}

  ngOnInit() { this.cargar(); }
  ionViewWillEnter() { this.cargar(); }

  cambiarVista() {
    this.abiertas.clear();
    this.cargar();
  }

  cargar(ev?: any) {
    this.cargando = true;
    this.rec.getOrdenes(this.vista).subscribe({
      next: r => { this.ordenes = r.data; this.cargando = false; if (ev) ev.target.complete(); },
      error: () => { this.cargando = false; if (ev) ev.target.complete(); },
    });
  }

  progresoPct(estado: string): number {
    if (estado === 'cancelada') return 0;
    const i = this.flujo.indexOf(estado);
    if (i < 0) return 0;
    return Math.round((i / (this.flujo.length - 1)) * 100);
  }

  toggleEvidencia(o: any) {
    if (this.abiertas.has(o.id)) {
      this.abiertas.delete(o.id);
      return;
    }
    this.abiertas.add(o.id);
    if (!this.fotos[o.id]) {
      this.rec.getFotosOrden(o.id).subscribe({ next: r => this.fotos[o.id] = r.data });
    }
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
            this.abiertas.add(o.id);
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
    const msg = `Hola ${o.cliente_nombre}, te enviamos evidencias del avance de tu ${o.marca} ${o.modelo} (orden ${o.numero_orden}). Revisalas en el portal: ${link}`;
    abrirWhatsApp(o.cliente_telefono, msg);
  }

  private async aviso(message: string, color: string) {
    const t = await this.toast.create({ message, duration: 1600, color });
    await t.present();
  }
}
