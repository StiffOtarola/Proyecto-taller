const router = require('express').Router();
const { pool } = require('../db/pool');
const { fail } = require('../utils/responder');
const auth = require('../middleware/auth');
const requireRol = require('../middleware/roles');
const { notificarCambioEstado } = require('../utils/notificaciones');
const { TRANSICIONES_CITA, transicionPermitida } = require('../utils/transiciones');

// Panel del mecánico: opera sobre SUS citas asignadas. Accesible a técnico o superior.
router.use(auth, requireRol('tecnico'));

const ESTADOS = ['agendado', 'en_revision', 'en_mantenimiento', 'listo', 'entregado', 'cancelado'];
const EN_PROCESO = ['en_revision', 'en_mantenimiento'];

// Campos que devuelve cada cita del mecánico (con datos de moto y cliente).
const SELECT_CITA = `
  SELECT ci.id, DATE_FORMAT(ci.fecha, '%Y-%m-%d') AS fecha, TIME_FORMAT(ci.hora, '%H:%i') AS hora,
         ci.motivo, ci.tipo_servicio, ci.estado,
         ci.monto, ci.calificacion, ci.comentario_satisfaccion, ci.fecha_inicio, ci.fecha_fin,
         ci.confirmada_cliente,
         ci.orden_id, o.numero_orden, o.estado AS orden_estado,
         o.aprobacion_cliente, o.motivo_rechazo,
         (o.costo_mano_obra + o.costo_repuestos - o.descuento) AS orden_total,
         m.marca, m.modelo, m.placa,
         c.nombre AS cliente_nombre, c.apellido AS cliente_apellido, c.telefono AS cliente_telefono
  FROM citas ci
  LEFT JOIN motos m    ON m.id = ci.moto_id
  JOIN clientes c      ON c.id = ci.cliente_id
  LEFT JOIN ordenes_trabajo o ON o.id = ci.orden_id`;

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
    const [[{ generado_hoy }]] = await pool.query(
      "SELECT COALESCE(SUM(monto), 0) AS generado_hoy FROM citas WHERE tecnico_id = ? AND estado = 'entregado' AND DATE(fecha_fin) = CURDATE()",
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
        generado_hoy,
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

    // Solo transiciones válidas del flujo de la cita.
    if (!transicionPermitida(TRANSICIONES_CITA, cita.estado, estado)) {
      return res.status(400).json({ error: `Transición no permitida: ${cita.estado} → ${estado}` });
    }

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
    await notificarCambioEstado(req.params.id, estado);
    res.json({ message: 'Estado actualizado' });
  } catch (err) {
    fail(res, err);
  }
});

