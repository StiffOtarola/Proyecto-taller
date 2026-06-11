import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AlertController, ToastController } from '@ionic/angular';
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
  notificaciones: any[] = [];
  cargando = true;
  guardando = false;
  eliminando = false;

  constructor(
    public portal: PortalService,
    private router: Router,
    private toast: ToastController,
    private alert: AlertController,
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

  async eliminarCuenta() {
    const al = await this.alert.create({
      header: 'Eliminar cuenta',
      message: 'Se desactivará tu acceso al portal y se cerrará la sesión. Tu historial de servicios queda en el taller. ¿Querés continuar?',
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        { text: 'Eliminar', role: 'destructive', handler: () => this.confirmarEliminar() },
      ],
    });
    await al.present();
  }

  private confirmarEliminar() {
    if (this.eliminando) return;
    this.eliminando = true;
    this.portal.eliminarCuenta().subscribe({
      next: async () => {
        await this.aviso('Tu cuenta fue eliminada');
        this.portal.logout();
        this.router.navigate(['/portal/login'], { replaceUrl: true });
      },
      error: (e) => { this.eliminando = false; this.aviso(e.error?.error || 'No se pudo eliminar la cuenta', 'danger'); },
    });
  }

  // Al tocar una notificación: si está ligada a una cita, abre su detalle.
  abrirNotificacion(n: any) {
    if (n?.cita_id) this.router.navigate(['/portal/cita', n.cita_id]);
    else this.router.navigate(['/portal/mis-citas']);
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
