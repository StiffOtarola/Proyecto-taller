import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, tap } from 'rxjs';
import { environment } from '../../environments/environment';
import { Usuario, LoginResponse } from '../models/usuario.model';

const TOKEN_KEY = 'tallerms_token';
const USUARIO_KEY = 'tallerms_usuario';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private apiUrl = environment.apiUrl;
  private usuarioSubject = new BehaviorSubject<Usuario | null>(this.getUsuarioGuardado());

  usuario$ = this.usuarioSubject.asObservable();

  constructor(private http: HttpClient) {}

  login(email: string, password: string): Observable<{ data: LoginResponse }> {
    return this.http.post<{ data: LoginResponse }>(`${this.apiUrl}/auth/login`, { email, password }).pipe(
      tap(res => {
        localStorage.setItem(TOKEN_KEY, res.data.token);
        localStorage.setItem(USUARIO_KEY, JSON.stringify(res.data.usuario));
        this.usuarioSubject.next(res.data.usuario);
      })
    );
  }

  // Login unificado (personal o cliente). No persiste: el llamador decide según `tipo`.
  loginUnificado(email: string, password: string): Observable<{ data: { token: string; tipo: 'staff' | 'cliente'; usuario?: Usuario; cliente?: any } }> {
    return this.http.post<{ data: { token: string; tipo: 'staff' | 'cliente'; usuario?: Usuario; cliente?: any } }>(
      `${this.apiUrl}/auth/login`, { email, password }
    );
  }

  // Guarda la sesión del personal (la usa el login unificado cuando tipo === 'staff').
  aplicarSesionStaff(token: string, usuario: Usuario) {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USUARIO_KEY, JSON.stringify(usuario));
    this.usuarioSubject.next(usuario);
  }

  logout() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USUARIO_KEY);
    this.usuarioSubject.next(null);
  }

  getToken(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  }

  getUsuario(): Usuario | null {
    return this.usuarioSubject.value;
  }

  isLoggedIn(): boolean {
    return !!this.getToken();
  }

  tieneRol(...roles: string[]): boolean {
    const usuario = this.getUsuario();
    return !!usuario && roles.includes(usuario.rol);
  }

  private getUsuarioGuardado(): Usuario | null {
    try {
      const raw = localStorage.getItem(USUARIO_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }
}
