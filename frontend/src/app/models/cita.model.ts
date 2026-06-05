export type EstadoCita = 'agendado' | 'en_revision' | 'en_mantenimiento' | 'listo' | 'entregado' | 'cancelado';

export interface Cita {
  id?: number;
  cliente_id: number;
  moto_id?: number | null;
  usuario_id?: number | null;
  tecnico_id?: number | null;
  fecha: string;
  hora: string;
  motivo: string;
  tipo_servicio?: string | null;
  estado?: EstadoCita;
  monto?: number;
  calificacion?: number | null;
  // Campos enriquecidos
  usuario_nombre?: string | null;
  tecnico_nombre?: string | null;
  cliente_nombre?: string;
  cliente_apellido?: string;
  cliente_telefono?: string;
  marca?: string;
  modelo?: string;
  placa?: string;
}
