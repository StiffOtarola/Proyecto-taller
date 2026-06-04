import { Component, OnInit } from '@angular/core';
import { ToastController } from '@ionic/angular';
import { PortalService } from '../../services/portal.service';

@Component({
  standalone: false,
  selector: 'app-portal-citas',
  templateUrl: './portal-citas.page.html',
  styleUrls: ['./portal-citas.page.scss'],
})
export class PortalCitasPage implements OnInit {
  citas: any[] = [];
  motos: any[] = [];
  cargando = true;

  mostrarForm = false;
  enviando = false;
  hoy = new Date().toISOString().slice(0, 10);
  nueva = { moto_id: null as number | null, fecha: '', hora: '', motivo: '' };

  readonly estadoColor: Record<string, string> = {
    pendiente: 'warning',
    confirmada: 'success',
    cancelada: 'danger',
    completada: 'medium',
  };
  readonly estadoLabel: Record<string, string> = {
    pendiente: 'Pendiente',
    confirmada: 'Confirmada',
    cancelada: 'Cancelada',
    completada: 'Completada',
  };

  constructor(private portal: PortalService, private toast: ToastController) {}

  ngOnInit() { this.cargar(); }
  ionViewWillEnter() { this.cargar(); }

  cargar() {
    this.cargando = true;
    this.portal.getCitas().subscribe({
      next: res => { this.citas = res.data; this.cargando = false; },
      error: () => { this.cargando = false; },
    });
    this.portal.getMotos().subscribe(res => this.motos = res.data);
  }

  abrirForm() {
    this.nueva = { moto_id: null, fecha: '', hora: '', motivo: '' };
    this.mostrarForm = true;
  }

  get valido(): boolean {
    return !!this.nueva.fecha && !!this.nueva.hora && !!this.nueva.motivo.trim();
  }

  solicitar() {
    if (!this.valido) return;
    this.enviando = true;
    this.portal.crearCita(this.nueva).subscribe({
      next: res => {
        this.citas.unshift(res.data);
        this.mostrarForm = false;
        this.enviando = false;
        this.mostrarToast('Solicitud enviada. El taller la confirmará.');
      },
      error: err => {
        this.enviando = false;
        this.mostrarToast(err.error?.error || 'No se pudo enviar', 'danger');
      },
    });
  }

  private async mostrarToast(message: string, color = 'success') {
    const t = await this.toast.create({ message, duration: 2400, color });
    await t.present();
  }
}
