import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AdminService } from '../../services/admin.service';
import { ESTADO_CITA_LABEL } from '../../utils/servicios';
import { descargarCSV, fechaCorta } from '../../shared/csv.util';

@Component({
  standalone: false,
  selector: 'app-admin-citas',
  templateUrl: './admin-citas.page.html',
})
export class AdminCitasPage implements OnInit {
  citas: any[] = [];
  cargando = true;
  estado = '';
  q = '';
  fecha = '';

  readonly estadoLabel = ESTADO_CITA_LABEL;
  readonly filtros = [
    { v: '', l: 'Todas' }, { v: 'agendado', l: 'Agendadas' }, { v: 'en_revision', l: 'En revisión' },
    { v: 'en_mantenimiento', l: 'En mantenimiento' }, { v: 'listo', l: 'Listas' },
    { v: 'entregado', l: 'Entregadas' }, { v: 'cancelado', l: 'Canceladas' },
  ];
  readonly estadoBadge: Record<string, string> = {
    agendado: 'bg-in', en_revision: 'bg-am', en_mantenimiento: 'bg-cr',
    listo: 'bg-em', entregado: 'bg-n', cancelado: 'bg-rd',
  };

  constructor(private admin: AdminService, private router: Router) {}

  ngOnInit() { this.cargar(); }
  ionViewWillEnter() { this.cargar(); }

  cargar(ev?: any) {
    this.cargando = true;
    this.admin.getCitas({ estado: this.estado, q: this.q.trim(), fecha: this.fecha }).subscribe({
      next: r => { this.citas = r.data; this.cargando = false; if (ev) ev.target.complete(); },
      error: () => { this.cargando = false; if (ev) ev.target.complete(); },
    });
  }

  setFiltro(v: string) { this.estado = v; this.cargar(); }
  abrir(c: any) { if (c.orden_id) this.router.navigate(['/detalle-orden', c.orden_id]); }

  exportar() {
    descargarCSV(`citas_${new Date().toISOString().slice(0, 10)}`, [
      { key: 'id', label: '#' }, { key: 'moto', label: 'Moto' }, { key: 'placa', label: 'Placa' },
      { key: 'cliente', label: 'Cliente' }, { key: 'servicio', label: 'Servicio' },
      { key: 'fecha', label: 'Fecha' }, { key: 'hora', label: 'Hora' },
      { key: 'tecnico', label: 'Mecánico' }, { key: 'estado', label: 'Estado' },
    ], this.citas.map(c => ({
      id: c.id,
      moto: `${c.marca || ''} ${c.modelo || ''}`.trim(),
      placa: c.placa || '',
      cliente: `${c.cliente_nombre || ''} ${c.cliente_apellido || ''}`.trim(),
      servicio: c.tipo_servicio || c.motivo || '',
      fecha: fechaCorta(c.fecha),
      hora: (c.hora || '').slice(0, 5),
      tecnico: c.tecnico_nombre || '',
      estado: this.estadoLabel[c.estado] || c.estado,
    })));
  }
}
