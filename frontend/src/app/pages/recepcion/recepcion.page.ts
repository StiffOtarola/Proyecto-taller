import { Component, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { ToastController } from '@ionic/angular';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { RecepcionService, ResumenRecepcion } from '../../services/recepcion.service';
import { AuthService } from '../../services/auth.service';

@Component({
  standalone: false,
  selector: 'app-recepcion',
  templateUrl: './recepcion.page.html',
  styleUrls: ['./recepcion.page.scss'],
})
export class RecepcionPage implements OnInit, OnDestroy {
  resumen?: ResumenRecepcion;
  citas: any[] = [];
  alertas: any[] = [];
  cargando = true;

  // Buscador rápido (cliente / placa).
  buscarTexto = '';
  resultados: any[] = [];
  buscando = false;
  private busqueda$ = new Subject<string>();

  // Etiquetas y colores de los estados de la cita.
  readonly estadoLabel: Record<string, string> = {
    agendado: 'Agendado',
    en_revision: 'En revisión',
    en_mantenimiento: 'En mantenimiento',
    listo: 'Listo',
    entregado: 'Entregado',
    cancelado: 'Cancelado',
  };
  readonly estadoPill: Record<string, string> = {
    agendado: 'indigo',
    en_revision: 'amber',
    en_mantenimiento: 'rose',
    listo: 'green',
    entregado: 'gris',
    cancelado: 'gris',
  };

  creandoOrden: number | null = null;

  // Filtro por sucursal sobre las citas de hoy (las opciones salen de las citas cargadas).
  sucursalFiltro: number | '' = '';

  constructor(
    private rec: RecepcionService,
    private auth: AuthService,
    private router: Router,
    private toast: ToastController
  ) {}

  ngOnInit() {
    this.cargar();
    // Buscador con debounce: ≥2 caracteres consulta clientes; vacío limpia resultados.
    this.busqueda$.pipe(debounceTime(300), distinctUntilChanged()).subscribe(q => {
      if (q.length < 2) { this.resultados = []; this.buscando = false; return; }
      this.rec.getClientes(q).subscribe({
        next: r => { this.resultados = r.data.slice(0, 6); this.buscando = false; },
        error: () => { this.resultados = []; this.buscando = false; },
      });
    });
  }
  ionViewWillEnter() { this.cargar(); }
  ngOnDestroy() { this.busqueda$.complete(); }

  // —— Buscador rápido ——
  onBuscar(v: string) {
    this.buscarTexto = v;
    const q = (v || '').trim();
    this.buscando = q.length >= 2;
    this.busqueda$.next(q);
  }
  limpiarBusqueda() { this.buscarTexto = ''; this.resultados = []; this.buscando = false; this.busqueda$.next(''); }
  abrirResultado(c: any) { this.limpiarBusqueda(); this.router.navigate(['/cliente-detalle', c.id]); }

  // —— Navegación de las métricas (tarjetas accionables) ——
  irA(seccion: string) { this.router.navigate(['/recepcion', seccion]); }

  // —— Priorización de citas de hoy ——
  // Hora actual en zona Costa Rica (UTC-6) como "HH:mm" para comparar con la cita.
  private get ahoraCR(): string {
    return new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString().slice(11, 16);
  }
  // Cita agendada cuya hora ya pasó y que aún no ingresó al taller (sin orden).
  esAtrasada(c: any): boolean {
    return c.estado === 'agendado' && !c.orden_id && (c.hora || '') < this.ahoraCR;
  }
  // Id de la próxima cita por atender hoy (primera agendada cuya hora no pasó).
  get proximaId(): number | null {
    const p = this.citas.find(c => c.estado === 'agendado' && (c.hora || '') >= this.ahoraCR);
    return p ? p.id : null;
  }
  // Sucursales presentes en las citas de hoy (para el filtro). Distintas, ordenadas.
  get sucursalesHoy(): { id: number; nombre: string }[] {
    const map = new Map<number, string>();
    for (const c of this.citas) {
      if (c.sucursal_id && c.sucursal_nombre && !map.has(c.sucursal_id)) map.set(c.sucursal_id, c.sucursal_nombre);
    }
    return [...map].map(([id, nombre]) => ({ id, nombre })).sort((a, b) => a.nombre.localeCompare(b.nombre));
  }
  // Citas de hoy aplicando el filtro de sucursal (si hay uno activo).
  get citasVista(): any[] {
    return this.sucursalFiltro ? this.citas.filter(c => c.sucursal_id === this.sucursalFiltro) : this.citas;
  }
  setSucursalFiltro(v: number | '') { this.sucursalFiltro = v; }

  get totalConfirmadas(): number {
    return this.citas.filter(c => c.estado === 'agendado' && c.confirmada_cliente).length;
  }
  get totalSinConfirmar(): number {
    return this.citas.filter(c => c.estado === 'agendado' && !c.confirmada_cliente).length;
  }

  // —— Alertas accionables ——
  alertaClickable(a: any): boolean { return !!a.orden_id; }
  abrirAlerta(a: any) { if (a.orden_id) this.router.navigate(['/detalle-orden', a.orden_id]); }

  get nombre(): string { return this.auth.getUsuario()?.nombre || 'Recepción'; }
  get primerNombre(): string { return this.nombre.split(' ')[0]; }

  get fechaHoy(): string {
    return new Date().toLocaleDateString('es-CR', { weekday: 'long', day: 'numeric', month: 'long' });
  }

  cargar(ev?: any) {
    this.cargando = true;
    let pendientes = 3;
    const listo = () => { if (--pendientes <= 0) this.cargando = false; if (ev) ev.target.complete(); };
    this.rec.getResumen().subscribe({ next: r => { this.resumen = r.data; listo(); }, error: listo });
    this.rec.getCitasHoy().subscribe({ next: r => { this.citas = r.data; listo(); }, error: listo });
    this.rec.getAlertas().subscribe({ next: r => { this.alertas = r.data; listo(); }, error: listo });
  }

  // Ícono y color de cada alerta según su tipo.
  alertaIcono(a: any): string {
    if (a.tipo === 'foto') return 'camera-outline';
    if (a.titulo?.toLowerCase().includes('listo') || a.titulo?.toLowerCase().includes('entrega')) return 'checkmark-circle-outline';
    return 'notifications-outline';
  }
  alertaColor(a: any): string {
    if (a.tipo === 'foto') return 'rose';
    if (a.titulo?.toLowerCase().includes('listo') || a.titulo?.toLowerCase().includes('entrega')) return 'green';
    return 'amber';
  }
  alertaTexto(a: any): string {
    if (a.tipo === 'foto') {
      return `Nueva foto de ${a.tecnico_nombre || 'el mecánico'} · ${a.marca || ''} ${a.modelo || ''} (${a.numero_orden})`;
    }
    return a.titulo ? `${a.titulo} — ${a.mensaje}` : a.mensaje;
  }

  // Timestamp relativo: "Hace 10 min", "Hace 2 h", etc.
  hace(fecha: string): string {
    if (!fecha) return '';
    const diff = Date.now() - new Date(fecha).getTime();
    const min = Math.round(diff / 60000);
    if (min < 1) return 'Recién';
    if (min < 60) return `Hace ${min} min`;
    const h = Math.round(min / 60);
    if (h < 24) return `Hace ${h} h`;
    const d = Math.round(h / 24);
    return `Hace ${d} d`;
  }

  // Crea la orden de trabajo de una cita y abre su pantalla.
  crearOrden(c: any) {
    if (this.creandoOrden) return;
    this.creandoOrden = c.id;
    this.rec.crearOrdenDesdeCita(c.id).subscribe({
      next: async (r) => {
        this.creandoOrden = null;
        c.orden_id = r.data.orden_id;
        c.numero_orden = r.data.numero_orden;
        if (c.estado === 'agendado') c.estado = 'en_revision';
        const t = await this.toast.create({ message: `Orden ${r.data.numero_orden} creada`, duration: 1600, color: 'success' });
        await t.present();
        this.router.navigate(['/detalle-orden', r.data.orden_id]);
      },
      error: async (err) => {
        this.creandoOrden = null;
        const t = await this.toast.create({ message: err.error?.error || 'No se pudo crear la orden', duration: 2400, color: 'danger' });
        await t.present();
      },
    });
  }

  verOrden(c: any) { this.router.navigate(['/detalle-orden', c.orden_id]); }

  logout() {
    this.auth.logout();
    this.router.navigate(['/portal/login'], { replaceUrl: true });
  }
}
