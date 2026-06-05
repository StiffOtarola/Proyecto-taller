import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, tap } from 'rxjs';
import { environment } from '../../environments/environment';

export interface ClientePortal {
  id: number;
  tipo: 'cliente';
  nombre: string;
  apellido: string;
}

const TOKEN_KEY = 'tallerms_portal_token';
const CLIENTE_KEY = 'tallerms_portal_cliente';

@Injectable({ providedIn: 'root' })
export class PortalService {
  private url = `${environment.apiUrl}/portal`;
  private clienteSubject = new BehaviorSubject<ClientePortal | null>(this.getClienteGuardado());
  cliente$ = this.clienteSubject.asObservable();

  constructor(private http: HttpClient) {}

  login(email: string, password: string): Observable<{ data: { token: string; cliente: ClientePortal } }> {
    return this.http.post<{ data: { token: string; cliente: ClientePortal } }>(`${this.url}/login`, { email, password }).pipe(
      tap(res => {
        localStorage.setItem(TOKEN_KEY, res.data.token);
        localStorage.setItem(CLIENTE_KEY, JSON.stringify(res.data.cliente));
        this.clienteSubject.next(res.data.cliente);
      })
    );
  }

  registro(data: { nombre: string; apellido: string; telefono: string; email: string; cedula?: string; password: string }): Observable<{ data: { token: string; cliente: ClientePortal } }> {
    return this.http.post<{ data: { token: string; cliente: ClientePortal } }>(`${this.url}/registro`, data).pipe(
      tap(res => this.guardarSesion(res.data.token, res.data.cliente))
    );
  }

  // Paso 1: pide que envíen un código de recuperación al correo (respuesta genérica).
  solicitarCodigo(email: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.url}/recuperar/solicitar`, { email });
  }

  // Paso 2: valida el código y define la nueva contraseña (auto-login).
  confirmarRecuperacion(data: { email: string; codigo: string; password: string }): Observable<{ data: { token: string; cliente: ClientePortal } }> {
    return this.http.post<{ data: { token: string; cliente: ClientePortal } }>(`${this.url}/recuperar/confirmar`, data).pipe(
      tap(res => this.guardarSesion(res.data.token, res.data.cliente))
    );
  }

  // Guarda la sesión del cliente (la usa el login unificado cuando tipo === 'cliente').
  aplicarSesion(token: string, cliente: ClientePortal) {
    this.guardarSesion(token, cliente);
  }

  private guardarSesion(token: string, cliente: ClientePortal) {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(CLIENTE_KEY, JSON.stringify(cliente));
    this.clienteSubject.next(cliente);
  }

  logout() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(CLIENTE_KEY);
    this.clienteSubject.next(null);
  }

  getToken(): string | null { return localStorage.getItem(TOKEN_KEY); }
  getCliente(): ClientePortal | null { return this.clienteSubject.value; }
  isLoggedIn(): boolean { return !!this.getToken(); }

  getOrdenes(): Observable<{ data: any[] }> {
    return this.http.get<{ data: any[] }>(`${this.url}/ordenes`);
  }

  getOrden(id: number): Observable<{ data: any }> {
    return this.http.get<{ data: any }>(`${this.url}/ordenes/${id}`);
  }

  aprobar(id: number): Observable<any> {
    return this.http.post(`${this.url}/ordenes/${id}/aprobar`, {});
  }

  rechazar(id: number, motivo: string): Observable<any> {
    return this.http.post(`${this.url}/ordenes/${id}/rechazar`, { motivo });
  }

  getMotos(): Observable<{ data: any[] }> {
    return this.http.get<{ data: any[] }>(`${this.url}/motos`);
  }

  crearMoto(data: { marca: string; modelo: string; placa: string; anio?: number | null; color?: string; kilometraje_actual?: number | null }): Observable<{ data: any }> {
    return this.http.post<{ data: any }>(`${this.url}/motos`, data);
  }

  getCitas(): Observable<{ data: any[] }> {
    return this.http.get<{ data: any[] }>(`${this.url}/citas`);
  }

  crearCita(data: { moto_id?: number | null; fecha: string; hora: string; motivo: string; tipo_servicio?: string | null }): Observable<{ data: any }> {
    return this.http.post<{ data: any }>(`${this.url}/citas`, data);
  }

  calificarCita(id: number, calificacion: number, comentario?: string): Observable<any> {
    return this.http.post(`${this.url}/citas/${id}/calificar`, { calificacion, comentario });
  }

  enviarEncuesta(id: number, calificacion: number, comentario?: string): Observable<any> {
    return this.http.post(`${this.url}/ordenes/${id}/encuesta`, { calificacion, comentario });
  }

  getPromos(): Observable<{ data: any[] }> {
    return this.http.get<{ data: any[] }>(`${this.url}/promos`);
  }

  getFidelidad(): Observable<{ data: { visitas: number; cortesia_disponible: boolean; meta: number; faltan: number } }> {
    return this.http.get<{ data: any }>(`${this.url}/fidelidad`);
  }

  private getClienteGuardado(): ClientePortal | null {
    try {
      const raw = localStorage.getItem(CLIENTE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }
}
