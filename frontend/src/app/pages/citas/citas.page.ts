import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AlertController, ToastController } from '@ionic/angular';
import { CitasService } from '../../services/citas.service';
import { Cita } from '../../models/cita.model';

@Component({ standalone: false,
  selector: 'app-citas',
  templateUrl: './citas.page.html',
  styleUrls: ['./citas.page.scss'],
})
export class CitasPage implements OnInit {
  citas: Cita[] = [];
  cargando = true;
  filtroEstado = '';
  fechaHoy = new Date().toISOString().split('T')[0];

  constructor(
    private citaSvc: CitasService,
    private router: Router,
    private alert: AlertController,
    private toast: ToastController
  ) {}

  ngOnInit() { this.cargar(); }
  ionViewWillEnter() { this.cargar(); }

  cargar() {
    this.cargando = true;
    const params: any = {};
    if (this.filtroEstado) params.estado = this.filtroEstado;
    this.citaSvc.getAll(params).subscribe({
      next: res => { this.citas = res.data; this.cargando = false; },
      error: () => { this.cargando = false; },
    });
  }

  nuevaCita() { this.router.navigate(['/cita-form']); }
  editarCita(id: number) { this.router.navigate(['/cita-form', id]); }

  async cambiarEstado(cita: Cita, estado: string) {
    this.citaSvc.cambiarEstado(cita.id!, estado).subscribe({
      next: async () => {
        cita.estado = estado as any;
        const t = await this.toast.create({ message: 'Estado actualizado', duration: 1500, color: 'success' });
        await t.present();
      },
    });
  }
}
