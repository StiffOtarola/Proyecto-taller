export interface Cita {
  id?: number;
  cliente_id: number;
  moto_id?: number | null;
  usuario_id?: number;
  fecha: string;
  hora: string;
  motivo: string;
  estado?: 'pendiente' | 'confirmada' | 'cancelada' | 'completada';
  // Campos enriquecidos
  cliente_nombre?: string;
  cliente_apellido?: string;
  cliente_telefono?: string;
  marca?: string;
  modelo?: string;
  placa?: string;
}
