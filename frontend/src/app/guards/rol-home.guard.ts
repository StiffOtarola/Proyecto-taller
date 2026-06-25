import { Injectable } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivate, Router, RouterStateSnapshot, UrlTree } from '@angular/router';
import { AuthService } from '../services/auth.service';

// Cada rol entra directo a su panel propio: técnico → /mecanico, recepción →
// /recepcion, admin → /admin (su dashboard). El /tabs operativo (órdenes,
// clientes, agenda) sigue accesible, pero ya no es el home del admin.
@Injectable({ providedIn: 'root' })
export class RolHomeGuard implements CanActivate {
  constructor(private auth: AuthService, private router: Router) {}

  canActivate(_route: ActivatedRouteSnapshot, state: RouterStateSnapshot): boolean | UrlTree {
    const rol = this.auth.getUsuario()?.rol;
    if (rol === 'tecnico') return this.router.parseUrl('/mecanico');
    if (rol === 'recepcion') return this.router.parseUrl('/recepcion');
    if (rol === 'admin') return this.router.parseUrl('/admin');
    return true;
  }
}
