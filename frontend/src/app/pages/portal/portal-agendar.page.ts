import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { LoadingController, ToastController } from '@ionic/angular';
import { PortalService } from '../../services/portal.service';
import { SERVICIOS, HORAS } from '../../utils/servicios';

@Component({
  standalone: false,
  selector: 'app-portal-agendar',
  templateUrl: './portal-agendar.page.html',
  styleUrls: ['./portal-agendar.page.scss'],
})
export class PortalAgendarPage implements OnInit {
  readonly servicios = SERVICIOS;
  readonly horas = HORAS;
  motos: any[] = [];
  hoy = new Date().toISOString().slice(0, 10);

  form = { moto_id: null as number | null, tipo_servicio: '', fecha: '', hora: '', descripcion: '' };
  ocupacion: Record<string, number> = {};
  maxPorHora = 2;
  enviando = false;

  constructor(
    private portal: PortalService,
    private router: Router,
    private loading: LoadingController,
    private toast: ToastController
  ) {}

  ngOnInit() { this.cargarMotos(); }
  ionViewWillEnter() { this.cargarMotos(); }

  cargarMotos() { this.portal.getMotos().subscribe(r => this.motos = r.data); }

  // Al elegir fecha, consulta cupos para deshabilitar horas llenas.
  onFecha() {
    this.form.hora = '';
    if (!this.form.fecha) return;
    this.portal.getDisponibilidad(this.form.fecha).subscribe(r => {
      this.ocupacion = r.data.ocupacion || {};
      this.maxPorHora = r.data.max || 2;
    });
  }

  horaLlena(h: string): boolean {
    return (this.ocupacion[h] || 0) >= this.maxPorHora;
  }

  get valido(): boolean {
    return !!(this.form.moto_id && this.form.tipo_servicio && this.form.fecha && this.form.hora);
  }

  async agendar() {
    if (!this.valido) return this.toastMsg('Completá moto, servicio, fecha y hora', 'warning');
    if (this.horaLlena(this.form.hora)) return this.toastMsg('Esa hora ya no está disponible', 'warning');
    const l = await this.loading.create({ message: 'Agendando...' });
    await l.present();
    this.enviando = true;
    this.portal.crearCita({
      moto_id: this.form.moto_id!,
      tipo_servicio: this.form.tipo_servicio,
      fecha: this.form.fecha,
      hora: this.form.hora,
      descripcion: this.form.descripcion.trim() || undefined,
    }).subscribe({
      next: async () => {
        await l.dismiss(); this.enviando = false;
        this.toastMsg('¡Cita agendada!');
        this.form = { moto_id: null, tipo_servicio: '', fecha: '', hora: '', descripcion: '' };
        this.router.navigate(['/portal/mis-citas']);
      },
      error: async (err) => {
        await l.dismiss(); this.enviando = false;
        this.toastMsg(err.error?.error || 'No se pudo agendar', 'danger');
        if (this.form.fecha) this.onFecha(); // refresca cupos
      },
    });
  }

  private async toastMsg(message: string, color = 'success') {
    const t = await this.toast.create({ message, duration: 2600, color });
    await t.present();
  }
}
