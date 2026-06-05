import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { LoadingController, ToastController } from '@ionic/angular';
import { PortalService } from '../../services/portal.service';

@Component({
  standalone: false,
  selector: 'app-portal-recuperar',
  templateUrl: './portal-recuperar.page.html',
  styleUrls: ['./portal-login.page.scss'],
})
export class PortalRecuperarPage {
  email = '';
  telefono = '';
  password = '';
  confirmar = '';

  constructor(
    private portal: PortalService,
    private router: Router,
    private loading: LoadingController,
    private toast: ToastController
  ) {}

  get valido(): boolean {
    return !!(this.email.trim() && this.telefono.trim() &&
      this.password.length >= 6 && this.password === this.confirmar);
  }

  async recuperar() {
    if (!this.valido) {
      if (this.password && this.password.length < 6) return this.mostrar('La contraseña debe tener al menos 6 caracteres', 'warning');
      if (this.password !== this.confirmar) return this.mostrar('Las contraseñas no coinciden', 'warning');
      return;
    }
    const l = await this.loading.create({ message: 'Verificando...' });
    await l.present();
    this.portal.recuperar({ email: this.email.trim(), telefono: this.telefono.trim(), password: this.password }).subscribe({
      next: async () => {
        await l.dismiss();
        this.mostrar('Contraseña actualizada');
        this.router.navigate(['/portal'], { replaceUrl: true });
      },
      error: async (err) => {
        await l.dismiss();
        this.mostrar(err.error?.error || 'No se pudo restablecer la contraseña', 'danger');
      },
    });
  }

  irLogin() {
    this.router.navigate(['/portal/login']);
  }

  private async mostrar(message: string, color = 'success') {
    const t = await this.toast.create({ message, duration: 2600, color });
    await t.present();
  }
}
