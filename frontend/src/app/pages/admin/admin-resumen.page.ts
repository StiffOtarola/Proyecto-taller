import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { ToastController } from '@ionic/angular';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { AdminService } from '../../services/admin.service';
import { DashboardService } from '../../services/dashboard.service';
import { OrdenesService } from '../../services/ordenes.service';
import { ESTADO_CONFIG, EstadoOrden } from '../../models/orden.model';
import { descargarCSV, fechaCorta } from '../../shared/csv.util';

type Sem = 'rojo' | 'amarillo' | 'verde' | 'gris';

@Component({
  standalone: false,
  selector: 'app-admin-resumen',
  templateUrl: './admin-resumen.page.html',
})
export class AdminResumenPage implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  data: any = null;        // /api/admin/resumen (citas)
  op: any = null;          // /api/dashboard/resumen (órdenes/operativo)
  tiempos: any[] = [];     // tiempo por etapa
  tecnicos: any[] = [];    // productividad por técnico
  atrasos: any[] = [];     // semáforo de entregas
  cargando = true;
  exportando = false;

  filtroSemaforo: Sem = 'rojo';

  // Estado del taller (órdenes) → etiqueta + color del punto + clase de badge.
  readonly estadoMap: Record<string, { label: string; dot: string; bg: string }> = {
    recepcion:            { label: 'Recepción',            dot: '#FB7185', bg: 'bg-cr' },
    diagnostico:          { label: 'Diagnóstico',          dot: '#FBB834', bg: 'bg-am' },
    esperando_aprobacion: { label: 'Esperando aprobación', dot: '#818CF8', bg: 'bg-in' },
    esperando_repuestos:  { label: 'Esperando repuestos',  dot: '#A3A3A3', bg: 'bg-n' },
    en_reparacion:        { label: 'En reparación',        dot: '#38BDF8', bg: 'bg-in' },
    lista_entrega:        { label: 'Lista para entrega',   dot: '#4ADE80', bg: 'bg-em' },
  };
  readonly etapaLabel: Record<string, string> = {
    recepcion: 'Recepción', diagnostico: 'Diagnóstico', esperando_aprobacion: 'Esperando aprobación',
    esperando_repuestos: 'Esperando repuestos', en_reparacion: 'En reparación', lista_entrega: 'Lista para entrega',
  };

  constructor(
    private admin: AdminService,
    private dash: DashboardService,
    private ordenes: OrdenesService,
    private toast: ToastController,
    private router: Router,
  ) {}

  ngOnInit() { this.cargar(); }
  ngOnDestroy() { this.destroy$.next(); this.destroy$.complete(); }
  ionViewWillEnter() { this.cargar(); }

  cargar(ev?: any) {
    this.cargando = true;
    this.admin.getResumen().pipe(takeUntil(this.destroy$)).subscribe({
      next: r => { this.data = r.data; this.cargando = false; if (ev) ev.target.complete(); },
      error: () => { this.cargando = false; if (ev) ev.target.complete(); },
    });
    this.dash.getResumen().pipe(takeUntil(this.destroy$)).subscribe({ next: r => this.op = r.data, error: () => {} });
    this.dash.getTiempos().pipe(takeUntil(this.destroy$)).subscribe({ next: r => this.tiempos = r.data, error: () => {} });
    this.dash.getTecnicos().pipe(takeUntil(this.destroy$)).subscribe({ next: r => this.tecnicos = r.data, error: () => {} });
    this.dash.getAtrasos().pipe(takeUntil(this.destroy$)).subscribe({ next: r => this.atrasos = r.data, error: () => {} });
  }

  // ── Citas (mes) ──
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

  // ── Tiempo por etapa ──
  get maxTiempo(): number {
    return Math.max(1, ...this.tiempos.map(t => Number(t.horas_promedio) || 0));
  }

  // ── Semáforo de entregas ──
  semaforo(dias: number | null): Sem {
    if (dias === null || dias === undefined) return 'gris';
    if (dias < 0) return 'rojo';
    if (dias <= 1) return 'amarillo';
    return 'verde';
  }
  semaforoTexto(dias: number | null): string {
    if (dias === null || dias === undefined) return 'Sin fecha';
    if (dias < 0) return `Atrasada ${Math.abs(dias)}d`;
    if (dias === 0) return 'Vence hoy';
    if (dias === 1) return 'Vence mañana';
    return `${dias}d`;
  }
  readonly semBadge: Record<Sem, string> = { rojo: 'bg-rd', amarillo: 'bg-am', verde: 'bg-em', gris: 'bg-n' };
  get atrasosFiltrados(): any[] { return this.atrasos.filter(a => this.semaforo(a.dias_restantes) === this.filtroSemaforo); }
  get countRojo(): number { return this.atrasos.filter(a => this.semaforo(a.dias_restantes) === 'rojo').length; }
  get countAmarillo(): number { return this.atrasos.filter(a => this.semaforo(a.dias_restantes) === 'amarillo').length; }
  get countVerde(): number { return this.atrasos.filter(a => this.semaforo(a.dias_restantes) === 'verde').length; }

  iniciales(nombre: string): string { return (nombre || '?').trim().charAt(0).toUpperCase(); }
  abrirOrden(id: number) { this.router.navigate(['/detalle-orden', id]); }

  // ── Exportación CSV (Excel) ──
  private hoy() { return new Date().toISOString().slice(0, 10); }
  private estadoTexto(e?: string) { return ESTADO_CONFIG[e as EstadoOrden]?.label ?? e ?? ''; }

  exportarOrdenes() {
    this.exportando = true;
    this.ordenes.getAll().pipe(takeUntil(this.destroy$)).subscribe({
      next: res => {
        const filas = res.data.map((o: any) => ({
          numero_orden: o.numero_orden, estado: this.estadoTexto(o.estado),
          cliente: `${o.cliente_nombre || ''} ${o.cliente_apellido || ''}`.trim(),
          moto: `${o.marca || ''} ${o.modelo || ''}`.trim(), placa: o.placa || '',
          tecnico: o.tecnico_nombre || '', ingreso: fechaCorta(o.fecha_ingreso),
          total: (o.costo_mano_obra || 0) + (o.costo_repuestos || 0) - (o.descuento || 0),
        }));
        descargarCSV(`ordenes_${this.hoy()}`, [
          { key: 'numero_orden', label: 'Orden' }, { key: 'estado', label: 'Estado' },
          { key: 'cliente', label: 'Cliente' }, { key: 'moto', label: 'Moto' }, { key: 'placa', label: 'Placa' },
          { key: 'tecnico', label: 'Técnico' }, { key: 'ingreso', label: 'Ingreso' }, { key: 'total', label: 'Total' },
        ], filas);
        this.exportando = false; this.aviso(`${filas.length} órdenes exportadas`);
      },
      error: () => { this.exportando = false; this.aviso('No se pudo exportar', 'danger'); },
    });
  }

  exportarFacturacion() {
    this.exportando = true;
    this.ordenes.getAll({ estado: 'entregada' }).pipe(takeUntil(this.destroy$)).subscribe({
      next: res => {
        const filas = res.data.map((o: any) => ({
          numero_orden: o.numero_orden, cliente: `${o.cliente_nombre || ''} ${o.cliente_apellido || ''}`.trim(),
          moto: `${o.marca || ''} ${o.modelo || ''}`.trim(), entrega: fechaCorta(o.fecha_entrega_real),
          metodo_pago: o.metodo_pago || '',
          total: (o.costo_mano_obra || 0) + (o.costo_repuestos || 0) - (o.descuento || 0),
        }));
        descargarCSV(`facturacion_${this.hoy()}`, [
          { key: 'numero_orden', label: 'Orden' }, { key: 'cliente', label: 'Cliente' }, { key: 'moto', label: 'Moto' },
          { key: 'entrega', label: 'Entrega' }, { key: 'metodo_pago', label: 'Método de pago' }, { key: 'total', label: 'Total' },
        ], filas);
        this.exportando = false; this.aviso(`${filas.length} facturas exportadas`);
      },
      error: () => { this.exportando = false; this.aviso('No se pudo exportar', 'danger'); },
    });
  }

  exportarProductividad() {
    if (!this.tecnicos.length) { this.aviso('Sin datos de técnicos', 'warning'); return; }
    descargarCSV(`productividad_${this.hoy()}`, [
      { key: 'nombre', label: 'Técnico' }, { key: 'ordenes_completadas', label: 'Órdenes completadas' }, { key: 'horas_promedio', label: 'Horas promedio' },
    ], this.tecnicos.map(t => ({ nombre: t.nombre, ordenes_completadas: t.ordenes_completadas || 0, horas_promedio: t.horas_promedio || 0 })));
    this.aviso('Productividad exportada');
  }

  private async aviso(message: string, color = 'success') {
    const t = await this.toast.create({ message, duration: 1800, color });
    await t.present();
  }
}
