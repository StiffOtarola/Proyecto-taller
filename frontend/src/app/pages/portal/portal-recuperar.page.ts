import { Component, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { LoadingController, ToastController } from '@ionic/angular';
import { PortalService } from '../../services/portal.service';
import { emailValido } from '../../utils/validar';

@Component({
  standalone: false,
  selector: 'app-portal-recuperar',
  templateUrl: './portal-recuperar.page.html',
  styleUrls: ['./portal-login.page.scss'],
})
export class PortalRecuperarPage implements OnDestroy {
  paso: 1 | 2 = 1;
  email = '';
  codigo = '';
  password = '';
  confirmar = '';

  verPass = false;
  verConfirmar = false;

  cooldown = 0;
  private timer?: any;

  constructor(
    private portal: PortalService,
    private router: Router,
    private loading: LoadingController,
    private toast: ToastController
  ) {}

  ngOnDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  get emailOk(): boolean {
    return emailValido(this.email);
  }

  get validoPaso2(): boolean {
    return !!(this.codigo.trim().length === 6 &&
      this.password.length >= 6 && this.password === this.confirmar);
  }

  async solicitar() {
    if (!this.emailOk) return this.mostrar('Ingresá un correo válido', 'warning');
    const l = await this.loading.create({ message: 'Enviando código...', cssClass: 'portal-loading', spinner: 'crescent' });
    await l.present();
    this.portal.solicitarCodigo(this.email.trim()).subscribe({
      next: async (res) => {
        await l.dismiss();
        this.paso = 2;
        this.iniciarCooldown();
        this.mostrar(res.message || 'Si la cuenta existe, te enviamos un código');
      },
      error: async (err) => {
        await l.dismiss();
        this.mostrar(err.error?.error || 'No se pudo enviar el código', 'danger');
      },
    });
  }

  async reenviar() {
    if (this.cooldown > 0) return;
    await this.solicitar();
  }

  async confirmar_() {
    if (!this.validoPaso2) {
      if (this.codigo.trim().length !== 6) return this.mostrar('El código tiene 6 dígitos', 'warning');
      if (this.password.length < 6) return this.mostrar('La contraseña debe tener al menos 6 caracteres', 'warning');
      if (this.password !== this.confirmar) return this.mostrar('Las contraseñas no coinciden', 'warning');
      return;
    }
    const l = await this.loading.create({ message: 'Verificando...', cssClass: 'portal-loading', spinner: 'crescent' });
    await l.present();
    this.portal.confirmarRecuperacion({ email: this.email.trim(), codigo: this.codigo.trim(), password: this.password }).subscribe({
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

  private iniciarCooldown() {
    this.cooldown = 60;
    if (this.timer) clearInterval(this.timer);
    this.timer = setInterval(() => {
      this.cooldown--;
      if (this.cooldown <= 0) clearInterval(this.timer);
    }, 1000);
  }

  private async mostrar(message: string, color = 'success') {
    const t = await this.toast.create({ message, duration: 2600, color });
    await t.present();
  }
}
