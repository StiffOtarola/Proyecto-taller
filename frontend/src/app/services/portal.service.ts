import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, tap } from 'rxjs';
import { environment } from '../../environments/environment';

export interface ClientePortal {
  id: number;
  tipo: 'cliente';
  nombre: string;
  apellido: string;
  foto?: string | null;
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

  // Presupuestos del cliente: aprobar/rechazar una orden enviada por recepción.
  // Los endpoints existen en el backend; la pantalla del portal está pendiente (auditoría #2).
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

  crearMoto(data: { marca: string; modelo: string; placa: string; anio?: number | null; color?: string; kilometraje_actual?: number | null; foto?: string | null }): Observable<{ data: any }> {
    return this.http.post<{ data: any }>(`${this.url}/motos`, data);
  }

  editarMoto(id: number, data: { marca: string; modelo: string; placa: string; anio?: number | null; color?: string; kilometraje_actual?: number | null; foto?: string | null }): Observable<{ data: any }> {
    return this.http.put<{ data: any }>(`${this.url}/motos/${id}`, data);
  }

  eliminarMoto(id: number): Observable<any> {
    return this.http.delete(`${this.url}/motos/${id}`);
  }

  getCitas(): Observable<{ data: any[] }> {
    return this.http.get<{ data: any[] }>(`${this.url}/citas`);
  }

  getCita(id: number): Observable<{ data: any }> {
    return this.http.get<{ data: any }>(`${this.url}/citas/${id}`);
  }

  cancelarCita(id: number): Observable<any> {
    return this.http.patch(`${this.url}/citas/${id}/cancelar`, {});
  }

  // El cliente confirma que asistirá a su cita agendada.
  confirmarCita(id: number): Observable<any> {
    return this.http.patch(`${this.url}/citas/${id}/confirmar`, {});
  }

  crearCita(data: { moto_id: number; fecha: string; hora: string; tipo_servicio: string; descripcion?: string }): Observable<{ data: any }> {
    return this.http.post<{ data: any }>(`${this.url}/citas`, data);
  }

  editarCita(id: number, data: { moto_id: number; fecha: string; hora: string; tipo_servicio: string; descripcion?: string }): Observable<{ data: any }> {
    return this.http.put<{ data: any }>(`${this.url}/citas/${id}`, data);
  }

  getResumen(): Observable<{ data: any }> {
    return this.http.get<{ data: any }>(`${this.url}/resumen`);
  }

  getNotificaciones(): Observable<{ data: any[] }> {
    return this.http.get<{ data: any[] }>(`${this.url}/notificaciones`);
  }

  leerNotificaciones(): Observable<any> {
    return this.http.post(`${this.url}/notificaciones/leer`, {});
  }

  getDisponibilidad(fecha: string): Observable<{ data: { horas: string[]; max: number; ocupacion: Record<string, number> } }> {
    return this.http.get<{ data: any }>(`${this.url}/disponibilidad`, { params: { fecha } as any });
  }

  calificarCita(id: number, calificacion: number, comentario?: string): Observable<any> {
    return this.http.post(`${this.url}/citas/${id}/calificar`, { calificacion, comentario });
  }

  getPromos(): Observable<{ data: any[] }> {
    return this.http.get<{ data: any[] }>(`${this.url}/promos`);
  }

  // —— Perfil (Mi cuenta + Seguridad) ——
  getMiPerfil(): Observable<{ data: any }> {
    return this.http.get<{ data: any }>(`${this.url}/perfil`);
  }

  updateMiPerfil(data: { nombre: string; apellido: string; telefono: string; email: string }): Observable<{ data: any }> {
    return this.http.put<{ data: any }>(`${this.url}/perfil`, data);
  }

  updateMiPassword(data: { actual: string; nueva: string }): Observable<any> {
    return this.http.put(`${this.url}/perfil/password`, data);
  }

  // Sube/cambia/quita la foto de perfil (foto = data URL base64, o null para quitarla).
  actualizarFotoPerfil(foto: string | null): Observable<{ data: { foto: string | null } }> {
    return this.http.put<{ data: { foto: string | null } }>(`${this.url}/perfil/foto`, { foto });
  }

  eliminarCuenta(): Observable<any> {
    return this.http.delete(`${this.url}/perfil`);
  }

  // Refresca el nombre/apellido guardados (saludo del inicio) tras editar el perfil,
  // sin necesidad de un token nuevo.
  actualizarClienteLocal(parcial: Partial<ClientePortal>) {
    const actual = this.clienteSubject.value;
    if (!actual) return;
    const merge = { ...actual, ...parcial };
    localStorage.setItem(CLIENTE_KEY, JSON.stringify(merge));
    this.clienteSubject.next(merge);
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
