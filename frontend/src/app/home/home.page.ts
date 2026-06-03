import { Component, OnInit } from '@angular/core';
import { AlertController, ToastController } from '@ionic/angular';
import { ItemsService } from '../services/items.service';
import { Item } from '../models/item.model';

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
  standalone: false,
})
export class HomePage implements OnInit {
  items: Item[] = [];
  cargando = false;
  error: string | null = null;

  // Modelo del formulario de alta/edicion
  form: Item = { nombre: '', descripcion: '' };
  editandoId: number | null = null;

  constructor(
    private itemsService: ItemsService,
    private alertCtrl: AlertController,
    private toastCtrl: ToastController
  ) {}

  ngOnInit() {
    this.cargar();
  }

  cargar() {
    this.cargando = true;
    this.error = null;
    this.itemsService.getAll().subscribe({
      next: (data) => {
        this.items = data;
        this.cargando = false;
      },
      error: () => {
        this.error = 'No se pudo conectar con la API. ¿Esta corriendo el backend?';
        this.cargando = false;
      },
    });
  }

  guardar() {
    if (!this.form.nombre.trim()) {
      this.toast('El nombre es obligatorio');
      return;
    }

    if (this.editandoId === null) {
      // Crear
      this.itemsService.create(this.form).subscribe({
        next: () => {
          this.toast('Item creado');
          this.resetForm();
          this.cargar();
        },
        error: () => this.toast('Error al crear'),
      });
    } else {
      // Actualizar
      this.itemsService.update(this.editandoId, this.form).subscribe({
        next: () => {
          this.toast('Item actualizado');
          this.resetForm();
          this.cargar();
        },
        error: () => this.toast('Error al actualizar'),
      });
    }
  }

  editar(item: Item) {
    this.editandoId = item.id ?? null;
    this.form = { nombre: item.nombre, descripcion: item.descripcion ?? '' };
  }

  async eliminar(item: Item) {
    const alert = await this.alertCtrl.create({
      header: 'Confirmar',
      message: `¿Eliminar "${item.nombre}"?`,
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Eliminar',
          role: 'destructive',
          handler: () => {
            this.itemsService.delete(item.id!).subscribe({
              next: () => {
                this.toast('Item eliminado');
                this.cargar();
              },
              error: () => this.toast('Error al eliminar'),
            });
          },
        },
      ],
    });
    await alert.present();
  }

  cancelarEdicion() {
    this.resetForm();
  }

  private resetForm() {
    this.form = { nombre: '', descripcion: '' };
    this.editandoId = null;
  }

  private async toast(mensaje: string) {
    const t = await this.toastCtrl.create({ message: mensaje, duration: 1800, position: 'bottom' });
    await t.present();
  }
}
