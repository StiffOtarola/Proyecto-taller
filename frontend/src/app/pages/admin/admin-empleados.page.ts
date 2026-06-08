import { Component, OnInit } from '@angular/core';
import { ToastController } from '@ionic/angular';
import { UsuariosService } from '../../services/usuarios.service';
import { Usuario } from '../../models/usuario.model';

@Component({
  standalone: false,
  selector: 'app-admin-empleados',
  templateUrl: './admin-empleados.page.html',
})
export class AdminEmpleadosPage implements OnInit {
  usuarios: Usuario[] = [];
  cargando = true;
  creando = false;
  nuevo = { nombre: '', email: '', password: '', rol: 'tecnico', telefono: '' };

  readonly rolLabel: Record<string, string> = {
    tecnico: '🔧 Mecánico', recepcion: '🗂 Recepcionista', admin: 'Administración',
  };

  constructor(private svc: UsuariosService, private toast: ToastController) {}

  ngOnInit() { this.cargar(); }
  ionViewWillEnter() { this.cargar(); }

  cargar() {
    this.cargando = true;
    this.svc.getAll().subscribe({
      next: r => { this.usuarios = r.data; this.cargando = false; },
      error: () => { this.cargando = false; },
    });
  }

  get valido(): boolean {
    return !!(this.nuevo.nombre.trim() && this.nuevo.email.trim() && this.nuevo.password && this.nuevo.rol);
  }

  crear() {
    if (!this.valido) { this.aviso('Completá nombre, email, contraseña y rol', 'warning'); return; }
    this.creando = true;
    this.svc.create({
      nombre: this.nuevo.nombre.trim(),
      email: this.nuevo.email.trim(),
      password: this.nuevo.password,
      rol: this.nuevo.rol,
      telefono: this.nuevo.telefono.trim() || undefined,
    }).subscribe({
      next: () => {
        this.creando = false;
        this.nuevo = { nombre: '', email: '', password: '', rol: 'tecnico', telefono: '' };
        this.cargar();
        this.aviso('Empleado creado');
      },
      error: (err) => { this.creando = false; this.aviso(err.error?.error || 'No se pudo crear', 'danger'); },
    });
  }

  toggle(u: Usuario) {
    this.svc.toggleActivo(u.id!, !u.activo).subscribe({ next: () => { u.activo = u.activo ? 0 : 1; } });
  }

  iniciales(n?: string): string {
    const p = (n || '?').trim().split(/\s+/);
    return ((p[0]?.[0] || '') + (p[1]?.[0] || '')).toUpperCase();
  }
  avatarColor(rol?: string): string { return rol === 'recepcion' ? 'am' : (rol === 'tecnico' ? 'in' : ''); }

  private async aviso(message: string, color = 'success') {
    const t = await this.toast.create({ message, duration: 1800, color });
    await t.present();
  }
}
