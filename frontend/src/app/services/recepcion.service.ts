import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface ResumenRecepcion {
  citas_hoy: number;
  ordenes_activas: number;
  cotizaciones_pendientes: number;
  mecanicos_ocupados: number;
  mecanicos_totales: number;
}

@Injectable({ providedIn: 'root' })
export class RecepcionService {
  private url = `${environment.apiUrl}/recepcion`;
  constructor(private http: HttpClient) {}

  // Inicio
  getResumen(): Observable<{ data: ResumenRecepcion }> {
    return this.http.get<{ data: ResumenRecepcion }>(`${this.url}/resumen`);
  }
  getCitasHoy(): Observable<{ data: any[] }> {
    return this.http.get<{ data: any[] }>(`${this.url}/citas-hoy`);
  }
  getAlertas(): Observable<{ data: any[] }> {
    return this.http.get<{ data: any[] }>(`${this.url}/alertas`);
  }

  // Órdenes + evidencias
  getOrdenes(estado?: 'activas' | 'completadas'): Observable<{ data: any[] }> {
    const params = estado === 'completadas' ? ({ estado: 'completadas' } as any) : undefined;
    return this.http.get<{ data: any[] }>(`${this.url}/ordenes`, { params });
  }
  getFotosOrden(id: number): Observable<{ data: any[] }> {
    return this.http.get<{ data: any[] }>(`${this.url}/ordenes/${id}/fotos`);
  }
  subirFoto(id: number, foto: { url: string; tipo: string; descripcion?: string }): Observable<{ data: any }> {
    return this.http.post<{ data: any }>(`${this.url}/ordenes/${id}/fotos`, foto);
  }

  // Cotizaciones
  getCotizaciones(estado?: 'pendiente' | 'enviada'): Observable<{ data: any[] }> {
    const params = estado ? ({ estado } as any) : undefined;
    return this.http.get<{ data: any[] }>(`${this.url}/cotizaciones`, { params });
  }
  getRepuestos(id: number): Observable<{ data: any[] }> {
    return this.http.get<{ data: any[] }>(`${this.url}/cotizaciones/${id}/repuestos`);
  }
  addRepuesto(id: number, data: any): Observable<{ data: any }> {
    return this.http.post<{ data: any }>(`${this.url}/cotizaciones/${id}/repuestos`, data);
  }
  updateRepuesto(ordenId: number, repuestoId: number, data: any): Observable<any> {
    return this.http.put(`${this.url}/cotizaciones/${ordenId}/repuestos/${repuestoId}`, data);
  }
  deleteRepuesto(ordenId: number, repuestoId: number): Observable<any> {
    return this.http.delete(`${this.url}/cotizaciones/${ordenId}/repuestos/${repuestoId}`);
  }
  updateCostos(id: number, data: { costo_mano_obra: number; descuento: number }): Observable<any> {
    return this.http.put(`${this.url}/cotizaciones/${id}/costos`, data);
  }
  enviarCotizacion(id: number): Observable<any> {
    return this.http.post(`${this.url}/cotizaciones/${id}/enviar`, {});
  }
  aprobarCotizacion(id: number): Observable<any> {
    return this.http.post(`${this.url}/cotizaciones/${id}/aprobar`, {});
  }
  asignarTecnico(ordenId: number, tecnico_id: number | null): Observable<any> {
    return this.http.patch(`${this.url}/ordenes/${ordenId}/tecnico`, { tecnico_id });
  }
  getOrdenesCliente(clienteId: number): Observable<{ data: any[] }> {
    return this.http.get<{ data: any[] }>(`${this.url}/clientes/${clienteId}/ordenes`);
  }
  getTecnicos(): Observable<{ data: any[] }> {
    return this.http.get<{ data: any[] }>(`${this.url}/tecnicos`);
  }

  // Clientes
  getClientes(q?: string): Observable<{ data: any[] }> {
    const params = q ? ({ q } as any) : undefined;
    return this.http.get<{ data: any[] }>(`${this.url}/clientes`, { params });
  }

  // Mensajes
  getAvances(): Observable<{ data: any[] }> {
    return this.http.get<{ data: any[] }>(`${this.url}/avances`);
  }
  getNotificaciones(): Observable<{ data: any[] }> {
    return this.http.get<{ data: any[] }>(`${this.url}/notificaciones`);
  }
  notificar(data: { cliente_id: number; cita_id?: number; titulo: string; mensaje: string }): Observable<any> {
    return this.http.post(`${this.url}/notificar`, data);
  }

  // Mensajería interna con los mecánicos
  getMensajesInternos(): Observable<{ data: any[] }> {
    return this.http.get<{ data: any[] }>(`${this.url}/mensajes-internos`);
  }
  responderInterno(destino_id: number, mensaje: string): Observable<{ data: any }> {
    return this.http.post<{ data: any }>(`${this.url}/mensajes-internos`, { destino_id, mensaje });
  }
}
