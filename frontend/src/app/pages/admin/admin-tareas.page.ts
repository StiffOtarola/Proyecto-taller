import { Component, OnInit } from '@angular/core';
import { AlertController, ToastController } from '@ionic/angular';
import { AdminService } from '../../services/admin.service';
import { UsuariosService } from '../../services/usuarios.service';
import { Usuario } from '../../models/usuario.model';

@Component({
  standalone: false,
  selector: 'app-admin-tareas',
  templateUrl: './admin-tareas.page.html',
})
export class AdminTareasPage implements OnInit {
  tareas: any[] = [];
  tecnicos: Usuario[] = [];
  cargando = true;
  guardando = false;
  empleado: number | null = null; // filtro de la lista
  form: { tecnico_id: number | null; titulo: string; detalle: string; prioridad: string; vence: string } =
    { tecnico_id: null, titulo: '', detalle: '', prioridad: 'normal', vence: '' };

  readonly prioridades = [
    { v: 'baja', l: 'Baja' }, { v: 'normal', l: 'Normal' }, { v: 'alta', l: 'Alta' }, { v: 'urgente', l: 'Urgente' },
  ];
  readonly prioBadge: Record<string, string> = { baja: 'bg-n', normal: 'bg-in', alta: 'bg-am', urgente: 'bg-rd' };

  constructor(
    private admin: AdminService, private usuarios: UsuariosService,
    private toast: ToastController, private alert: AlertController,
  ) {}

  ngOnInit() {
    this.usuarios.getAll().subscribe({
      next: r => { this.tecnicos = (r.data || []).filter(u => u.rol === 'tecnico' && u.activo); },
    });
    this.cargar();
  }
  ionViewWillEnter() { this.cargar(); }

  cargar(ev?: any) {
    this.cargando = true;
    this.admin.getTareas(this.empleado).subscribe({
      next: r => { this.tareas = r.data; this.cargando = false; if (ev) ev.target.complete(); },
      error: () => { this.cargando = false; if (ev) ev.target.complete(); },
    });
  }

  get total(): number { return this.tareas.length; }
  get hechas(): number { return this.tareas.filter(t => t.hecha).length; }

  asignar() {
    if (!this.form.tecnico_id) { this.aviso('Elegí un mecánico', 'warning'); return; }
    if (!this.form.titulo.trim()) { this.aviso('Escribí un título', 'warning'); return; }
    this.guardando = true;
    this.admin.crearTarea({
      tecnico_id: this.form.tecnico_id,
      titulo: this.form.titulo.trim(),
      detalle: this.form.detalle.trim() || undefined,
      prioridad: this.form.prioridad,
      vence: this.form.vence || null,
    }).subscribe({
      next: () => {
        this.guardando = false;
        // Conserva el mecánico para asignar varias tareas seguidas.
        this.form = { tecnico_id: this.form.tecnico_id, titulo: '', detalle: '', prioridad: 'normal', vence: '' };
        this.cargar();
        this.aviso('Tarea asignada');
      },
      error: (err) => { this.guardando = false; this.aviso(err.error?.error || 'No se pudo asignar', 'danger'); },
    });
  }

  async borrar(t: any) {
    const al = await this.alert.create({
      header: 'Eliminar tarea',
      message: `¿Eliminar "${t.titulo}"? No se puede deshacer.`,
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        { text: 'Eliminar', role: 'destructive', handler: () => {
            this.admin.borrarTarea(t.id).subscribe({
              next: () => { this.tareas = this.tareas.filter(x => x.id !== t.id); this.aviso('Tarea eliminada'); },
              error: () => this.aviso('No se pudo eliminar', 'danger'),
            });
          } },
      ],
    });
    await al.present();
  }

  prioLabel(p: string): string { return (this.prioridades.find(x => x.v === p) || { l: p }).l; }
  vencida(t: any): boolean { return !t.hecha && !!t.vence && new Date(t.vence) < new Date(); }

  private async aviso(message: string, color = 'success') {
    const t = await this.toast.create({ message, duration: 1800, color });
    await t.present();
  }
}
