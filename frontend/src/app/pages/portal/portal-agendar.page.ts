import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
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
  sugiriendo = false;
  horaLlenaMsg = false;
  editId: number | null = null;   // si está seteado, la pantalla edita esa cita

  constructor(
    private portal: PortalService,
    private route: ActivatedRoute,
    private router: Router,
    private loading: LoadingController,
    private toast: ToastController
  ) {}

  ngOnInit() {
    this.cargarMotos();
    const id = this.route.snapshot.paramMap.get('id');
    if (id) this.cargarParaEditar(+id);
  }
  ionViewWillEnter() { this.cargarMotos(); }

  cargarMotos() { this.portal.getMotos().subscribe(r => this.motos = r.data); }

  // Modo edición: precarga la cita y la disponibilidad de su fecha (sin borrar la hora).
  private cargarParaEditar(id: number) {
    this.portal.getCita(id).subscribe({
      next: r => {
        const c = r.data;
        if (c.estado !== 'agendado' || c.orden_id) {
          this.toastMsg('Esta cita ya no se puede editar', 'warning');
          this.router.navigate(['/portal/cita', id], { replaceUrl: true });
          return;
        }
        this.editId = id;
        this.form = {
          moto_id: c.moto_id ?? null,
          tipo_servicio: c.tipo_servicio || '',
          fecha: String(c.fecha).slice(0, 10),
          hora: String(c.hora || '').slice(0, 5),
          descripcion: (c.motivo && c.motivo !== c.tipo_servicio) ? c.motivo : '',
        };
        if (this.form.fecha) {
          this.portal.getDisponibilidad(this.form.fecha).subscribe(d => {
            this.ocupacion = d.data.ocupacion || {};
            this.maxPorHora = d.data.max || 2;
          });
        }
      },
      error: () => { this.toastMsg('No se pudo cargar la cita', 'danger'); this.router.navigate(['/portal/mis-citas']); },
    });
  }

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

  // Sugiere el próximo horario libre: precarga fecha + hora listos para confirmar.
  sugerir() {
    if (this.sugiriendo) return;
    this.sugiriendo = true;
    this.portal.getProximoLibre().subscribe({
      next: r => {
        if (!r.data) {
          this.sugiriendo = false;
          this.toastMsg('No hay horarios libres en los próximos días', 'warning');
          return;
        }
        const { fecha, hora } = r.data;
        this.form.fecha = fecha;
        // Carga la disponibilidad de ese día y deja la hora seleccionada.
        this.portal.getDisponibilidad(fecha).subscribe({
          next: d => {
            this.ocupacion = d.data.ocupacion || {};
            this.maxPorHora = d.data.max || 2;
            this.form.hora = hora;
            this.sugiriendo = false;
            this.toastMsg('Listo: te sugerimos el próximo horario libre');
          },
          error: () => { this.sugiriendo = false; this.form.hora = hora; },
        });
      },
      error: () => { this.sugiriendo = false; this.toastMsg('No se pudo sugerir un horario', 'danger'); },
    });
  }

  // Selección desde la grilla de horas: ignora las llenas y avisa brevemente.
  seleccionarHora(h: string) {
    if (this.horaLlena(h)) {
      this.horaLlenaMsg = true;
      setTimeout(() => (this.horaLlenaMsg = false), 2500);
      return;
    }
    this.form.hora = h;
  }

  // Moto seleccionada (para el preview con foto bajo el selector).
  get motoSel(): any { return this.motos.find(m => m.id === this.form.moto_id) || null; }
  irAMotos() { this.router.navigate(['/portal/motos']); }

  get valido(): boolean {
    return !!(this.form.moto_id && this.form.tipo_servicio && this.form.fecha && this.form.hora);
  }

  async agendar() {
    if (!this.valido) return this.toastMsg('Completá moto, servicio, fecha y hora', 'warning');
    if (this.horaLlena(this.form.hora)) return this.toastMsg('Esa hora ya no está disponible', 'warning');
    const editando = this.editId;
    const l = await this.loading.create({ message: editando ? 'Guardando...' : 'Agendando...' });
    await l.present();
    this.enviando = true;
    const datos = {
      moto_id: this.form.moto_id!,
      tipo_servicio: this.form.tipo_servicio,
      fecha: this.form.fecha,
      hora: this.form.hora,
      descripcion: this.form.descripcion.trim() || undefined,
    };
    const op = editando ? this.portal.editarCita(editando, datos) : this.portal.crearCita(datos);
    op.subscribe({
      next: async () => {
        await l.dismiss(); this.enviando = false;
        this.toastMsg(editando ? 'Cita actualizada' : '¡Cita agendada!');
        this.form = { moto_id: null, tipo_servicio: '', fecha: '', hora: '', descripcion: '' };
        this.editId = null;
        this.router.navigate(editando ? ['/portal/cita', editando] : ['/portal/mis-citas']);
      },
      error: async (err) => {
        await l.dismiss(); this.enviando = false;
        this.toastMsg(err.error?.error || (editando ? 'No se pudo actualizar' : 'No se pudo agendar'), 'danger');
        if (this.form.fecha) this.onFecha(); // refresca cupos
      },
    });
  }

  private async toastMsg(message: string, color = 'success') {
    const t = await this.toast.create({ message, duration: 2600, color });
    await t.present();
  }
}
