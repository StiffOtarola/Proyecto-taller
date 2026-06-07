export interface Usuario {
  id?: number;
  nombre: string;
  email: string;
  telefono?: string;
  rol: 'recepcion' | 'tecnico' | 'jefe_taller' | 'admin' | 'gerencia';
  activo?: number;
  created_at?: string;
}

export interface LoginResponse {
  token: string;
  usuario: Usuario;
}
