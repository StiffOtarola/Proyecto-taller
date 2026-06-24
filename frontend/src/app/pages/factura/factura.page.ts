import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Location } from '@angular/common';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { OrdenesService } from '../../services/ordenes.service';
import { Orden, OrdenRepuesto } from '../../models/orden.model';

@Component({
  standalone: false,
  selector: 'app-factura',
  templateUrl: './factura.page.html',
  styleUrls: ['./factura.page.scss'],
})
export class FacturaPage implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
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
    this.ordenSvc.getById(id).pipe(takeUntil(this.destroy$)).subscribe(res => { this.orden = res.data; this.cargando = false; });
    this.ordenSvc.getRepuestos(id).pipe(takeUntil(this.destroy$)).subscribe(res => this.repuestos = res.data);
  }

  get totalRepuestos(): number {
    return this.repuestos.reduce((s, r) => s + r.cantidad * r.costo_unitario, 0);
  }

  get total(): number {
    if (!this.orden) return 0;
    return (this.orden.costo_mano_obra || 0) + this.totalRepuestos - (this.orden.descuento || 0);
  }

  ngOnDestroy() { this.destroy$.next(); this.destroy$.complete(); }

  imprimir() { window.print(); }
  volver() { this.location.back(); }
}
