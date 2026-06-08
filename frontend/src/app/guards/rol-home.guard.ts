import { Injectable } from '@angular/core';
import { CanActivate, Router, UrlTree } from '@angular/router';
import { AuthService } from '../services/auth.service';

// Manda a técnico y recepción a su panel propio; el admin cae en el dashboard
// operativo (/tabs) y desde ahí navega a su panel /admin.
@Injectable({ providedIn: 'root' })
export class RolHomeGuard implements CanActivate {
  constructor(private auth: AuthService, private router: Router) {}

  canActivate(): boolean | UrlTree {
    const rol = this.auth.getUsuario()?.rol;
    if (rol === 'tecnico') return this.router.parseUrl('/mecanico');
    if (rol === 'recepcion') return this.router.parseUrl('/recepcion');
    return true; // admin ve /tabs
  }
}
