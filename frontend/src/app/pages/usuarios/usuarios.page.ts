import { Component, OnDestroy, OnInit } from '@angular/core';
import { AlertController, ToastController } from '@ionic/angular';
import { UsuariosService } from '../../services/usuarios.service';
import { Usuario } from '../../models/usuario.model';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

@Component({ standalone: false,
  selector: 'app-usuarios',
  templateUrl: './usuarios.page.html',
  styleUrls: ['./usuarios.page.scss'],
})
export class UsuariosPage implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  usuarios: Usuario[] = [];
  cargando = true;
  mostrarForm = false;
  nuevoUsuario = { nombre: '', email: '', password: '', rol: 'tecnico', telefono: '' };

  constructor(
    private usuarioSvc: UsuariosService,
    private alert: AlertController,
    private toast: ToastController
  ) {}

  ngOnInit() { this.cargar(); }

  ngOnDestroy() { this.destroy$.next(); this.destroy$.complete(); }

  cargar() {
    this.cargando = true;
    this.usuarioSvc.getAll().pipe(takeUntil(this.destroy$)).subscribe({
      next: res => { this.usuarios = res.data; this.cargando = false; },
      error: () => { this.cargando = false; },
    });
  }

  async crear() {
    this.usuarioSvc.create(this.nuevoUsuario).pipe(takeUntil(this.destroy$)).subscribe({
      next: async () => {
        this.mostrarForm = false;
        this.nuevoUsuario = { nombre: '', email: '', password: '', rol: 'tecnico', telefono: '' };
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

  // Editar nombre y teléfono (el teléfono habilita los botones de Contacto del mecánico).
  async editar(u: Usuario) {
    const a = await this.alert.create({
      header: 'Editar usuario',
      subHeader: u.email,
      inputs: [
        { name: 'nombre', value: u.nombre, placeholder: 'Nombre' },
        { name: 'telefono', value: u.telefono || '', type: 'tel', placeholder: 'Teléfono (ej. 8888-8888)' },
      ],
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Guardar',
          handler: (d) => {
            const nombre = (d?.nombre || '').trim();
            if (!nombre) return false;
            this.usuarioSvc.update(u.id!, { nombre, email: u.email, rol: u.rol, telefono: (d?.telefono || '').trim() }).pipe(takeUntil(this.destroy$)).subscribe({
              next: async () => {
                this.cargar();
                const t = await this.toast.create({ message: 'Usuario actualizado', duration: 1800, color: 'success' });
                await t.present();
              },
              error: async (err) => {
                const al = await this.alert.create({ header: 'Error', message: err.error?.error || 'No se pudo actualizar', buttons: ['OK'] });
                await al.present();
              },
            });
            return true;
          },
        },
      ],
    });
    await a.present();
  }

  async toggleActivo(u: Usuario) {
    this.usuarioSvc.toggleActivo(u.id!, !u.activo).pipe(takeUntil(this.destroy$)).subscribe({
      next: () => { u.activo = u.activo ? 0 : 1; },
    });
  }
}
