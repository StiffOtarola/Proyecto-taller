import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { LoadingController, ToastController } from '@ionic/angular';
import { PortalService } from '../../services/portal.service';
import { AuthService } from '../../services/auth.service';
import { emailValido } from '../../utils/validar';

@Component({
  standalone: false,
  selector: 'app-portal-login',
  templateUrl: './portal-login.page.html',
  styleUrls: ['./portal-login.page.scss'],
})
export class PortalLoginPage implements OnInit {
  email = '';
  password = '';
  verPass = false;

  constructor(
    private portal: PortalService,
    private auth: AuthService,
    private router: Router,
    private loading: LoadingController,
    private toast: ToastController
  ) {}

  ngOnInit() {
    // Si ya hay una sesión activa, mandamos a la zona que corresponde.
    if (this.portal.isLoggedIn()) this.router.navigate(['/portal'], { replaceUrl: true });
    else if (this.auth.isLoggedIn()) this.router.navigate([this.rutaStaff()], { replaceUrl: true });
  }

  // El técnico tiene su propio panel; el resto del personal va al dashboard.
  private rutaStaff(): string {
    return this.auth.getUsuario()?.rol === 'tecnico' ? '/mecanico' : '/tabs';
  }

  async ingresar() {
    if (!this.email || !this.password) return;
    if (!emailValido(this.email)) {
      const t = await this.toast.create({ message: 'Ingresá un correo válido', duration: 2500, color: 'warning' });
      return await t.present();
    }
    const l = await this.loading.create({ message: 'Ingresando...' });
    await l.present();
    this.auth.loginUnificado(this.email.trim(), this.password).subscribe({
      next: async (res) => {
        await l.dismiss();
        if (res.data.tipo === 'staff' && res.data.usuario) {
          this.auth.aplicarSesionStaff(res.data.token, res.data.usuario);
          this.router.navigate([this.rutaStaff()], { replaceUrl: true });
        } else if (res.data.cliente) {
          this.portal.aplicarSesion(res.data.token, res.data.cliente);
          this.router.navigate(['/portal'], { replaceUrl: true });
        }
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
}
