import { Injectable } from '@angular/core';
import { CanActivate, Router, UrlTree } from '@angular/router';
import { AuthService } from '../services/auth.service';

// Manda a cada rol a su panel propio si intenta entrar al dashboard (/tabs).
// Técnico, recepción y admin/gerencia tienen su panel; el jefe de taller sí ve /tabs.
@Injectable({ providedIn: 'root' })
export class RolHomeGuard implements CanActivate {
  constructor(private auth: AuthService, private router: Router) {}

  canActivate(): boolean | UrlTree {
    const rol = this.auth.getUsuario()?.rol;
    if (rol === 'tecnico') return this.router.parseUrl('/mecanico');
    if (rol === 'recepcion') return this.router.parseUrl('/recepcion');
    if (rol === 'admin' || rol === 'gerencia') return this.router.parseUrl('/admin');
    return true;
  }
}
