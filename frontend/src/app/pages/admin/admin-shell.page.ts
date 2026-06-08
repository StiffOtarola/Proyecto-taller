import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  standalone: false,
  selector: 'app-admin-shell',
  templateUrl: './admin-shell.page.html',
})
export class AdminShellPage {
  constructor(private auth: AuthService, private router: Router) {}

  get nombre(): string { return this.auth.getUsuario()?.nombre || 'Administrador'; }
  get rolLabel(): string { return 'Administrador'; }
  get iniciales(): string {
    const p = this.nombre.trim().split(/\s+/);
    return ((p[0]?.[0] || '') + (p[1]?.[0] || '')).toUpperCase() || 'A';
  }

  logout() {
    this.auth.logout();
    this.router.navigate(['/portal/login'], { replaceUrl: true });
  }
}
