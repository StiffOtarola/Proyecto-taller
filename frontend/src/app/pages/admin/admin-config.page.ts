import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { ToastController } from '@ionic/angular';
import { AdminService } from '../../services/admin.service';
import { AuthService } from '../../services/auth.service';

interface HorarioVista { dia: number; label: string; abre: string; cierra: string; activo: boolean; }

@Component({
  standalone: false,
  selector: 'app-admin-config',
  templateUrl: './admin-config.page.html',
})
export class AdminConfigPage implements OnInit {
  config: any = null;
  cargando = true;
  guardando = false;
  guardandoCuenta = false;
  guardandoPass = false;

  horariosVista: HorarioVista[] = [];
  cuenta = { nombre: '', email: '' };
  pass = { actual: '', nueva: '' };

  // Sucursales (locales del taller).
  sucursales: any[] = [];
  nuevaSucursal = { nombre: '', direccion: '', telefono: '' };
  guardandoSucursal = false;

  // Orden de presentación: lunes → domingo.
  private readonly diasOrden = [
    { dia: 1, l: 'Lunes' }, { dia: 2, l: 'Martes' }, { dia: 3, l: 'Miércoles' },
    { dia: 4, l: 'Jueves' }, { dia: 5, l: 'Viernes' }, { dia: 6, l: 'Sábado' }, { dia: 0, l: 'Domingo' },
  ];

  constructor(
    private admin: AdminService, private auth: AuthService,
    private router: Router, private toast: ToastController,
  ) {}

  ngOnInit() {
    const u = this.auth.getUsuario();
    this.cuenta = { nombre: u?.nombre || '', email: u?.email || '' };
    this.cargar();
    this.cargarSucursales();
  }

  cargar() {
    this.cargando = true;
    this.admin.getConfig().subscribe({
      next: r => { this.config = r.data; this.normalizarHorarios(); this.cargando = false; },
      error: () => { this.cargando = false; this.aviso('No se pudo cargar la configuración', 'danger'); },
    });
  }

  cargarSucursales() {
    this.admin.getSucursales().subscribe({ next: r => this.sucursales = r.data || [] });
  }

  agregarSucursal() {
    const nombre = this.nuevaSucursal.nombre.trim();
    if (!nombre) { this.aviso('Escribí el nombre de la sucursal', 'warning'); return; }
    this.guardandoSucursal = true;
    this.admin.createSucursal({
      nombre,
      direccion: this.nuevaSucursal.direccion.trim() || undefined,
      telefono: this.nuevaSucursal.telefono.trim() || undefined,
    }).subscribe({
      next: () => {
        this.guardandoSucursal = false;
        this.nuevaSucursal = { nombre: '', direccion: '', telefono: '' };
        this.cargarSucursales();
        this.aviso('Sucursal creada');
      },
      error: (e) => { this.guardandoSucursal = false; this.aviso(e.error?.error || 'No se pudo crear', 'danger'); },
    });
  }

  guardarSucursal(s: any) {
    if (!s.nombre?.trim()) { this.aviso('La sucursal necesita un nombre', 'warning'); return; }
    this.admin.updateSucursal(s.id, { nombre: s.nombre.trim(), direccion: s.direccion?.trim() || undefined, telefono: s.telefono?.trim() || undefined }).subscribe({
      next: () => this.aviso('Sucursal actualizada'),
      error: (e) => this.aviso(e.error?.error || 'No se pudo guardar', 'danger'),
    });
  }

  toggleSucursal(s: any) {
    const activa = !Number(s.activa);
    this.admin.toggleSucursal(s.id, activa).subscribe({
      next: () => { s.activa = activa ? 1 : 0; },
      error: (e) => this.aviso(e.error?.error || 'No se pudo cambiar', 'danger'),
    });
  }

  private normalizarHorarios() {
    const src: any[] = Array.isArray(this.config?.horarios) ? this.config.horarios : [];
    this.horariosVista = this.diasOrden.map(d => {
      const h = src.find(x => Number(x.dia) === d.dia);
      return {
        dia: d.dia, label: d.l,
        abre: h?.abre || '08:00',
        cierra: h?.cierra || '17:00',
        activo: h ? !!Number(h.activo) : d.dia !== 0,
      };
    });
  }

  onLogoFile(ev: any) {
    const file = ev.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => { this.config.logo = reader.result as string; };
    reader.readAsDataURL(file);
  }
  quitarLogo() { this.config.logo = null; }

  guardarConfig() {
    this.guardando = true;
    const payload = {
      ...this.config,
      horarios: this.horariosVista.map(h => ({ dia: h.dia, abre: h.abre, cierra: h.cierra, activo: h.activo ? 1 : 0 })),
    };
    this.admin.updateConfig(payload).subscribe({
      next: r => { this.config = r.data; this.normalizarHorarios(); this.guardando = false; this.aviso('Configuración guardada'); },
      error: (e) => { this.guardando = false; this.aviso(e.error?.error || 'No se pudo guardar', 'danger'); },
    });
  }

  guardarCuenta() {
    if (!this.cuenta.nombre.trim() || !this.cuenta.email.trim()) { this.aviso('Nombre y correo son requeridos', 'warning'); return; }
    this.guardandoCuenta = true;
    this.admin.updateCuenta({ nombre: this.cuenta.nombre.trim(), email: this.cuenta.email.trim() }).subscribe({
      next: r => {
        // Refleja el nombre/correo nuevo en la sesión guardada (sidebar, etc.).
        const u = this.auth.getUsuario();
        const token = this.auth.getToken();
        if (u && token) this.auth.aplicarSesionStaff(token, { ...u, ...r.data });
        this.guardandoCuenta = false;
        this.aviso('Cuenta actualizada');
      },
      error: (e) => { this.guardandoCuenta = false; this.aviso(e.error?.error || 'No se pudo actualizar', 'danger'); },
    });
  }

  cambiarPassword() {
    if (!this.pass.actual || !this.pass.nueva) { this.aviso('Completá ambas contraseñas', 'warning'); return; }
    if (this.pass.nueva.length < 8) { this.aviso('La nueva debe tener al menos 8 caracteres', 'warning'); return; }
    this.guardandoPass = true;
    this.admin.updatePassword({ actual: this.pass.actual, nueva: this.pass.nueva }).subscribe({
      next: () => { this.guardandoPass = false; this.pass = { actual: '', nueva: '' }; this.aviso('Contraseña actualizada'); },
      error: (e) => { this.guardandoPass = false; this.aviso(e.error?.error || 'No se pudo cambiar', 'danger'); },
    });
  }

  logout() {
    this.auth.logout();
    this.router.navigate(['/portal/login'], { replaceUrl: true });
  }

  private async aviso(message: string, color = 'success') {
    const t = await this.toast.create({ message, duration: 1800, color });
    await t.present();
  }
}
