// Utilidades compartidas de órdenes de trabajo y su puente con las citas.
const { pool } = require('../db/pool');
const { notificarCambioEstado } = require('./notificaciones');

// Mapeo del flujo rico de la orden → flujo simple de la cita (lo que ve el cliente).
const MAP_ORDEN_A_CITA = {
  recepcion: 'agendado',
  diagnostico: 'en_revision',
  esperando_aprobacion: 'en_revision',
  esperando_repuestos: 'en_revision',
  en_reparacion: 'en_mantenimiento',
  lista_entrega: 'listo',
  entregada: 'entregado',
  cancelada: 'cancelado',
};

// Genera numero_orden OT-YYYY-XXXX con un contador atómico por año.
// El INSERT y el SELECT corren en la MISMA conexión (LAST_INSERT_ID es por conexión).
async function generarNumeroOrden() {
  const year = new Date().getFullYear();
  const conn = await pool.getConnection();
  try {
    await conn.query(
      `INSERT INTO orden_contadores (anio, ultimo) VALUES (?, LAST_INSERT_ID(1))
       ON DUPLICATE KEY UPDATE ultimo = LAST_INSERT_ID(ultimo + 1)`,
      [year]
    );
    const [[{ n }]] = await conn.query('SELECT LAST_INSERT_ID() AS n');
    return `OT-${year}-${String(n).padStart(4, '0')}`;
  } finally {
    conn.release();
  }
}

// Refleja el estado de una orden en su cita vinculada (si existe). Nunca lanza:
// si algo falla, lo loguea y sigue (no debe romper el cambio de estado de la orden).
async function sincronizarCitaDesdeOrden(ordenId, ordenEstado) {
  try {
    const estadoCita = MAP_ORDEN_A_CITA[ordenEstado];
    if (!estadoCita) return;
    const [[cita]] = await pool.query('SELECT id, estado FROM citas WHERE orden_id = ? LIMIT 1', [ordenId]);
    if (!cita || cita.estado === estadoCita) return; // sin cita o sin cambio real

    const sets = ['estado = ?'];
    const params = [estadoCita];
    // Marca el inicio del trabajo al arrancar.
    if (cita.estado === 'agendado' && estadoCita !== 'agendado' && estadoCita !== 'cancelado') {
      sets.push('fecha_inicio = COALESCE(fecha_inicio, NOW())');
    }
    // Al entregar: cierra la cita y copia el total de la orden como monto (única cifra coherente).
    if (estadoCita === 'entregado') {
      sets.push('fecha_fin = NOW()');
      const [[o]] = await pool.query(
        'SELECT (costo_mano_obra + costo_repuestos - descuento) AS total FROM ordenes_trabajo WHERE id = ?',
        [ordenId]
      );
      if (o) { sets.push('monto = ?'); params.push(Number(o.total) || 0); }
    }
    params.push(cita.id);
    await pool.query(`UPDATE citas SET ${sets.join(', ')} WHERE id = ?`, params);
    await notificarCambioEstado(cita.id, estadoCita);
  } catch (err) {
    console.error('⚠️  No se pudo sincronizar la cita desde la orden:', err.message);
  }
}

module.exports = { generarNumeroOrden, MAP_ORDEN_A_CITA, sincronizarCitaDesdeOrden };
