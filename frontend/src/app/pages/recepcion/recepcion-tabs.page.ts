import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';

// Shell de recepción: barra lateral (como el panel admin) en pantallas grandes y
// menú deslizable en móvil. Aloja las páginas de recepción en su router-outlet.
@Component({
  standalone: false,
  selector: 'app-recepcion-tabs',
  templateUrl: './recepcion-tabs.page.html',
})
export class RecepcionTabsPage {
  constructor(private auth: AuthService, private router: Router) {}

  get nombre(): string { return this.auth.getUsuario()?.nombre || 'Recepción'; }
  get foto(): string | null { return this.auth.getUsuario()?.foto || null; }
  get rolLabel(): string { return 'Recepción'; }
  get iniciales(): string {
    const p = this.nombre.trim().split(/\s+/);
    return ((p[0]?.[0] || '') + (p[1]?.[0] || '')).toUpperCase() || 'R';
  }

  logout() {
    this.auth.logout();
    this.router.navigate(['/portal/login'], { replaceUrl: true });
  }
}
