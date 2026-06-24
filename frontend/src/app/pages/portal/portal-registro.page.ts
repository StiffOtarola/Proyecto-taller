import { Component, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { LoadingController, ToastController } from '@ionic/angular';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { PortalService } from '../../services/portal.service';
import { emailValido } from '../../utils/validar';

@Component({
  standalone: false,
  selector: 'app-portal-registro',
  templateUrl: './portal-registro.page.html',
  styleUrls: ['./portal-login.page.scss'],
})
export class PortalRegistroPage implements OnDestroy {
  private destroy$ = new Subject<void>();
  nombre = '';
  apellido = '';
  telefono = '';
  email = '';
  cedula = '';
  password = '';
  confirmar = '';
  verPass = false;
  verConfirmar = false;

  constructor(
    private portal: PortalService,
    private router: Router,
    private loading: LoadingController,
    private toast: ToastController
  ) {}

  get valido(): boolean {
    return !!(this.nombre.trim() && this.apellido.trim() && this.telefono.trim() &&
      emailValido(this.email) && this.password.length >= 6 && this.password === this.confirmar);
  }

  async registrar() {
    if (!this.valido) {
      if (this.email.trim() && !emailValido(this.email)) return this.mostrar('Ingresá un correo válido', 'warning');
      if (this.password && this.password.length < 6) return this.mostrar('La contraseña debe tener al menos 6 caracteres', 'warning');
      if (this.password !== this.confirmar) return this.mostrar('Las contraseñas no coinciden', 'warning');
      return;
    }
    const l = await this.loading.create({ message: 'Creando tu cuenta...', cssClass: 'portal-loading', spinner: 'crescent' });
    await l.present();
    this.portal.registro({
      nombre: this.nombre.trim(), apellido: this.apellido.trim(), telefono: this.telefono.trim(),
      email: this.email.trim(), cedula: this.cedula.trim() || undefined, password: this.password,
    }).pipe(takeUntil(this.destroy$)).subscribe({
      next: async () => {
        await l.dismiss();
        this.mostrar('¡Cuenta creada!');
        this.router.navigate(['/portal'], { replaceUrl: true });
      },
      error: async (err) => {
        await l.dismiss();
        this.mostrar(err.error?.error || 'No se pudo crear la cuenta', 'danger');
      },
    });
  }

  ngOnDestroy() { this.destroy$.next(); this.destroy$.complete(); }

  irLogin() {
    this.router.navigate(['/portal/login']);
  }

  private async mostrar(message: string, color = 'success') {
    const t = await this.toast.create({ message, duration: 2500, color });
    await t.present();
  }
}
