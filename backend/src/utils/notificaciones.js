const { pool } = require('../db/pool');
const { getConfig } = require('./configuracion');

const ESTADO_LEGIBLE = {
  agendado: 'Agendada',
  en_revision: 'En revisión',
  en_mantenimiento: 'En mantenimiento',
  listo: 'Lista para entrega',
  entregado: 'Entregada',
  cancelado: 'Cancelada',
};

// Registra un aviso para el cliente cuando cambia el estado de su cita.
// Nunca lanza: si algo falla, lo loguea y sigue (no debe romper el cambio de estado).
async function notificarCambioEstado(citaId, estado) {
  try {
    // Preferencia del taller: si está apagado, no se avisa al cliente por cambio de estado.
    const config = await getConfig();
    if (!config.notif_estado) return;
    const [[cita]] = await pool.query(
      `SELECT ci.cliente_id, m.marca, m.modelo
       FROM citas ci LEFT JOIN motos m ON m.id = ci.moto_id
       WHERE ci.id = ?`,
      [citaId]
    );
    if (!cita) return;
    const moto = [cita.marca, cita.modelo].filter(Boolean).join(' ') || 'tu moto';
    const legible = ESTADO_LEGIBLE[estado] || estado;
    await pool.query(
      'INSERT INTO notificaciones (cliente_id, cita_id, titulo, mensaje) VALUES (?, ?, ?, ?)',
      [cita.cliente_id, citaId, `${moto}: ${legible}`, `El estado de tu cita cambió a "${legible}".`]
    );
  } catch (err) {
    console.error('⚠️  No se pudo crear notificación:', err.message);
  }
}

module.exports = { notificarCambioEstado, ESTADO_LEGIBLE };
