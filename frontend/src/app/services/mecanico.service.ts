import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface ResumenMecanico {
  citas_hoy: number;
  completadas_hoy: number;
  en_proceso: number;
  monto_promedio: number;
  tiempo_promedio_min: number;
  calificacion_promedio: number | null;
  calificacion_total: number;
}

@Injectable({ providedIn: 'root' })
export class MecanicoService {
  private url = `${environment.apiUrl}/mecanico`;
  constructor(private http: HttpClient) {}

  getResumen(): Observable<{ data: ResumenMecanico }> {
    return this.http.get<{ data: ResumenMecanico }>(`${this.url}/resumen`);
  }

  getCitas(params?: { fecha?: string; estado?: string }): Observable<{ data: any[] }> {
    return this.http.get<{ data: any[] }>(`${this.url}/citas`, { params: params as any });
  }

  getAgenda(desde: string, hasta: string): Observable<{ data: any[] }> {
    return this.http.get<{ data: any[] }>(`${this.url}/agenda`, { params: { desde, hasta } as any });
  }

  cambiarEstado(id: number, estado: string, monto?: number | null): Observable<any> {
    return this.http.patch(`${this.url}/citas/${id}/estado`, { estado, monto });
  }
}
