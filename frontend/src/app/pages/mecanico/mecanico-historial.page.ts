import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { MecanicoService } from '../../services/mecanico.service';
import { AuthService } from '../../services/auth.service';

@Component({
  standalone: false,
  selector: 'app-mecanico-historial',
  templateUrl: './mecanico-historial.page.html',
  styleUrls: ['./mecanico.page.scss', './mecanico-historial.page.scss'],
})
export class MecanicoHistorialPage implements OnInit {
  acum: any = null;       // acumulado (de /perfil): completadas, ingresos, calificación
  citas: any[] = [];      // citas entregadas (más recientes primero)
  cargando = true;

  constructor(
    private mecanico: MecanicoService,
    private auth: AuthService,
    private router: Router,
  ) {}

  ngOnInit() { this.cargar(); }
  ionViewWillEnter() { this.cargar(); }

  cargar(ev?: any) {
    this.cargando = true;
    this.mecanico.getPerfil().subscribe({ next: r => this.acum = r.data, error: () => {} });
    this.mecanico.getCitas({ estado: 'entregado' }).subscribe({
      next: r => {
        this.citas = (r.data || []).slice().sort((a, b) =>
          String(b.fecha_fin || b.fecha || '').localeCompare(String(a.fecha_fin || a.fecha || '')));
        this.cargando = false; if (ev) ev.target.complete();
      },
      error: () => { this.cargando = false; if (ev) ev.target.complete(); },
    });
  }

  estrellas(prom: number | null): string {
    if (!prom) return '—';
    const llenas = Math.round(prom);
    return '★'.repeat(llenas) + '☆'.repeat(5 - llenas);
  }

  logout() {
    this.auth.logout();
    this.router.navigate(['/portal/login'], { replaceUrl: true });
  }
}
