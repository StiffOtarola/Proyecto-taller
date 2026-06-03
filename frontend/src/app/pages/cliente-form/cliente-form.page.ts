import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Location } from '@angular/common';
import { LoadingController, ToastController } from '@ionic/angular';
import { ClientesService } from '../../services/clientes.service';
import { Cliente } from '../../models/cliente.model';

@Component({ standalone: false,
  selector: 'app-cliente-form',
  templateUrl: './cliente-form.page.html',
  styleUrls: ['./cliente-form.page.scss'],
})
export class ClienteFormPage implements OnInit {
  esEdicion = false;
  clienteId: number | null = null;

  form: Cliente = {
    nombre: '', apellido: '', telefono: '',
    email: '', cedula: '', direccion: '',
  };

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private location: Location,
    private clienteSvc: ClientesService,
    private loading: LoadingController,
    private toast: ToastController
  ) {}

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.esEdicion = true;
      this.clienteId = +id;
      this.clienteSvc.getById(+id).subscribe(res => { this.form = res.data; });
    }
  }

  async guardar() {
    const l = await this.loading.create({ message: 'Guardando...' });
    await l.present();
    const op = this.esEdicion
      ? this.clienteSvc.update(this.clienteId!, this.form)
      : this.clienteSvc.create(this.form);
    op.subscribe({
      next: async () => {
        await l.dismiss();
        const t = await this.toast.create({ message: 'Cliente guardado', duration: 2000, color: 'success' });
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
