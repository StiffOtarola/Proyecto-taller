import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { ToastController } from '@ionic/angular';
import { PortalService } from '../../services/portal.service';

@Component({
  standalone: false,
  selector: 'app-portal-perfil',
  templateUrl: './portal-perfil.page.html',
  styleUrls: ['./portal-perfil.page.scss'],
})
export class PortalPerfilPage implements OnInit {
  perfil: any = null;
  cuenta = { nombre: '', apellido: '', telefono: '', email: '' };
  pass = { actual: '', nueva: '', confirmar: '' };
  notificaciones: any[] = [];
  cargando = true;
  guardando = false;
  guardandoPass = false;

  constructor(
    public portal: PortalService,
    private router: Router,
    private toast: ToastController,
  ) {}

  ngOnInit() { this.cargar(); }
  ionViewWillEnter() { this.cargar(); }

  cargar() {
    this.cargando = true;
    this.portal.getMiPerfil().subscribe({
      next: r => {
        this.perfil = r.data;
        this.cuenta = {
          nombre: r.data.nombre || '',
          apellido: r.data.apellido || '',
          telefono: r.data.telefono || '',
          email: r.data.email || '',
        };
        this.cargando = false;
      },
      error: () => { this.cargando = false; this.aviso('No se pudo cargar el perfil', 'danger'); },
    });
    this.portal.getNotificaciones().subscribe({
      next: r => { this.notificaciones = r.data; },
    });
  }

  get iniciales(): string {
    const n = (this.cuenta.nombre || '').trim()[0] || '';
    const a = (this.cuenta.apellido || '').trim()[0] || '';
    return (n + a).toUpperCase() || 'U';
  }

  hace(fecha: string): string {
    if (!fecha) return '';
    const min = Math.round((Date.now() - new Date(fecha).getTime()) / 60000);
    if (min < 1) return 'Recién';
    if (min < 60) return `Hace ${min} min`;
    const h = Math.round(min / 60);
    if (h < 24) return `Hace ${h} h`;
    return `Hace ${Math.round(h / 24)} d`;
  }

  guardarCuenta() {
    if (!this.cuenta.nombre.trim() || !this.cuenta.apellido.trim()) { this.aviso('Nombre y apellido son requeridos', 'warning'); return; }
    if (!this.cuenta.email.trim()) { this.aviso('El correo es requerido', 'warning'); return; }
    this.guardando = true;
    this.portal.updateMiPerfil({
      nombre: this.cuenta.nombre.trim(),
      apellido: this.cuenta.apellido.trim(),
      telefono: this.cuenta.telefono.trim(),
      email: this.cuenta.email.trim(),
    }).subscribe({
      next: r => {
        this.perfil = r.data;
        // Refleja el nombre en el saludo del inicio.
        this.portal.actualizarClienteLocal({ nombre: r.data.nombre, apellido: r.data.apellido });
        this.guardando = false;
        this.aviso('Perfil actualizado');
      },
      error: (e) => { this.guardando = false; this.aviso(e.error?.error || 'No se pudo actualizar', 'danger'); },
    });
  }

  cambiarPassword() {
    if (!this.pass.actual || !this.pass.nueva) { this.aviso('Completá la contraseña actual y la nueva', 'warning'); return; }
    if (this.pass.nueva.length < 6) { this.aviso('La nueva debe tener al menos 6 caracteres', 'warning'); return; }
    if (this.pass.nueva !== this.pass.confirmar) { this.aviso('Las contraseñas nuevas no coinciden', 'warning'); return; }
    this.guardandoPass = true;
    this.portal.updateMiPassword({ actual: this.pass.actual, nueva: this.pass.nueva }).subscribe({
      next: () => { this.guardandoPass = false; this.pass = { actual: '', nueva: '', confirmar: '' }; this.aviso('Contraseña actualizada'); },
      error: (e) => { this.guardandoPass = false; this.aviso(e.error?.error || 'No se pudo cambiar', 'danger'); },
    });
  }

  logout() {
    this.portal.logout();
    this.router.navigate(['/portal/login'], { replaceUrl: true });
  }

  private async aviso(message: string, color = 'success') {
    const t = await this.toast.create({ message, duration: 1800, color });
    await t.present();
  }
}
