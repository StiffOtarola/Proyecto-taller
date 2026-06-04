import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { LoadingController, ToastController } from '@ionic/angular';
import { PortalService } from '../../services/portal.service';

@Component({
  standalone: false,
  selector: 'app-portal-login',
  templateUrl: './portal-login.page.html',
  styleUrls: ['./portal-login.page.scss'],
})
export class PortalLoginPage {
  email = '';
  password = '';

  constructor(
    private portal: PortalService,
    private router: Router,
    private loading: LoadingController,
    private toast: ToastController
  ) {}

  async ingresar() {
    if (!this.email || !this.password) return;
    const l = await this.loading.create({ message: 'Ingresando...' });
    await l.present();
    this.portal.login(this.email.trim(), this.password).subscribe({
      next: async () => {
        await l.dismiss();
        this.router.navigate(['/portal'], { replaceUrl: true });
      },
      error: async (err) => {
        await l.dismiss();
        const t = await this.toast.create({
          message: err.error?.error || 'No se pudo iniciar sesión',
          duration: 2500,
          color: 'danger',
        });
        await t.present();
      },
    });
  }

  irLoginPersonal() {
    this.router.navigate(['/login']);
  }
}
