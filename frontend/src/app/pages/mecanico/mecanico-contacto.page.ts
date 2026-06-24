import { Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { IonContent, ToastController } from '@ionic/angular';
import { MecanicoService } from '../../services/mecanico.service';
import { AuthService } from '../../services/auth.service';
import { abrirWhatsApp } from '../../shared/whatsapp.util';
import { Subject, interval } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

@Component({
  standalone: false,
  selector: 'app-mecanico-contacto',
  templateUrl: './mecanico-contacto.page.html',
  styleUrls: ['./mecanico-contacto.page.scss'],
})
export class MecanicoContactoPage implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  @ViewChild(IonContent) content?: IonContent;

  contacto: { nombre: string; telefono: string } | null = null;
  mensajes: any[] = [];
  cargando = true;
  texto = '';
  enviando = false;
  miId = this.auth.getUsuario()?.id;
  fotoPreview: string | null = null;

  constructor(private mecanico: MecanicoService, private auth: AuthService, private toast: ToastController) {}

  ngOnInit() {
    this.cargar();
    interval(15000).pipe(takeUntil(this.destroy$)).subscribe(() => this.refrescar());
  }

  ionViewWillEnter() { this.cargar(); }
  ngOnDestroy() { this.destroy$.next(); this.destroy$.complete(); }

  cargar(ev?: any) {
    this.cargando = true;
    this.mecanico.getRecepcionContacto().pipe(takeUntil(this.destroy$)).subscribe({ next: r => this.contacto = r.data });
    this.mecanico.getMensajes().pipe(takeUntil(this.destroy$)).subscribe({
      next: r => {
        this.mensajes = r.data;
        this.cargando = false;
        if (ev) ev.target.complete();
        this.scrollAbajo();
      },
      error: () => { this.cargando = false; if (ev) ev.target.complete(); },
    });
  }

  private refrescar() {
    this.mecanico.getMensajes().pipe(takeUntil(this.destroy$)).subscribe({
      next: r => {
        const tenia = this.mensajes.length;
        this.mensajes = r.data;
        if (r.data.length > tenia) this.scrollAbajo();
      },
    });
  }

  esMio(m: any): boolean { return m.remitente_id === this.miId; }

  enviar() {
    const txt = this.texto.trim();
    const foto = this.fotoPreview;
    if (!txt && !foto) return;
    this.enviando = true;
    this.mecanico.enviarMensaje(txt, foto).pipe(takeUntil(this.destroy$)).subscribe({
      next: r => {
        this.mensajes.push(r.data);
        this.texto = '';
        this.fotoPreview = null;
        this.enviando = false;
        this.scrollAbajo();
      },
      error: async () => {
        this.enviando = false;
        const t = await this.toast.create({ message: 'No se pudo enviar', duration: 1800, color: 'danger' });
        await t.present();
      },
    });
  }

  adjuntarFoto() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;
      if (file.size > 4 * 1024 * 1024) {
        this.toast.create({ message: 'La imagen es muy grande (máx 4 MB)', duration: 2000, color: 'warning' }).then(t => t.present());
        return;
      }
      const reader = new FileReader();
      reader.onload = () => { this.fotoPreview = reader.result as string; };
      reader.readAsDataURL(file);
    };
    input.click();
  }

  quitarFoto() { this.fotoPreview = null; }

  llamar() { if (this.contacto?.telefono) window.open(`tel:${this.contacto.telefono}`, '_self'); }
  whatsapp() { if (this.contacto?.telefono) abrirWhatsApp(this.contacto.telefono, ''); }

  private scrollAbajo() { setTimeout(() => this.content?.scrollToBottom(150), 80); }

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
