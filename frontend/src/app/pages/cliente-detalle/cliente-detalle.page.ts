import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ClientesService } from '../../services/clientes.service';
import { Cliente } from '../../models/cliente.model';
import { Moto } from '../../models/moto.model';
import { Orden } from '../../models/orden.model';

@Component({ standalone: false,
  selector: 'app-cliente-detalle',
  templateUrl: './cliente-detalle.page.html',
  styleUrls: ['./cliente-detalle.page.scss'],
})
export class ClienteDetallePage implements OnInit {
  cliente: Cliente | null = null;
  motos: Moto[] = [];
  ordenes: Orden[] = [];
  cargando = true;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private clienteSvc: ClientesService
  ) {}

  ngOnInit() {
    const id = +(this.route.snapshot.paramMap.get('id') || 0);
    this.clienteSvc.getById(id).subscribe(res => { this.cliente = res.data; this.cargando = false; });
    this.clienteSvc.getMotos(id).subscribe(res => this.motos = res.data);
    this.clienteSvc.getOrdenes(id).subscribe(res => this.ordenes = res.data);
  }

  editarCliente() { this.router.navigate(['/cliente-form', this.cliente!.id]); }
  nuevaMoto() { this.router.navigate(['/moto-form'], { queryParams: { cliente_id: this.cliente!.id } }); }
  abrirOrden(id: number) { this.router.navigate(['/detalle-orden', id]); }
  abrirHistorial(moto: Moto) { this.router.navigate(['/moto-historial', moto.id]); }
}
