const router = require('express').Router();
const { pool } = require('../db/pool');
const { fail } = require('../utils/responder');
const auth = require('../middleware/auth');
const requireRol = require('../middleware/roles');

// Panel del mecánico: opera sobre SUS citas asignadas. Accesible a técnico o superior.
router.use(auth, requireRol('tecnico'));

const ESTADOS = ['agendado', 'en_revision', 'en_mantenimiento', 'listo', 'entregado', 'cancelado'];
const EN_PROCESO = ['en_revision', 'en_mantenimiento'];

// Campos que devuelve cada cita del mecánico (con datos de moto y cliente).
const SELECT_CITA = `
  SELECT ci.id, ci.fecha, ci.hora, ci.motivo, ci.tipo_servicio, ci.estado,
         ci.monto, ci.calificacion, ci.comentario_satisfaccion, ci.fecha_inicio, ci.fecha_fin,
         m.marca, m.modelo, m.placa,
         c.nombre AS cliente_nombre, c.apellido AS cliente_apellido, c.telefono AS cliente_telefono
  FROM citas ci
  LEFT JOIN motos m    ON m.id = ci.moto_id
  JOIN clientes c      ON c.id = ci.cliente_id`;

// GET /api/mecanico/resumen — KPIs del técnico logueado
router.get('/resumen', async (req, res) => {
  try {
    const yo = req.usuario.id;
    const [[{ citas_hoy }]] = await pool.query(
      'SELECT COUNT(*) AS citas_hoy FROM citas WHERE tecnico_id = ? AND fecha = CURDATE()',
      [yo]
    );
    const [[{ completadas_hoy }]] = await pool.query(
      "SELECT COUNT(*) AS completadas_hoy FROM citas WHERE tecnico_id = ? AND estado = 'entregado' AND DATE(fecha_fin) = CURDATE()",
      [yo]
    );
    const [[{ en_proceso }]] = await pool.query(
      "SELECT COUNT(*) AS en_proceso FROM citas WHERE tecnico_id = ? AND estado IN ('en_revision','en_mantenimiento')",
      [yo]
    );
    const [[{ monto_promedio }]] = await pool.query(
      "SELECT COALESCE(AVG(monto), 0) AS monto_promedio FROM citas WHERE tecnico_id = ? AND estado = 'entregado' AND monto > 0",
      [yo]
    );
    const [[{ tiempo_promedio_min }]] = await pool.query(
      `SELECT ROUND(AVG(TIMESTAMPDIFF(MINUTE, fecha_inicio, fecha_fin))) AS tiempo_promedio_min
       FROM citas WHERE tecnico_id = ? AND estado = 'entregado' AND fecha_inicio IS NOT NULL AND fecha_fin IS NOT NULL`,
      [yo]
    );
    const [[calif]] = await pool.query(
      'SELECT ROUND(AVG(calificacion), 1) AS promedio, COUNT(calificacion) AS total FROM citas WHERE tecnico_id = ? AND calificacion IS NOT NULL',
      [yo]
    );
    res.json({
      data: {
        citas_hoy,
        completadas_hoy,
        en_proceso,
        monto_promedio,
        tiempo_promedio_min: tiempo_promedio_min || 0,
        calificacion_promedio: calif.promedio,
        calificacion_total: calif.total,
      },
    });
  } catch (err) {
    fail(res, err);
  }
});

// GET /api/mecanico/citas?fecha=&estado= — citas asignadas a mí
router.get('/citas', async (req, res) => {
  try {
    const { fecha, estado } = req.query;
    let sql = `${SELECT_CITA} WHERE ci.tecnico_id = ?`;
    const params = [req.usuario.id];
    if (fecha) { sql += ' AND ci.fecha = ?'; params.push(fecha); }
    if (estado) { sql += ' AND ci.estado = ?'; params.push(estado); }
    sql += ' ORDER BY ci.fecha ASC, ci.hora ASC';
    const [rows] = await pool.query(sql, params);
    res.json({ data: rows });
  } catch (err) {
    fail(res, err);
  }
});

// GET /api/mecanico/agenda?desde=&hasta= — mis citas en un rango (agenda de la semana)
router.get('/agenda', async (req, res) => {
  try {
    const { desde, hasta } = req.query;
    if (!desde || !hasta) return res.status(400).json({ error: 'desde y hasta son requeridos' });
    const [rows] = await pool.query(
      `${SELECT_CITA} WHERE ci.tecnico_id = ? AND ci.fecha BETWEEN ? AND ?
       ORDER BY ci.fecha ASC, ci.hora ASC`,
      [req.usuario.id, desde, hasta]
    );
    res.json({ data: rows });
  } catch (err) {
    fail(res, err);
  }
});

// PATCH /api/mecanico/citas/:id/estado — cambia estado de MI cita (+ monto opcional)
router.patch('/citas/:id/estado', async (req, res) => {
  try {
    const { estado, monto } = req.body;
    if (!ESTADOS.includes(estado)) return res.status(400).json({ error: 'Estado inválido' });

    const [[cita]] = await pool.query(
      'SELECT id, estado FROM citas WHERE id = ? AND tecnico_id = ?',
      [req.params.id, req.usuario.id]
    );
    if (!cita) return res.status(404).json({ error: 'Cita no encontrada o no asignada a vos' });

    // Marca inicio al arrancar el trabajo y fin al entregar.
    const arrancaTrabajo = cita.estado === 'agendado' && estado !== 'agendado' && estado !== 'cancelado';
    const sets = ['estado = ?'];
    const params = [estado];
    if (arrancaTrabajo) sets.push('fecha_inicio = COALESCE(fecha_inicio, NOW())');
    if (estado === 'entregado') sets.push('fecha_fin = NOW()');
    if (monto !== undefined && monto !== null && monto !== '') {
      sets.push('monto = ?');
      params.push(Number(monto) || 0);
    }
    params.push(req.params.id);

    await pool.query(`UPDATE citas SET ${sets.join(', ')} WHERE id = ?`, params);
    res.json({ message: 'Estado actualizado' });
  } catch (err) {
    fail(res, err);
  }
});

module.exports = router;
