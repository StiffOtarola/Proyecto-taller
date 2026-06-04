export type EstadoGarantia = 'abierto' | 'en_revision' | 'aprobado' | 'rechazado' | 'resuelto';

export interface GarantiaFoto {
  id?: number;
  garantia_id?: number;
  url: string;
  descripcion?: string | null;
  created_at?: string;
}

export interface Garantia {
  id?: number;
  orden_id: number;
  descripcion_problema: string;
  cubre_repuestos?: number | boolean;
  cubre_mano_obra?: number | boolean;
  estado?: EstadoGarantia;
  resolucion?: string | null;
  creado_por?: number;
  created_at?: string;
  updated_at?: string;
  // Enriquecidos del JOIN
  numero_orden?: string;
  fecha_entrega_real?: string | null;
  garantia_dias?: number;
  marca?: string;
  modelo?: string;
  placa?: string;
  cliente_nombre?: string;
  cliente_apellido?: string;
  cliente_telefono?: string;
  creado_por_nombre?: string;
  fotos?: GarantiaFoto[];
}

export const ESTADO_GARANTIA_CONFIG: Record<EstadoGarantia, { label: string; color: string }> = {
  abierto:     { label: 'Abierto',      color: 'primary' },
  en_revision: { label: 'En revisión',  color: 'warning' },
  aprobado:    { label: 'Aprobado',     color: 'success' },
  rechazado:   { label: 'Rechazado',    color: 'danger' },
  resuelto:    { label: 'Resuelto',     color: 'medium' },
};
