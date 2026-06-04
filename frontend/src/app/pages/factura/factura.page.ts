import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Location } from '@angular/common';
import { OrdenesService } from '../../services/ordenes.service';
import { Orden, OrdenRepuesto } from '../../models/orden.model';

@Component({
  standalone: false,
  selector: 'app-factura',
  templateUrl: './factura.page.html',
  styleUrls: ['./factura.page.scss'],
})
export class FacturaPage implements OnInit {
  orden: Orden | null = null;
  repuestos: OrdenRepuesto[] = [];
  cargando = true;

  constructor(
    private route: ActivatedRoute,
    private location: Location,
    private ordenSvc: OrdenesService
  ) {}

  ngOnInit() {
    const id = +(this.route.snapshot.paramMap.get('id') || 0);
    this.ordenSvc.getById(id).subscribe(res => { this.orden = res.data; this.cargando = false; });
    this.ordenSvc.getRepuestos(id).subscribe(res => this.repuestos = res.data);
  }

  get totalRepuestos(): number {
    return this.repuestos.reduce((s, r) => s + r.cantidad * r.costo_unitario, 0);
  }

  get total(): number {
    if (!this.orden) return 0;
    return (this.orden.costo_mano_obra || 0) + this.totalRepuestos - (this.orden.descuento || 0);
  }

  imprimir() { window.print(); }
  volver() { this.location.back(); }
}
