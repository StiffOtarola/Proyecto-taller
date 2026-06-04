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

  private getClienteGuardado(): ClientePortal | null {
    try {
      const raw = localStorage.getItem(CLIENTE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }
}
