import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AlertController, ToastController } from '@ionic/angular';
import { PortalService } from '../../services/portal.service';
import { AccesibilidadService } from '../../services/accesibilidad.service';
import { comprimirImagen } from '../../utils/imagen';

@Component({
  standalone: false,
  selector: 'app-portal-perfil',
  templateUrl: './portal-perfil.page.html',
  styleUrls: ['./portal-perfil.page.scss'],
})
export class PortalPerfilPage implements OnInit {
  perfil: any = null;
  cuenta = { nombre: '', apellido: '', telefono: '', email: '' };
  cargando = true;
  guardando = false;
  eliminando = false;
  subiendoFoto = false;

  // Visor (lightbox) de la foto de perfil con zoom.
  zoomAbierto = false;
  zoomActivo = false;

  constructor(
    public portal: PortalService,
    public a11y: AccesibilidadService,
    private router: Router,
    private toast: ToastController,
    private alert: AlertController,
  ) {}

  // Niveles de tamaño de texto (accesibilidad).
  readonly nivelesTexto = [
    { i: 0, etiqueta: 'A', nombre: 'Normal' },
    { i: 1, etiqueta: 'A', nombre: 'Grande' },
    { i: 2, etiqueta: 'A', nombre: 'Muy grande' },
  ];
  setTexto(i: number) { this.a11y.setNivel(i); }

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
  }

  get iniciales(): string {
    const n = (this.cuenta.nombre || '').trim()[0] || '';
    const a = (this.cuenta.apellido || '').trim()[0] || '';
    return (n + a).toUpperCase() || 'U';
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

  // —— Visor con zoom de la foto de perfil ——
  // Al tocar el avatar: si hay foto la abre en grande; si no, abre el selector.
  abrirAvatar(fileInput: HTMLInputElement) {
    if (this.perfil?.foto) this.abrirZoom();
    else fileInput.click();
  }
  abrirZoom() { this.zoomAbierto = true; this.zoomActivo = false; }
  cerrarZoom() { this.zoomAbierto = false; this.zoomActivo = false; }
  toggleZoom(ev: Event) { ev.stopPropagation(); this.zoomActivo = !this.zoomActivo; }

  // —— Foto de perfil ——
  async onFoto(ev: Event) {
    const input = ev.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = ''; // permite re-elegir el mismo archivo
    if (!file) return;
    this.subiendoFoto = true;
    try {
      const dataUrl = await comprimirImagen(file, { maxLado: 400, calidad: 0.8 });
      this.portal.actualizarFotoPerfil(dataUrl).subscribe({
        next: r => {
          this.perfil = { ...this.perfil, foto: r.data.foto };
          this.portal.actualizarClienteLocal({ foto: r.data.foto }); // refresca el avatar del header
          this.subiendoFoto = false;
          this.aviso('Foto actualizada');
        },
        error: e => { this.subiendoFoto = false; this.aviso(e.error?.error || 'No se pudo subir la foto', 'danger'); },
      });
    } catch (e: any) {
      this.subiendoFoto = false;
      this.aviso(e?.message || 'No se pudo procesar la imagen', 'danger');
    }
  }

  quitarFoto() {
    this.subiendoFoto = true;
    this.portal.actualizarFotoPerfil(null).subscribe({
      next: () => {
        this.perfil = { ...this.perfil, foto: null };
        this.portal.actualizarClienteLocal({ foto: null });
        this.subiendoFoto = false;
        this.aviso('Foto eliminada');
      },
      error: e => { this.subiendoFoto = false; this.aviso(e.error?.error || 'No se pudo quitar la foto', 'danger'); },
    });
  }

  async eliminarCuenta() {
    const al = await this.alert.create({
      cssClass: 'portal-alert',
      header: 'Eliminar cuenta',
      message: 'Se desactivará tu acceso al portal y se cerrará la sesión. Tu historial de servicios queda en el taller. ¿Querés continuar?',
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        { text: 'Eliminar', role: 'destructive', cssClass: 'portal-alert-danger', handler: () => this.confirmarEliminar() },
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

  logout() {
    this.portal.logout();
    this.router.navigate(['/portal/login'], { replaceUrl: true });
  }

  private async aviso(message: string, color = 'success') {
    const t = await this.toast.create({ message, duration: 1800, color });
    await t.present();
  }
}
