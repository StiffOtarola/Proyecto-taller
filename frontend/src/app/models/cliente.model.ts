export interface Cliente {
  id?: number;
  nombre: string;
  apellido: string;
  telefono: string;
  email?: string | null;
  cedula?: string | null;
  direccion?: string | null;
  activo?: number;
  created_at?: string;
}
