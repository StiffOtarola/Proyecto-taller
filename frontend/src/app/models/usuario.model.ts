export interface Usuario {
  id?: number;
  nombre: string;
  email: string;
  telefono?: string;
  rol: 'recepcion' | 'tecnico' | 'admin';
  activo?: number;
  created_at?: string;
}

export interface LoginResponse {
  token: string;
  usuario: Usuario;
}
