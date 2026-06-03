import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { ClientesService } from '../../services/clientes.service';
import { Cliente } from '../../models/cliente.model';

@Component({ standalone: false,
  selector: 'app-clientes',
  templateUrl: './clientes.page.html',
  styleUrls: ['./clientes.page.scss'],
})
export class ClientesPage implements OnInit {
  clientes: Cliente[] = [];
  busqueda = '';
  cargando = true;

  constructor(private clienteSvc: ClientesService, private router: Router) {}

  ngOnInit() { this.cargar(); }
  ionViewWillEnter() { this.cargar(); }

  cargar() {
    this.cargando = true;
    this.clienteSvc.getAll(this.busqueda || undefined).subscribe({
      next: res => { this.clientes = res.data; this.cargando = false; },
      error: () => { this.cargando = false; },
    });
  }

  buscar(ev: any) {
    this.busqueda = ev.detail.value;
    this.cargar();
  }

  abrirDetalle(id: number) { this.router.navigate(['/cliente-detalle', id]); }
  nuevoCliente() { this.router.navigate(['/cliente-form']); }
  editarCliente(id: number) { this.router.navigate(['/cliente-form', id]); }
}
