import { Component, OnInit, OnDestroy, ViewChild } from '@angular/core';
import { AlertController, IonContent, ToastController } from '@ionic/angular';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { RecepcionService } from '../../services/recepcion.service';
import { abrirWhatsApp } from '../../shared/whatsapp.util';

@Component({
  standalone: false,
  selector: 'app-recepcion-mensajes',
  templateUrl: './recepcion-mensajes.page.html',
  styleUrls: ['./recepcion-mensajes.page.scss'],
})
export class RecepcionMensajesPage implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  @ViewChild(IonContent) content?: IonContent;

  vista: 'mecanicos' | 'clientes' | 'taller' = 'mecanicos';
  avances: any[] = [];
  notificaciones: any[] = [];
  internos: any[] = [];
  cargando = true;

  // Envío rápido
  clientes: any[] = [];
  form: { cliente_id: number | null; titulo: string; mensaje: string } = { cliente_id: null, titulo: '', mensaje: '' };
  enviando = false;

  // Chat del taller (conversación por mecánico, estilo mensajería)
  tecnicos: any[] = [];
  chatAbierto: { id: number; nombre: string } | null = null;
  borrador = '';
  enviandoChat = false;

  constructor(private rec: RecepcionService, private toast: ToastController, private alert: AlertController) {}

  ngOnInit() { this.cargar(); }
  ionViewWillEnter() { this.cargar(); }

  cargar(ev?: any) {
    this.cargando = true;
    let pendientes = 3;
    const listo = () => { if (--pendientes <= 0) this.cargando = false; if (ev) ev.target.complete(); };
    this.rec.getAvances().pipe(takeUntil(this.destroy$)).subscribe({ next: r => { this.avances = r.data; listo(); }, error: listo });
    this.rec.getNotificaciones().pipe(takeUntil(this.destroy$)).subscribe({ next: r => { this.notificaciones = r.data; listo(); }, error: listo });
    this.rec.getMensajesInternos().pipe(takeUntil(this.destroy$)).subscribe({ next: r => { this.internos = r.data; listo(); }, error: listo });
    if (!this.clientes.length) this.rec.getClientes().pipe(takeUntil(this.destroy$)).subscribe({ next: r => this.clientes = r.data });
    if (!this.tecnicos.length) this.rec.getTecnicos().pipe(takeUntil(this.destroy$)).subscribe({ next: r => this.tecnicos = r.data, error: () => {} });
  }

  // ——— Chat del taller (mensajería interna con mecánicos) ———
  // El mecánico es la "otra parte" de un mensaje: si lo mandó recepción, es el destino;
  // si lo mandó el mecánico, es el remitente.
  private mecDe(m: any): { id: number; nombre: string } | null {
    const esRecep = m.remitente_rol === 'recepcion';
    const id = esRecep ? m.destino_id : m.remitente_id;
    const nombre = esRecep ? (m.destino_nombre || 'Mecánico') : (m.remitente_nombre || 'Mecánico');
    return id ? { id, nombre } : null;
  }

  // Conversaciones agrupadas por mecánico, la más reciente primero (internos viene DESC).
  get conversaciones(): any[] {
    const map = new Map<number, any>();
    for (const m of this.internos) {
      const mec = this.mecDe(m);
      if (!mec) continue;
      if (!map.has(mec.id)) map.set(mec.id, { id: mec.id, nombre: mec.nombre, ultimo: m, noLeidos: 0 });
      if (m.remitente_rol !== 'recepcion' && !m.leido) map.get(mec.id).noLeidos++;
    }
    return [...map.values()];
  }

  // Mensajes del chat abierto en orden cronológico (viejo → nuevo).
  get hilo(): any[] {
    if (!this.chatAbierto) return [];
    const id = this.chatAbierto.id;
    return this.internos.filter(m => { const mec = this.mecDe(m); return !!mec && mec.id === id; }).slice().reverse();
  }

  esMio(m: any): boolean { return m.remitente_rol === 'recepcion'; }

  abrirChat(c: any) { this.chatAbierto = { id: c.id, nombre: c.nombre }; this.scrollHilo(); }
  cerrarChat() { this.chatAbierto = null; this.borrador = ''; }

  // Iniciar un chat con cualquier mecánico (incluye los que aún no tienen mensajes).
  async nuevoChat() {
    if (!this.tecnicos.length) { this.aviso('No hay mecánicos disponibles', 'warning'); return; }
    const al = await this.alert.create({
      header: 'Nuevo mensaje',
      inputs: this.tecnicos.map(t => ({ type: 'radio' as const, label: t.nombre, value: { id: t.id, nombre: t.nombre } })),
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        { text: 'Abrir', handler: (v) => { if (v) this.abrirChat(v); } },
      ],
    });
    await al.present();
  }

  enviarChat() {
    const txt = this.borrador.trim();
    if (!txt || !this.chatAbierto || this.enviandoChat) return;
    this.enviandoChat = true;
    this.rec.responderInterno(this.chatAbierto.id, txt).pipe(takeUntil(this.destroy$)).subscribe({
      next: (r: any) => {
        if (r?.data) this.internos.unshift(r.data);   // internos es DESC → al frente
        this.borrador = '';
        this.enviandoChat = false;
        this.scrollHilo();
      },
      error: () => { this.enviandoChat = false; this.aviso('No se pudo enviar', 'danger'); },
    });
  }

  private scrollHilo() { setTimeout(() => this.content?.scrollToBottom(150), 60); }

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
      .pipe(takeUntil(this.destroy$)).subscribe({
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

  ngOnDestroy() { this.destroy$.next(); this.destroy$.complete(); }

  private async aviso(message: string, color: string) {
    const t = await this.toast.create({ message, duration: 1700, color });
    await t.present();
  }
}
