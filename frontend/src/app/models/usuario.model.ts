export interface Usuario {
  id?: number;
  nombre: string;
  email: string;
  telefono?: string;
  rol: 'recepcion' | 'tecnico' | 'admin';
  sucursal_id?: number | null;       // local del empleado (null = atiende ambas)
  sucursal_nombre?: string | null;
  activo?: number;
  created_at?: string;
}

export interface LoginResponse {
  token: string;
  usuario: Usuario;
}
