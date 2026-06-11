import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { PortalService } from '../../services/portal.service';

@Component({
  standalone: false,
  selector: 'app-portal-moto-historial',
  templateUrl: './portal-moto-historial.page.html',
  styleUrls: ['./portal-moto-historial.page.scss'],
})
export class PortalMotoHistorialPage implements OnInit {
  moto: any = null;
  servicios: any[] = [];
  cargando = true;
  totalGastado = 0;

  constructor(private route: ActivatedRoute, private router: Router, private portal: PortalService) {}

  ngOnInit() {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    if (id) this.cargar(id);
  }

  cargar(id: number) {
    this.cargando = true;
    this.portal.getMotoHistorial(id).subscribe({
      next: r => {
        this.moto = r.data.moto;
        this.servicios = r.data.servicios || [];
        this.totalGastado = this.servicios.reduce((s, x) => s + Number(x.monto || 0), 0);
        this.cargando = false;
      },
      error: () => { this.cargando = false; },
    });
  }

  verCita(s: any) { this.router.navigate(['/portal/cita', s.id]); }
  estrellas(n: number): string { return '★'.repeat(n) + '☆'.repeat(5 - n); }
}
