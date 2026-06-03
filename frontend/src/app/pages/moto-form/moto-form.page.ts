import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Location } from '@angular/common';
import { LoadingController, ToastController } from '@ionic/angular';
import { MotosService } from '../../services/motos.service';
import { Moto } from '../../models/moto.model';

@Component({ standalone: false,
  selector: 'app-moto-form',
  templateUrl: './moto-form.page.html',
  styleUrls: ['./moto-form.page.scss'],
})
export class MotoFormPage implements OnInit {
  esEdicion = false;
  motoId: number | null = null;

  form: Moto = {
    cliente_id: 0, marca: '', modelo: '',
    anio: null, placa: '', color: '',
    numero_motor: '', numero_chasis: '', kilometraje_actual: 0,
  };

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private location: Location,
    private motoSvc: MotosService,
    private loading: LoadingController,
    private toast: ToastController
  ) {}

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    const clienteId = this.route.snapshot.queryParamMap.get('cliente_id');

    if (id) {
      this.esEdicion = true;
      this.motoId = +id;
      this.motoSvc.getById(+id).subscribe(res => this.form = res.data);
    } else if (clienteId) {
      this.form.cliente_id = +clienteId;
    }
  }

  async guardar() {
    const l = await this.loading.create({ message: 'Guardando...' });
    await l.present();
    const op = this.esEdicion
      ? this.motoSvc.update(this.motoId!, this.form)
      : this.motoSvc.create(this.form);
    op.subscribe({
      next: async () => {
        await l.dismiss();
        const t = await this.toast.create({ message: 'Moto guardada', duration: 2000, color: 'success' });
        await t.present();
        this.location.back();
      },
      error: async () => {
        await l.dismiss();
        const t = await this.toast.create({ message: 'Error al guardar', duration: 2000, color: 'danger' });
        await t.present();
      },
    });
  }
}
