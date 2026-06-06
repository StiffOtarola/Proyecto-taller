import { Component, OnInit } from '@angular/core';
import { ToastController } from '@ionic/angular';
import { RecepcionService } from '../../services/recepcion.service';
import { abrirWhatsApp } from '../../shared/whatsapp.util';

@Component({
  standalone: false,
  selector: 'app-recepcion-mensajes',
  templateUrl: './recepcion-mensajes.page.html',
  styleUrls: ['./recepcion-mensajes.page.scss'],
})
export class RecepcionMensajesPage implements OnInit {
  vista: 'mecanicos' | 'clientes' = 'mecanicos';
  avances: any[] = [];
  notificaciones: any[] = [];
  cargando = true;

  // Envío rápido
  clientes: any[] = [];
  form: { cliente_id: number | null; titulo: string; mensaje: string } = { cliente_id: null, titulo: '', mensaje: '' };
  enviando = false;

  constructor(private rec: RecepcionService, private toast: ToastController) {}

  ngOnInit() { this.cargar(); }
  ionViewWillEnter() { this.cargar(); }

  cargar(ev?: any) {
    this.cargando = true;
    let pendientes = 2;
    const listo = () => { if (--pendientes <= 0) this.cargando = false; if (ev) ev.target.complete(); };
    this.rec.getAvances().subscribe({ next: r => { this.avances = r.data; listo(); }, error: listo });
    this.rec.getNotificaciones().subscribe({ next: r => { this.notificaciones = r.data; listo(); }, error: listo });
    if (!this.clientes.length) this.rec.getClientes().subscribe({ next: r => this.clientes = r.data });
  }

  iniciales(nombre?: string, apellido?: string): string {
    return `${(nombre || '?').charAt(0)}${(apellido || '').charAt(0)}`.toUpperCase();
  }

  hace(fecha: string): string {
    if (!fecha) return '';
    const min = Math.round((Date.now() - new Date(fecha).getTime()) / 60000);
    if (min < 1) return 'Recién';
    if (min < 60) return `Hace ${min} min`;
    const h = Math.round(min / 60);
    if (h < 24) return `Hace ${h} h`;
    return `Hace ${Math.round(h / 24)} d`;
  }

  reenviar(a: any) {
    const msg = `Hola ${a.cliente_nombre}, novedad de tu ${a.marca} ${a.modelo} (orden ${a.numero_orden}): ${a.descripcion}`;
    abrirWhatsApp(a.cliente_telefono, msg);
  }

  responder(n: any) {
    abrirWhatsApp(n.cliente_telefono, `Hola ${n.cliente_nombre}, `);
  }

  get formValido(): boolean {
    return !!this.form.cliente_id && !!this.form.titulo.trim() && !!this.form.mensaje.trim();
  }

  enviarRapido() {
    if (!this.formValido) { this.aviso('Completá cliente, título y mensaje', 'warning'); return; }
    this.enviando = true;
    this.rec.notificar({ cliente_id: this.form.cliente_id!, titulo: this.form.titulo.trim(), mensaje: this.form.mensaje.trim() })
      .subscribe({
        next: () => {
          this.enviando = false;
          this.form = { cliente_id: null, titulo: '', mensaje: '' };
          this.vista = 'clientes';
          this.aviso('Notificación enviada', 'success');
          this.cargar();
        },
        error: () => { this.enviando = false; this.aviso('No se pudo enviar', 'danger'); },
      });
  }

  private async aviso(message: string, color: string) {
    const t = await this.toast.create({ message, duration: 1700, color });
    await t.present();
  }
}
