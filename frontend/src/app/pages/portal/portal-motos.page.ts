import { Component, OnInit } from '@angular/core';
import { ToastController } from '@ionic/angular';
import { PortalService } from '../../services/portal.service';

@Component({
  standalone: false,
  selector: 'app-portal-motos',
  templateUrl: './portal-motos.page.html',
  styleUrls: ['./portal-motos.page.scss'],
})
export class PortalMotosPage implements OnInit {
  motos: any[] = [];
  cargando = true;

  mostrarForm = false;
  enviando = false;
  nueva = { marca: '', modelo: '', placa: '', anio: null as number | null, color: '', kilometraje: null as number | null };

  constructor(private portal: PortalService, private toast: ToastController) {}

  ngOnInit() { this.cargar(); }
  ionViewWillEnter() { this.cargar(); }

  cargar() {
    this.cargando = true;
    this.portal.getMotos().subscribe({
      next: res => { this.motos = res.data; this.cargando = false; },
      error: () => { this.cargando = false; },
    });
  }

  abrirForm() {
    this.nueva = { marca: '', modelo: '', placa: '', anio: null, color: '', kilometraje: null };
    this.mostrarForm = true;
  }

  // Marca, modelo y placa son obligatorios.
  get valido(): boolean {
    return !!(this.nueva.marca.trim() && this.nueva.modelo.trim() && this.nueva.placa.trim());
  }

  agregar() {
    if (!this.valido) { this.mostrarToast('Marca, modelo y placa son obligatorios', 'warning'); return; }
    this.enviando = true;
    this.portal.crearMoto({
      marca: this.nueva.marca.trim(),
      modelo: this.nueva.modelo.trim(),
      placa: this.nueva.placa.trim().toUpperCase(),
      anio: this.nueva.anio || null,
      color: this.nueva.color.trim() || undefined,
      kilometraje_actual: this.nueva.kilometraje || 0,
    }).subscribe({
      next: res => {
        this.motos.unshift(res.data);
        this.mostrarForm = false;
        this.enviando = false;
        this.mostrarToast('Moto registrada');
      },
      error: err => {
        this.enviando = false;
        this.mostrarToast(err.error?.error || 'No se pudo registrar la moto', 'danger');
      },
    });
  }

  private async mostrarToast(message: string, color = 'success') {
    const t = await this.toast.create({ message, duration: 2400, color });
    await t.present();
  }
}
