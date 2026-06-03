import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AlertController, LoadingController, ToastController } from '@ionic/angular';
import { OrdenesService } from '../../services/ordenes.service';
import { UsuariosService } from '../../services/usuarios.service';
import { AuthService } from '../../services/auth.service';
import { Orden, OrdenAvance, OrdenRepuesto, EstadoOrden, ESTADO_CONFIG } from '../../models/orden.model';
import { Usuario } from '../../models/usuario.model';

@Component({ standalone: false,
  selector: 'app-detalle-orden',
  templateUrl: './detalle-orden.page.html',
  styleUrls: ['./detalle-orden.page.scss'],
})
export class DetalleOrdenPage implements OnInit {
  orden: Orden | null = null;
  avances: OrdenAvance[] = [];
  repuestos: OrdenRepuesto[] = [];
  tecnicos: Usuario[] = [];
  cargando = true;

  nuevoAvance = '';
  nuevoRepuesto: OrdenRepuesto = { nombre: '', cantidad: 1, costo_unitario: 0 };
  mostrarFormRepuesto = false;

  readonly estadosSiguientes: Record<EstadoOrden, EstadoOrden[]> = {
    recepcion:            ['diagnostico', 'cancelada'],
    diagnostico:          ['esperando_aprobacion', 'en_reparacion', 'cancelada'],
    esperando_aprobacion: ['esperando_repuestos', 'en_reparacion', 'cancelada'],
    esperando_repuestos:  ['en_reparacion', 'cancelada'],
    en_reparacion:        ['lista_entrega', 'cancelada'],
    lista_entrega:        ['entregada'],
    entregada:            [],
    cancelada:            [],
  };

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private ordenSvc: OrdenesService,
    private usuarioSvc: UsuariosService,
    public auth: AuthService,
    private alert: AlertController,
    private loading: LoadingController,
    private toast: ToastController
  ) {}

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) this.cargar(+id);
  }

  cargar(id: number) {
    this.cargando = true;
    this.ordenSvc.getById(id).subscribe(res => {
      this.orden = res.data;
      this.cargando = false;
    });
    this.ordenSvc.getAvances(id).subscribe(res => this.avances = res.data);
    this.ordenSvc.getRepuestos(id).subscribe(res => this.repuestos = res.data);
    this.usuarioSvc.getAll().subscribe(res => {
      this.tecnicos = res.data.filter(u => u.rol === 'tecnico' && u.activo);
    });
  }

  estadoLabel(e: string) { return ESTADO_CONFIG[e as EstadoOrden]?.label ?? e; }
  estadoColor(e: string) { return ESTADO_CONFIG[e as EstadoOrden]?.color ?? 'medium'; }

  get siguientes(): EstadoOrden[] {
    if (!this.orden?.estado) return [];
    const lista = this.estadosSiguientes[this.orden.estado] || [];
    if (!this.auth.tieneRol('admin', 'gerencia')) {
      return lista.filter(e => e !== 'cancelada');
    }
    return lista;
  }

  async cambiarEstado(estado: EstadoOrden) {
    const conf = await this.alert.create({
      header: 'Cambiar estado',
      message: `¿Cambiar a "${this.estadoLabel(estado)}"?`,
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        { text: 'Confirmar', handler: () => this.ejecutarCambioEstado(estado) },
      ],
    });
    await conf.present();
  }

  private async ejecutarCambioEstado(estado: EstadoOrden) {
    const l = await this.loading.create({ message: 'Cambiando estado...' });
    await l.present();
    this.ordenSvc.cambiarEstado(this.orden!.id!, estado).subscribe({
      next: async () => {
        await l.dismiss();
        this.cargar(this.orden!.id!);
        this.mostrarToast('Estado actualizado');
      },
      error: async (err) => {
        await l.dismiss();
        this.mostrarAlertError(err.error?.error);
      },
    });
  }

  async asignarTecnico(tecnico_id: number) {
    this.ordenSvc.asignarTecnico(this.orden!.id!, tecnico_id).subscribe({
      next: () => { this.cargar(this.orden!.id!); this.mostrarToast('Técnico asignado'); },
    });
  }

  agregarAvance() {
    if (!this.nuevoAvance.trim()) return;
    this.ordenSvc.addAvance(this.orden!.id!, this.nuevoAvance).subscribe({
      next: res => {
        this.avances.push(res.data);
        this.nuevoAvance = '';
        this.mostrarToast('Avance registrado');
      },
    });
  }

  agregarRepuesto() {
    if (!this.nuevoRepuesto.nombre.trim()) return;
    this.ordenSvc.addRepuesto(this.orden!.id!, this.nuevoRepuesto).subscribe({
      next: res => {
        this.repuestos.push(res.data);
        this.nuevoRepuesto = { nombre: '', cantidad: 1, costo_unitario: 0 };
        this.mostrarFormRepuesto = false;
        this.cargar(this.orden!.id!);
        this.mostrarToast('Repuesto agregado');
      },
    });
  }

  async eliminarRepuesto(r: OrdenRepuesto) {
    const conf = await this.alert.create({
      header: 'Eliminar repuesto',
      message: `¿Eliminar "${r.nombre}"?`,
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Eliminar',
          handler: () => {
            this.ordenSvc.deleteRepuesto(this.orden!.id!, r.id!).subscribe({
              next: () => {
                this.repuestos = this.repuestos.filter(x => x.id !== r.id);
                this.cargar(this.orden!.id!);
              },
            });
          },
        },
      ],
    });
    await conf.present();
  }

  get totalRepuestos() {
    return this.repuestos.reduce((s, r) => s + r.cantidad * r.costo_unitario, 0);
  }

  get totalOrden() {
    if (!this.orden) return 0;
    return (this.orden.costo_mano_obra || 0) + this.totalRepuestos - (this.orden.descuento || 0);
  }

  private async mostrarToast(msg: string) {
    const t = await this.toast.create({ message: msg, duration: 2000, color: 'success' });
    await t.present();
  }

  private async mostrarAlertError(msg?: string) {
    const a = await this.alert.create({ header: 'Error', message: msg || 'Ocurrió un error', buttons: ['OK'] });
    await a.present();
  }

  volver() { this.router.navigate(['/tabs/ordenes']); }
}
