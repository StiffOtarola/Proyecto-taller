import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { ToastController } from '@ionic/angular';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { RecepcionService } from '../../services/recepcion.service';
import { AuthService } from '../../services/auth.service';

@Component({
  standalone: false,
  selector: 'app-recepcion-perfil',
  templateUrl: './recepcion-perfil.page.html',
  styleUrls: ['./recepcion-perfil.page.scss'],
})
export class RecepcionPerfilPage implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  perfil: any = null;
  cuenta = { nombre: '', email: '', telefono: '' };
  pass = { actual: '', nueva: '' };
  cargando = true;
  guardando = false;
  guardandoPass = false;

  constructor(
    private rec: RecepcionService,
    private auth: AuthService,
    private router: Router,
    private toast: ToastController,
  ) {}

  ngOnInit() { this.cargar(); }
  ngOnDestroy() { this.destroy$.next(); this.destroy$.complete(); }
  ionViewWillEnter() { this.cargar(); }

  cargar() {
    this.cargando = true;
    this.rec.getMiPerfil().pipe(takeUntil(this.destroy$)).subscribe({
      next: r => {
        this.perfil = r.data;
        this.cuenta = { nombre: r.data.nombre || '', email: r.data.email || '', telefono: r.data.telefono || '' };
        this.cargando = false;
      },
      error: () => { this.cargando = false; this.aviso('No se pudo cargar el perfil', 'danger'); },
    });
  }

  get iniciales(): string {
    const p = (this.cuenta.nombre || 'Recepción').trim().split(/\s+/);
    return ((p[0]?.[0] || '') + (p[1]?.[0] || '')).toUpperCase() || 'R';
  }

  guardarCuenta() {
    if (!this.cuenta.nombre.trim() || !this.cuenta.email.trim()) { this.aviso('Nombre y correo son requeridos', 'warning'); return; }
    this.guardando = true;
    this.rec.updateMiPerfil({ nombre: this.cuenta.nombre.trim(), email: this.cuenta.email.trim(), telefono: this.cuenta.telefono.trim() }).pipe(takeUntil(this.destroy$)).subscribe({
      next: r => {
        this.perfil = r.data;
        // Refleja nombre/correo en la sesión guardada (header, saludo).
        const u = this.auth.getUsuario();
        const token = this.auth.getToken();
        if (u && token) this.auth.aplicarSesionStaff(token, { ...u, nombre: r.data.nombre, email: r.data.email });
        this.guardando = false;
        this.aviso('Perfil actualizado');
      },
      error: (e) => { this.guardando = false; this.aviso(e.error?.error || 'No se pudo actualizar', 'danger'); },
    });
  }

  cambiarPassword() {
    if (!this.pass.actual || !this.pass.nueva) { this.aviso('Completá ambas contraseñas', 'warning'); return; }
    if (this.pass.nueva.length < 8) { this.aviso('La nueva debe tener al menos 8 caracteres', 'warning'); return; }
    this.guardandoPass = true;
    this.rec.updateMiPassword({ actual: this.pass.actual, nueva: this.pass.nueva }).pipe(takeUntil(this.destroy$)).subscribe({
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
