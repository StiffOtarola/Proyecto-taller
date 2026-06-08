import { Component, OnInit } from '@angular/core';
import { AdminService } from '../../services/admin.service';

@Component({
  standalone: false,
  selector: 'app-admin-resumen',
  templateUrl: './admin-resumen.page.html',
})
export class AdminResumenPage implements OnInit {
  data: any = null;
  cargando = true;

  constructor(private admin: AdminService) {}

  ngOnInit() { this.cargar(); }
  ionViewWillEnter() { this.cargar(); }

  cargar(ev?: any) {
    this.cargando = true;
    this.admin.getResumen().subscribe({
      next: r => { this.data = r.data; this.cargando = false; if (ev) ev.target.complete(); },
      error: () => { this.cargando = false; if (ev) ev.target.complete(); },
    });
  }

  get maxServicio(): number {
    return Math.max(1, ...(this.data?.top_servicios || []).map((s: any) => Number(s.total) || 0));
  }
  get totalIngreso(): number {
    return (this.data?.ingresos_por_servicio || []).reduce((s: number, r: any) => s + (Number(r.ingreso) || 0), 0);
  }
  pct(parte: any, total: any): number {
    const t = Number(total) || 0;
    return t ? Math.round(((Number(parte) || 0) / t) * 100) : 0;
  }
}
