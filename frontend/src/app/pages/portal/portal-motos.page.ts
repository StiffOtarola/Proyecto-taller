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
  editandoId: number | null = null;
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
    this.editandoId = null;
    this.nueva = { marca: '', modelo: '', placa: '', anio: null, color: '', kilometraje: null };
    this.mostrarForm = true;
  }

  editar(m: any) {
    this.editandoId = m.id;
    this.nueva = {
      marca: m.marca, modelo: m.modelo, placa: m.placa,
      anio: m.anio || null, color: m.color || '', kilometraje: m.kilometraje_actual || null,
    };
    this.mostrarForm = true;
  }

  cerrarForm() { this.mostrarForm = false; this.editandoId = null; }

  // Marca, modelo y placa son obligatorios.
  get valido(): boolean {
    return !!(this.nueva.marca.trim() && this.nueva.modelo.trim() && this.nueva.placa.trim());
  }

  guardar() {
    if (!this.valido) { this.mostrarToast('Marca, modelo y placa son obligatorios', 'warning'); return; }
    this.enviando = true;
    const datos = {
      marca: this.nueva.marca.trim(),
      modelo: this.nueva.modelo.trim(),
      placa: this.nueva.placa.trim().toUpperCase(),
      anio: this.nueva.anio || null,
      color: this.nueva.color.trim() || undefined,
      kilometraje_actual: this.nueva.kilometraje || 0,
    };
    const op = this.editandoId
      ? this.portal.editarMoto(this.editandoId, datos)
      : this.portal.crearMoto(datos);
    op.subscribe({
      next: res => {
        if (this.editandoId) {
          const i = this.motos.findIndex(m => m.id === this.editandoId);
          if (i >= 0) this.motos[i] = res.data;
          this.mostrarToast('Moto actualizada');
        } else {
          this.motos.unshift(res.data);
          this.mostrarToast('Moto registrada');
        }
        this.cerrarForm();
        this.enviando = false;
      },
      error: err => {
        this.enviando = false;
        this.mostrarToast(err.error?.error || 'No se pudo guardar la moto', 'danger');
      },
    });
  }

  private async mostrarToast(message: string, color = 'success') {
    const t = await this.toast.create({ message, duration: 2400, color });
    await t.present();
  }
}
