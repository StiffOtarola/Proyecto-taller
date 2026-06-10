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
    // El admin aterriza en /admin solo al entrar al índice de /tabs; los deep-links
    // operativos (p. ej. /tabs/ordenes desde el panel admin) se respetan.
    if (rol === 'admin') {
      const enIndice = state.url === '/tabs' || state.url === '/tabs/dashboard';
      return enIndice ? this.router.parseUrl('/admin') : true;
    }
    return true;
  }
}
