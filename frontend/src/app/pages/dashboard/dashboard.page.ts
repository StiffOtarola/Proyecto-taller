import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { DashboardService } from '../../services/dashboard.service';

@Component({ standalone: false,
  selector: 'app-dashboard',
  templateUrl: './dashboard.page.html',
  styleUrls: ['./dashboard.page.scss'],
})
export class DashboardPage implements OnInit {
  resumen: any = null;
  tecnicos: any[] = [];
  atrasos: any[] = [];
  tiempos: any[] = [];
  cargando = true;

  // Etiquetas legibles para las etapas en la tabla de tiempos
  readonly etapaLabel: Record<string, string> = {
    recepcion: 'Recepción',
    diagnostico: 'Diagnóstico',
    esperando_aprobacion: 'Esperando aprobación',
    esperando_repuestos: 'Esperando repuestos',
    en_reparacion: 'En reparación',
    lista_entrega: 'Lista para entrega',
  };

  constructor(
    public auth: AuthService,
    private dashSvc: DashboardService,
    private router: Router
  ) {}

  ngOnInit() {
    this.cargar();
  }

  ionViewWillEnter() {
    this.cargar();
  }

  cargar() {
    this.cargando = true;
    this.dashSvc.getResumen().subscribe({
      next: res => {
        this.resumen = res.data;
        this.cargando = false;
      },
      error: () => { this.cargando = false; },
    });
    this.dashSvc.getTecnicos().subscribe({
      next: res => { this.tecnicos = res.data; },
    });
    this.dashSvc.getAtrasos().subscribe({
      next: res => { this.atrasos = res.data; },
    });
    this.dashSvc.getTiempos().subscribe({
      next: res => { this.tiempos = res.data; },
    });
  }

  // Semáforo de entrega: rojo = atrasada, amarillo = vence en ≤1 día, verde = a tiempo
  semaforo(dias: number | null): 'rojo' | 'amarillo' | 'verde' | 'gris' {
    if (dias === null || dias === undefined) return 'gris';
    if (dias < 0) return 'rojo';
    if (dias <= 1) return 'amarillo';
    return 'verde';
  }

  semaforoColor(dias: number | null): string {
    return { rojo: 'danger', amarillo: 'warning', verde: 'success', gris: 'medium' }[this.semaforo(dias)];
  }

  semaforoTexto(dias: number | null): string {
    if (dias === null || dias === undefined) return 'Sin fecha';
    if (dias < 0) return `Atrasada ${Math.abs(dias)}d`;
    if (dias === 0) return 'Vence hoy';
    if (dias === 1) return 'Vence mañana';
    return `${dias}d restantes`;
  }

  get countRojo(): number { return this.atrasos.filter(a => this.semaforo(a.dias_restantes) === 'rojo').length; }
  get countAmarillo(): number { return this.atrasos.filter(a => this.semaforo(a.dias_restantes) === 'amarillo').length; }
  get countVerde(): number { return this.atrasos.filter(a => this.semaforo(a.dias_restantes) === 'verde').length; }

  abrirOrden(id: number) {
    this.router.navigate(['/detalle-orden', id]);
  }

  logout() {
    this.auth.logout();
    this.router.navigate(['/login'], { replaceUrl: true });
  }

  irNuevaOrden() {
    this.router.navigate(['/nueva-orden']);
  }
}
