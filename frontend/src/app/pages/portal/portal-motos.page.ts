import { Component, OnInit } from '@angular/core';
import { AlertController, ToastController } from '@ionic/angular';
import { PortalService } from '../../services/portal.service';
import { MARCAS_MOTO, modelosDeMarca } from '../../utils/motos-catalogo';

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

  // Autocompletado de marca/modelo (catálogo local, no restrictivo).
  marcasSugeridas: string[] = [];
  modelosSugeridos: string[] = [];

  constructor(private portal: PortalService, private toast: ToastController, private alert: AlertController) {}

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
    this.marcasSugeridas = [];
    this.modelosSugeridos = [];
    this.mostrarForm = true;
  }

  editar(m: any) {
    this.editandoId = m.id;
    this.nueva = {
      marca: m.marca, modelo: m.modelo, placa: m.placa,
      anio: m.anio || null, color: m.color || '', kilometraje: m.kilometraje_actual || null,
    };
    this.marcasSugeridas = [];
    this.modelosSugeridos = [];
    this.mostrarForm = true;
  }

  cerrarForm() { this.mostrarForm = false; this.editandoId = null; this.marcasSugeridas = []; this.modelosSugeridos = []; }

  // —— Autocompletado de marca ——
  onMarcaInput() {
    const q = this.nueva.marca.trim().toLowerCase();
    this.marcasSugeridas = q ? MARCAS_MOTO.filter(m => m.toLowerCase().includes(q)).slice(0, 8) : [];
  }
  seleccionarMarca(m: string) {
    this.nueva.marca = m;
    this.marcasSugeridas = [];
    // Al cambiar de marca, el modelo previo deja de aplicar.
    this.nueva.modelo = '';
    this.modelosSugeridos = [];
  }

  // —— Autocompletado de modelo, filtrado por la marca elegida ——
  onModeloFocus() {
    if (!this.nueva.modelo.trim()) this.modelosSugeridos = modelosDeMarca(this.nueva.marca).slice(0, 8);
  }
  onModeloInput() {
    const q = this.nueva.modelo.trim().toLowerCase();
    const modelos = modelosDeMarca(this.nueva.marca);
    this.modelosSugeridos = (q ? modelos.filter(m => m.toLowerCase().includes(q)) : modelos).slice(0, 8);
  }
  seleccionarModelo(m: string) {
    this.nueva.modelo = m;
    this.modelosSugeridos = [];
  }

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

  async eliminar(m: any) {
    const al = await this.alert.create({
      header: 'Eliminar moto',
      message: `¿Querés eliminar tu ${m.marca} ${m.modelo} (${m.placa})? Dejará de aparecer en tu lista.`,
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        { text: 'Eliminar', role: 'destructive', handler: () => this.confirmarEliminar(m) },
      ],
    });
    await al.present();
  }

  private confirmarEliminar(m: any) {
    this.portal.eliminarMoto(m.id).subscribe({
      next: () => {
        this.motos = this.motos.filter(x => x.id !== m.id);
        if (this.editandoId === m.id) this.cerrarForm();
        this.mostrarToast('Moto eliminada');
      },
      error: err => this.mostrarToast(err.error?.error || 'No se pudo eliminar la moto', 'danger'),
    });
  }

  private async mostrarToast(message: string, color = 'success') {
    const t = await this.toast.create({ message, duration: 2400, color });
    await t.present();
  }
}
