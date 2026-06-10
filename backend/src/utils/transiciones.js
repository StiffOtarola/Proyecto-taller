// Máquinas de estado del negocio: transiciones permitidas desde cada estado.
// Un estado terminal (entregada/entregado, cancelada/cancelado) no tiene salida.
// La validación se aplica en los endpoints que recibe el usuario; la sincronización
// interna orden→cita (utils/ordenes.js) escribe el estado mapeado sin pasar por acá.

// Órdenes de trabajo (ordenes_trabajo.estado). "entregada" se alcanza solo vía
// PATCH /ordenes/:id/cerrar (cierre + fidelización), no por cambio de estado directo.
const TRANSICIONES_ORDEN = {
  recepcion: ['diagnostico', 'cancelada'],
  diagnostico: ['esperando_aprobacion', 'esperando_repuestos', 'en_reparacion', 'cancelada'],
  esperando_aprobacion: ['esperando_repuestos', 'en_reparacion', 'cancelada'],
  esperando_repuestos: ['en_reparacion', 'cancelada'],
  en_reparacion: ['lista_entrega', 'esperando_repuestos', 'cancelada'],
  lista_entrega: ['en_reparacion', 'cancelada'],
  entregada: [],
  cancelada: [],
};

// Citas (citas.estado), el flujo simple que ve el cliente.
const TRANSICIONES_CITA = {
  agendado: ['en_revision', 'cancelado'],
  en_revision: ['en_mantenimiento', 'listo', 'cancelado'],
  en_mantenimiento: ['listo', 'cancelado'],
  listo: ['entregado', 'cancelado'],
  entregado: [],
  cancelado: [],
};

// ¿Se permite ir de `desde` a `hacia`? El no-op (mismo estado) siempre se permite,
// para que un reintento de la UI no falle.
function transicionPermitida(mapa, desde, hacia) {
  if (desde === hacia) return true;
  return Array.isArray(mapa[desde]) && mapa[desde].includes(hacia);
}

module.exports = { TRANSICIONES_ORDEN, TRANSICIONES_CITA, transicionPermitida };
