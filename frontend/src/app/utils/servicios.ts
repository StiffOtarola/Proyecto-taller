// Catálogo de servicios y estados de cita (frontend). Debe coincidir con backend/src/utils/servicios.js.
export const SERVICIOS = [
  'Cambio de aceite y filtros',
  'Revisión completa',
  'Cambio de pastillas de freno',
  'Kit de transmisión (cadena y piñones)',
  'Diagnóstico electrónico',
  'Cambio de neumáticos',
];

export const HORAS = ['08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00'];

// Flujo de estados de la cita (para la barra de progreso del cliente).
export const FLUJO_CITA = ['agendado', 'en_revision', 'en_mantenimiento', 'listo', 'entregado'];

export const ESTADO_CITA_LABEL: Record<string, string> = {
  agendado: 'Agendado',
  en_revision: 'En revisión',
  en_mantenimiento: 'En mantenimiento',
  listo: 'Listo',
  entregado: 'Entregado',
  cancelado: 'Cancelado',
};
