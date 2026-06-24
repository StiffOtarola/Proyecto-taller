import { Component, OnDestroy, OnInit } from '@angular/core';
import { ToastController } from '@ionic/angular';
import { MecanicoService } from '../../services/mecanico.service';
import { AuthService } from '../../services/auth.service';
import { abrirWhatsApp } from '../../shared/whatsapp.util';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

@Component({
  standalone: false,
  selector: 'app-mecanico-contacto',
  templateUrl: './mecanico-contacto.page.html',
  styleUrls: ['./mecanico-contacto.page.scss'],
})
export class MecanicoContactoPage implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  contacto: { nombre: string; telefono: string } | null = null;
  mensajes: any[] = [];
  cargando = true;
  texto = '';
  enviando = false;
  miId = this.auth.getUsuario()?.id;

  constructor(private mecanico: MecanicoService, private auth: AuthService, private toast: ToastController) {}

  ngOnInit() { this.cargar(); }
  ionViewWillEnter() { this.cargar(); }
  ngOnDestroy() { this.destroy$.next(); this.destroy$.complete(); }

  cargar(ev?: any) {
    this.cargando = true;
    this.mecanico.getRecepcionContacto().pipe(takeUntil(this.destroy$)).subscribe({ next: r => this.contacto = r.data });
    this.mecanico.getMensajes().pipe(takeUntil(this.destroy$)).subscribe({
      next: r => { this.mensajes = r.data; this.cargando = false; if (ev) ev.target.complete(); },
      error: () => { this.cargando = false; if (ev) ev.target.complete(); },
    });
  }

  esMio(m: any): boolean { return m.remitente_id === this.miId; }

  enviar() {
    const txt = this.texto.trim();
    if (!txt) return;
    this.enviando = true;
    this.mecanico.enviarMensaje(txt).pipe(takeUntil(this.destroy$)).subscribe({
      next: r => { this.mensajes.push(r.data); this.texto = ''; this.enviando = false; },
      error: async () => { this.enviando = false; const t = await this.toast.create({ message: 'No se pudo enviar', duration: 1800, color: 'danger' }); await t.present(); },
    });
  }

  llamar() { if (this.contacto?.telefono) window.open(`tel:${this.contacto.telefono}`, '_self'); }
  whatsapp() { if (this.contacto?.telefono) abrirWhatsApp(this.contacto.telefono, ''); }

  hace(fecha: string): string {
    if (!fecha) return '';
    const min = Math.round((Date.now() - new Date(fecha).getTime()) / 60000);
    if (min < 1) return 'Recién';
    if (min < 60) return `Hace ${min} min`;
    const h = Math.round(min / 60);
    if (h < 24) return `Hace ${h} h`;
    return `Hace ${Math.round(h / 24)} d`;
  }
}
