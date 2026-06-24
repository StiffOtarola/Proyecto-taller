// Utilidades compartidas de órdenes de trabajo y su puente con las citas.
const { pool } = require('../db/pool');
const { notificarCambioEstado } = require('./notificaciones');
const { getConfig } = require('./configuracion');

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

// Fidelización: cada cuántas entregas el cliente gana una cortesía (configurable desde admin).

// Cierra (entrega) una orden en una transacción: la marca entregada, registra pago,
// garantía y observaciones, cuenta la visita una sola vez y otorga cortesía cada N
// entregas; luego sincroniza la cita vinculada. Compartido por el cierre de admin y
// la entrega de recepción para no duplicar la lógica de fidelización.
// Devuelve { notFound } | { estadoInvalido, estadoActual } | { cortesiaGanada }.
async function cerrarOrden(ordenId, datos = {}, opciones = {}) {
  const { metodo_pago, garantia_dias, observaciones_finales } = datos;
  const { soloDesdeListaEntrega = false } = opciones;
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [[orden]] = await conn.query(
      'SELECT estado, cliente_id, visita_contada FROM ordenes_trabajo WHERE id = ? FOR UPDATE',
      [ordenId]
    );
    if (!orden) { await conn.rollback(); return { notFound: true }; }
    // Recepción solo entrega órdenes que el mecánico ya dejó listas.
    if (soloDesdeListaEntrega && orden.estado !== 'lista_entrega') {
      await conn.rollback();
      return { estadoInvalido: true, estadoActual: orden.estado };
    }
    await conn.query(
      `UPDATE ordenes_trabajo SET estado='entregada', metodo_pago=?, garantia_dias=?,
       observaciones_finales=?, fecha_entrega_real=NOW() WHERE id=?`,
      [metodo_pago || null, garantia_dias || 0, observaciones_finales || null, ordenId]
    );

    let cortesiaGanada = false;
    if (!orden.visita_contada) {
      await conn.query('UPDATE ordenes_trabajo SET visita_contada = 1 WHERE id = ?', [ordenId]);
      await conn.query('UPDATE clientes SET visitas = visitas + 1 WHERE id = ?', [orden.cliente_id]);
      const [[cli]] = await conn.query('SELECT visitas FROM clientes WHERE id = ?', [orden.cliente_id]);
      const config = await getConfig();
      const visitasParaCortesia = Number(config.visitas_para_cortesia) || 7;
      if (cli && cli.visitas > 0 && cli.visitas % visitasParaCortesia === 0) {
        await conn.query('UPDATE clientes SET cortesia_disponible = 1 WHERE id = ?', [orden.cliente_id]);
        cortesiaGanada = true;
      }
    }

    await conn.commit();
    await sincronizarCitaDesdeOrden(ordenId, 'entregada');
    return { cortesiaGanada };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

// Etapas que llevan registro de tiempo (orden_tiempos). Espejo de ordenes.routes.
const ETAPAS_TIEMPO = ['recepcion', 'diagnostico', 'esperando_aprobacion', 'esperando_repuestos', 'en_reparacion', 'lista_entrega'];

// Avance de estado dirigido por el sistema (no por el usuario): cierra el tiempo de
// la etapa actual, abre el de la nueva, actualiza el estado y sincroniza la cita.
// Se usa al aprobar/rechazar el presupuesto, para que la orden no quede "esperando
// aprobación" después de que el cliente ya decidió. No-op si el estado no cambia.
async function avanzarEstadoOrden(ordenId, nuevoEstado) {
  const [[o]] = await pool.query('SELECT estado FROM ordenes_trabajo WHERE id = ?', [ordenId]);
  if (!o || o.estado === nuevoEstado) return;
  if (ETAPAS_TIEMPO.includes(o.estado)) {
    await pool.query('UPDATE orden_tiempos SET fin = NOW() WHERE orden_id = ? AND etapa = ? AND fin IS NULL', [ordenId, o.estado]);
  }
  await pool.query('UPDATE ordenes_trabajo SET estado = ? WHERE id = ?', [nuevoEstado, ordenId]);
  if (ETAPAS_TIEMPO.includes(nuevoEstado)) {
    await pool.query('INSERT INTO orden_tiempos (orden_id, etapa) VALUES (?, ?)', [ordenId, nuevoEstado]);
  }
  await sincronizarCitaDesdeOrden(ordenId, nuevoEstado);
}

// Estado al que pasa una orden recién aprobada: si tiene repuestos por conseguir
// (no "disponible") va a esperando_repuestos; si no, directo a en_reparacion.
async function estadoTrasAprobacion(ordenId) {
  const [[{ pendientes }]] = await pool.query(
    "SELECT COUNT(*) AS pendientes FROM orden_repuestos WHERE orden_id = ? AND estado <> 'disponible'",
    [ordenId]
  );
  return pendientes > 0 ? 'esperando_repuestos' : 'en_reparacion';
}

module.exports = { generarNumeroOrden, MAP_ORDEN_A_CITA, sincronizarCitaDesdeOrden, cerrarOrden, avanzarEstadoOrden, estadoTrasAprobacion };
