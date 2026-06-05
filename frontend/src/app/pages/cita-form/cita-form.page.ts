import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { LoadingController, ToastController } from '@ionic/angular';
import { CitasService } from '../../services/citas.service';
import { ClientesService } from '../../services/clientes.service';
import { MotosService } from '../../services/motos.service';
import { DashboardService } from '../../services/dashboard.service';
import { AuthService } from '../../services/auth.service';
import { Cita } from '../../models/cita.model';
import { Cliente } from '../../models/cliente.model';
import { Moto } from '../../models/moto.model';

const TIPOS_SERVICIO = [
  'Mantenimiento preventivo', 'Cambio de aceite', 'Frenos', 'Llantas',
  'Sistema eléctrico', 'Afinamiento', 'Diagnóstico', 'Otro',
];

@Component({ standalone: false,
  selector: 'app-cita-form',
  templateUrl: './cita-form.page.html',
  styleUrls: ['./cita-form.page.scss'],
})
export class CitaFormPage implements OnInit {
  esEdicion = false;
  citaId: number | null = null;

  form: Cita = {
    cliente_id: 0, fecha: '', hora: '', motivo: '',
  };

  busquedaCliente = '';
  clientes: Cliente[] = [];
  motos: Moto[] = [];
  tecnicos: any[] = [];
  tiposServicio = TIPOS_SERVICIO;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private citaSvc: CitasService,
    private clienteSvc: ClientesService,
    private motoSvc: MotosService,
    private dashSvc: DashboardService,
    public auth: AuthService,
    private loading: LoadingController,
    private toast: ToastController
  ) {}

  ngOnInit() {
    // Lista de técnicos para asignar (solo jefe+ puede).
    if (this.auth.tieneRol('jefe_taller', 'admin', 'gerencia')) {
      this.dashSvc.getTecnicos().subscribe({ next: res => this.tecnicos = res.data });
    }
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.esEdicion = true;
      this.citaId = +id;
      this.citaSvc.getById(+id).subscribe(res => {
        this.form = res.data;
        this.busquedaCliente = `${res.data.cliente_nombre} ${res.data.cliente_apellido}`;
        if (res.data.cliente_id) {
          this.motoSvc.getAll({ cliente_id: res.data.cliente_id }).subscribe(r => this.motos = r.data);
        }
      });
    }
  }

  buscarClientes() {
    if (!this.busquedaCliente.trim()) { this.clientes = []; return; }
    this.clienteSvc.getAll(this.busquedaCliente).subscribe(res => this.clientes = res.data);
  }

  seleccionarCliente(c: Cliente) {
    this.form.cliente_id = c.id!;
    this.busquedaCliente = `${c.nombre} ${c.apellido}`;
    this.clientes = [];
    this.motoSvc.getAll({ cliente_id: c.id }).subscribe(res => this.motos = res.data);
  }

  async guardar() {
    const l = await this.loading.create({ message: 'Guardando...' });
    await l.present();
    const op = this.esEdicion
      ? this.citaSvc.update(this.citaId!, this.form)
      : this.citaSvc.create(this.form);
    op.subscribe({
      next: async () => {
        await l.dismiss();
        const t = await this.toast.create({ message: 'Cita guardada', duration: 2000, color: 'success' });
        await t.present();
        this.router.navigate(['/tabs/citas']);
      },
      error: async () => {
        await l.dismiss();
        const t = await this.toast.create({ message: 'Error al guardar', duration: 2000, color: 'danger' });
        await t.present();
      },
    });
  }
}
