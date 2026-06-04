import { Component, OnInit } from '@angular/core';
import { AlertController, ToastController } from '@ionic/angular';
import { PromosService, Promo } from '../../services/promos.service';

@Component({
  standalone: false,
  selector: 'app-promos',
  templateUrl: './promos.page.html',
  styleUrls: ['./promos.page.scss'],
})
export class PromosPage implements OnInit {
  promos: Promo[] = [];
  cargando = true;

  mostrarForm = false;
  nueva: Promo = { titulo: '', descripcion: '', descuento: 0, activa: 1 };

  constructor(
    private promosSvc: PromosService,
    private alert: AlertController,
    private toast: ToastController
  ) {}

  ngOnInit() { this.cargar(); }
  ionViewWillEnter() { this.cargar(); }

  cargar() {
    this.cargando = true;
    this.promosSvc.getAll().subscribe({
      next: res => { this.promos = res.data; this.cargando = false; },
      error: () => { this.cargando = false; },
    });
  }

  abrirForm() {
    this.nueva = { titulo: '', descripcion: '', descuento: 0, activa: 1 };
    this.mostrarForm = true;
  }

  get valido(): boolean {
    return !!this.nueva.titulo.trim() && !!this.nueva.descripcion.trim();
  }

  crear() {
    if (!this.valido) return;
    this.promosSvc.create(this.nueva).subscribe({
      next: res => {
        this.promos.unshift(res.data);
        this.mostrarForm = false;
        this.mostrarToast('Promoción creada');
      },
      error: err => this.mostrarToast(err.error?.error || 'Error', 'danger'),
    });
  }

  toggle(p: Promo) {
    this.promosSvc.toggle(p.id!).subscribe({
      next: res => { p.activa = res.data.activa; },
      error: err => this.mostrarToast(err.error?.error || 'Error', 'danger'),
    });
  }

  async eliminar(p: Promo) {
    const conf = await this.alert.create({
      header: 'Eliminar promoción',
      message: `¿Eliminar "${p.titulo}"?`,
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Eliminar', role: 'destructive',
          handler: () => {
            this.promosSvc.delete(p.id!).subscribe({
              next: () => { this.promos = this.promos.filter(x => x.id !== p.id); this.mostrarToast('Eliminada'); },
            });
          },
        },
      ],
    });
    await conf.present();
  }

  private async mostrarToast(message: string, color = 'success') {
    const t = await this.toast.create({ message, duration: 2000, color });
    await t.present();
  }
}
