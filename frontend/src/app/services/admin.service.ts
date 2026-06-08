import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class AdminService {
  private url = `${environment.apiUrl}/admin`;
  private citasUrl = `${environment.apiUrl}/citas`;
  constructor(private http: HttpClient) {}

  // Resumen ejecutivo (KPIs + top servicios + estado de citas + ingresos por servicio).
  getResumen(): Observable<{ data: any }> {
    return this.http.get<{ data: any }>(`${this.url}/resumen`);
  }

  // Gestión de citas: reusa /api/citas con filtros (estado, búsqueda, fecha).
  getCitas(filtros: { estado?: string; q?: string; fecha?: string } = {}): Observable<{ data: any[] }> {
    const params: any = {};
    if (filtros.estado) params.estado = filtros.estado;
    if (filtros.q) params.q = filtros.q;
    if (filtros.fecha) params.fecha = filtros.fecha;
    return this.http.get<{ data: any[] }>(this.citasUrl, { params });
  }

  // Reportes analíticos por período (KPIs, serie, ingresos por servicio, rendimiento).
  getReportes(filtros: { periodo?: string; empleado?: number | null } = {}): Observable<{ data: any }> {
    const params: any = {};
    if (filtros.periodo) params.periodo = filtros.periodo;
    if (filtros.empleado) params.empleado = filtros.empleado;
    return this.http.get<{ data: any }>(`${this.url}/reportes`, { params });
  }

  // Asignar tareas a los mecánicos.
  getTareas(empleado?: number | null): Observable<{ data: any[] }> {
    const params: any = {};
    if (empleado) params.empleado = empleado;
    return this.http.get<{ data: any[] }>(`${this.url}/tareas`, { params });
  }
  crearTarea(t: { tecnico_id: number; titulo: string; detalle?: string; prioridad?: string; vence?: string | null }): Observable<{ data: any }> {
    return this.http.post<{ data: any }>(`${this.url}/tareas`, t);
  }
  borrarTarea(id: number): Observable<any> {
    return this.http.delete(`${this.url}/tareas/${id}`);
  }
}