// ───────────────────────────────────────────────────────────
// Tareas pendientes del mecánico (checklist propio)
// ───────────────────────────────────────────────────────────
router.get('/tareas', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT t.*, a.nombre AS asignado_por_nombre
       FROM tareas_mecanico t
       LEFT JOIN usuarios a ON a.id = t.asignado_por
       WHERE t.tecnico_id = ?
       ORDER BY t.hecha ASC, FIELD(t.prioridad, 'urgente', 'alta', 'normal', 'baja'),
                (t.vence IS NULL), t.vence ASC, t.created_at DESC`,
      [req.usuario.id]
    );
    res.json({ data: rows });
  } catch (err) {
    fail(res, err);
  }
});

router.post('/tareas', async (req, res) => {
  try {
    const { titulo, detalle, prioridad } = req.body;
    if (!titulo || !titulo.trim()) return res.status(400).json({ error: 'El título es requerido' });
    const prio = ['baja', 'normal', 'alta', 'urgente'].includes(prioridad) ? prioridad : 'normal';
    const [r] = await pool.query(
      'INSERT INTO tareas_mecanico (tecnico_id, titulo, detalle, prioridad) VALUES (?, ?, ?, ?)',
      [req.usuario.id, titulo.trim(), (detalle || '').trim() || null, prio]
    );
    const [[nueva]] = await pool.query('SELECT * FROM tareas_mecanico WHERE id = ?', [r.insertId]);
    res.status(201).json({ data: nueva, message: 'Tarea creada' });
  } catch (err) {
    fail(res, err);
  }
});

// Alterna (o fija) el estado "hecha" de una tarea propia.
router.patch('/tareas/:id', async (req, res) => {
  try {
    const [[t]] = await pool.query('SELECT id, hecha FROM tareas_mecanico WHERE id = ? AND tecnico_id = ?', [req.params.id, req.usuario.id]);
    if (!t) return res.status(404).json({ error: 'Tarea no encontrada' });
    const hecha = req.body.hecha !== undefined ? (req.body.hecha ? 1 : 0) : (t.hecha ? 0 : 1);
    await pool.query('UPDATE tareas_mecanico SET hecha = ? WHERE id = ?', [hecha, req.params.id]);
    res.json({ data: { id: Number(req.params.id), hecha }, message: 'Tarea actualizada' });
  } catch (err) {
    fail(res, err);
  }
});

router.delete('/tareas/:id', async (req, res) => {
  try {
    // El técnico solo borra sus propias tareas; las asignadas por el admin las completa, no las borra.
    await pool.query(
      'DELETE FROM tareas_mecanico WHERE id = ? AND tecnico_id = ? AND asignado_por IS NULL',
      [req.params.id, req.usuario.id]
    );
    res.json({ message: 'Tarea eliminada' });
  } catch (err) {
    fail(res, err);
  }
});

// ───────────────────────────────────────────────────────────
// Mensajería con recepción
// ───────────────────────────────────────────────────────────
const SELECT_MENSAJE = `
  SELECT m.id, m.mensaje, m.foto, m.orden_id, m.tipo, m.leido, m.created_at,
         m.remitente_id, m.destino_rol, m.destino_id,
         u.nombre AS remitente_nombre, u.rol AS remitente_rol,
         o.numero_orden
  FROM mensajes_internos m
  JOIN usuarios u ON u.id = m.remitente_id
  LEFT JOIN ordenes_trabajo o ON o.id = m.orden_id`;

router.get('/mensajes', async (req, res) => {
  try {
    const yo = req.usuario.id;
    const [rows] = await pool.query(
      `${SELECT_MENSAJE}
       WHERE m.remitente_id = ? OR m.destino_id = ? OR m.tipo = 'broadcast'
       ORDER BY m.created_at ASC LIMIT 100`,
      [yo, yo]
    );
    await pool.query(
      "UPDATE mensajes_internos SET leido = 1 WHERE (destino_id = ? OR (tipo = 'broadcast' AND destino_rol = 'tecnico')) AND leido = 0",
      [yo]
    );
    res.json({ data: rows });
  } catch (err) {
    fail(res, err);
  }
});

router.get('/mensajes/no-leidos', async (req, res) => {
  try {
    const yo = req.usuario.id;
    const [[{ count }]] = await pool.query(
      "SELECT COUNT(*) AS count FROM mensajes_internos WHERE ((destino_id = ?) OR (tipo = 'broadcast' AND destino_rol = 'tecnico')) AND leido = 0",
      [yo]
    );
    res.json({ data: { count } });
  } catch (err) {
    fail(res, err);
  }
});

router.post('/mensajes', async (req, res) => {
  try {
    const { mensaje, foto, orden_id } = req.body;
    if ((!mensaje || !mensaje.trim()) && !foto) return res.status(400).json({ error: 'El mensaje o una foto es requerido' });
    const [r] = await pool.query(
      "INSERT INTO mensajes_internos (remitente_id, destino_rol, mensaje, foto, orden_id) VALUES (?, 'recepcion', ?, ?, ?)",
      [req.usuario.id, (mensaje || '').trim(), foto || null, orden_id || null]
    );
    const [[nuevo]] = await pool.query(`${SELECT_MENSAJE} WHERE m.id = ?`, [r.insertId]);
    res.status(201).json({ data: nuevo, message: 'Mensaje enviado' });
  } catch (err) {
    fail(res, err);
  }
});

// Contacto directo (llamar/WhatsApp) con recepción: primer recepcionista con teléfono.
router.get('/recepcion-contacto', async (req, res) => {
  try {
    const [[r]] = await pool.query(
      "SELECT nombre, telefono FROM usuarios WHERE rol = 'recepcion' AND activo = 1 AND telefono IS NOT NULL AND telefono <> '' ORDER BY id LIMIT 1"
    );
    res.json({ data: r || null });
  } catch (err) {
    fail(res, err);
  }
});

// ───────────────────────────────────────────────────────────
// Perfil del mecánico (datos + estadísticas + calificaciones)
// ───────────────────────────────────────────────────────────
router.get('/perfil', async (req, res) => {
  try {
    const yo = req.usuario.id;
    const [[u]] = await pool.query('SELECT id, nombre, email, rol, telefono, especialidades, horario FROM usuarios WHERE id = ?', [yo]);
    const [[g]] = await pool.query(
      `SELECT COUNT(*) AS completadas, COALESCE(SUM(monto), 0) AS ingresos_generados,
              ROUND(AVG(TIMESTAMPDIFF(MINUTE, fecha_inicio, fecha_fin))) AS tiempo_promedio_min
       FROM citas WHERE tecnico_id = ? AND estado = 'entregado'`,
      [yo]
    );
    const [[calif]] = await pool.query(
      'SELECT ROUND(AVG(calificacion), 1) AS promedio, COUNT(calificacion) AS total FROM citas WHERE tecnico_id = ? AND calificacion IS NOT NULL',
      [yo]
    );
    const [[sat]] = await pool.query(
      'SELECT COUNT(*) AS total, COALESCE(SUM(calificacion >= 4), 0) AS buenas FROM citas WHERE tecnico_id = ? AND calificacion IS NOT NULL',
      [yo]
    );
    const satisfechos_pct = sat.total ? Math.round((sat.buenas / sat.total) * 100) : null;
    const [[mes]] = await pool.query(
      `SELECT COUNT(*) AS citas_mes, COALESCE(SUM(monto), 0) AS ingresos_mes
       FROM citas WHERE tecnico_id = ? AND estado = 'entregado'
         AND MONTH(fecha_fin) = MONTH(CURDATE()) AND YEAR(fecha_fin) = YEAR(CURDATE())`,
      [yo]
    );
    const [calificaciones] = await pool.query(
      `SELECT ci.calificacion, ci.comentario_satisfaccion, ci.tipo_servicio, ci.fecha_fin,
              c.nombre AS cliente_nombre, c.apellido AS cliente_apellido
       FROM citas ci JOIN clientes c ON c.id = ci.cliente_id
       WHERE ci.tecnico_id = ? AND ci.calificacion IS NOT NULL
       ORDER BY ci.fecha_fin DESC LIMIT 8`,
      [yo]
    );
    res.json({
      data: {
        ...u,
        especialidades_list: u.especialidades ? u.especialidades.split(',').map(s => s.trim()).filter(Boolean) : [],
        completadas: g.completadas,
        ingresos_generados: g.ingresos_generados,
        tiempo_promedio_min: g.tiempo_promedio_min || 0,
        calificacion_promedio: calif.promedio,
        calificacion_total: calif.total,
        satisfechos_pct,
        citas_mes: mes.citas_mes,
        ingresos_mes: mes.ingresos_mes,
        calificaciones,
      },
    });
  } catch (err) {
    fail(res, err);
  }
});

// El mecánico edita su propio perfil (teléfono, especialidades, horario).
router.patch('/perfil', async (req, res) => {
  try {
    const { telefono, especialidades, horario } = req.body;
    await pool.query(
      'UPDATE usuarios SET telefono = ?, especialidades = ?, horario = ? WHERE id = ?',
      [telefono || null, especialidades || null, horario || null, req.usuario.id]
    );
    res.json({ message: 'Perfil actualizado' });
  } catch (err) {
    fail(res, err);
  }
});

module.exports = router;
