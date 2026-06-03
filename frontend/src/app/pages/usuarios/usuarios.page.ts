import { Component, OnInit } from '@angular/core';
import { AlertController, ToastController } from '@ionic/angular';
import { UsuariosService } from '../../services/usuarios.service';
import { Usuario } from '../../models/usuario.model';

@Component({ standalone: false,
  selector: 'app-usuarios',
  templateUrl: './usuarios.page.html',
  styleUrls: ['./usuarios.page.scss'],
})
export class UsuariosPage implements OnInit {
  usuarios: Usuario[] = [];
  cargando = true;
  mostrarForm = false;
  nuevoUsuario = { nombre: '', email: '', password: '', rol: 'tecnico' };

  constructor(
    private usuarioSvc: UsuariosService,
    private alert: AlertController,
    private toast: ToastController
  ) {}

  ngOnInit() { this.cargar(); }

  cargar() {
    this.cargando = true;
    this.usuarioSvc.getAll().subscribe({
      next: res => { this.usuarios = res.data; this.cargando = false; },
      error: () => { this.cargando = false; },
    });
  }

  async crear() {
    this.usuarioSvc.create(this.nuevoUsuario).subscribe({
      next: async () => {
        this.mostrarForm = false;
        this.nuevoUsuario = { nombre: '', email: '', password: '', rol: 'tecnico' };
        this.cargar();
        const t = await this.toast.create({ message: 'Usuario creado', duration: 2000, color: 'success' });
        await t.present();
      },
      error: async (err) => {
        const a = await this.alert.create({ header: 'Error', message: err.error?.error || 'Error al crear', buttons: ['OK'] });
        await a.present();
      },
    });
  }

  async toggleActivo(u: Usuario) {
    this.usuarioSvc.toggleActivo(u.id!, !u.activo).subscribe({
      next: () => { u.activo = u.activo ? 0 : 1; },
    });
  }
}
