import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { AlertController, LoadingController } from '@ionic/angular';
import { AuthService } from '../../services/auth.service';

@Component({ standalone: false,
  selector: 'app-login',
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
})
export class LoginPage {
  email = '';
  password = '';

  constructor(
    private auth: AuthService,
    private router: Router,
    private loading: LoadingController,
    private alert: AlertController
  ) {}

  async login() {
    const loader = await this.loading.create({ message: 'Iniciando sesión...' });
    await loader.present();
    this.auth.login(this.email, this.password).subscribe({
      next: async () => {
        await loader.dismiss();
        this.router.navigate(['/tabs'], { replaceUrl: true });
      },
      error: async (err) => {
        await loader.dismiss();
        const a = await this.alert.create({
          header: 'Error',
          message: err.error?.error || 'Credenciales incorrectas',
          buttons: ['OK'],
        });
        await a.present();
      },
    });
  }
}
