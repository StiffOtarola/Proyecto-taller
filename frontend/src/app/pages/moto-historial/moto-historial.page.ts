import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { MotosService } from '../../services/motos.service';
import { Moto } from '../../models/moto.model';
import { Orden } from '../../models/orden.model';

@Component({ standalone: false,
  selector: 'app-moto-historial',
  templateUrl: './moto-historial.page.html',
  styleUrls: ['./moto-historial.page.scss'],
})
export class MotoHistorialPage implements OnInit {
  moto: Moto | null = null;
  historial: Orden[] = [];
  cargando = true;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private motoSvc: MotosService
  ) {}

  ngOnInit() {
    const id = +(this.route.snapshot.paramMap.get('id') || 0);
    this.motoSvc.getById(id).subscribe(res => { this.moto = res.data; this.cargando = false; });
    this.motoSvc.getHistorial(id).subscribe(res => this.historial = res.data);
  }

  abrirOrden(id: number) { this.router.navigate(['/detalle-orden', id]); }
}
