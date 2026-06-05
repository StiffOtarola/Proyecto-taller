const router = require('express').Router();
const { pool } = require('../db/pool');
const { fail } = require('../utils/responder');
const auth = require('../middleware/auth');
const requireRol = require('../middleware/roles');
const { notificarCambioEstado } = require('../utils/notificaciones');

const ESTADOS = ['agendado', 'en_revision', 'en_mantenimiento', 'listo', 'entregado', 'cancelado'];

router.use(auth);

router.get('/', async (req, res) => {
  try {
    const { fecha, estado, tecnico_id } = req.query;
    let sql = `SELECT ci.*, c.nombre AS cliente_nombre, c.apellido AS cliente_apellido, c.telefono AS cliente_telefono,
                      m.marca, m.modelo, m.placa,
                      u.nombre AS usuario_nombre,
                      t.nombre AS tecnico_nombre
               FROM citas ci
               JOIN clientes c ON ci.cliente_id = c.id
               LEFT JOIN motos m ON ci.moto_id = m.id
               LEFT JOIN usuarios u ON ci.usuario_id = u.id
               LEFT JOIN usuarios t ON ci.tecnico_id = t.id
               WHERE 1=1`;
    const params = [];
    if (fecha) { sql += ' AND ci.fecha = ?'; params.push(fecha); }
    if (estado) { sql += ' AND ci.estado = ?'; params.push(estado); }
    if (tecnico_id) { sql += ' AND ci.tecnico_id = ?'; params.push(tecnico_id); }
    sql += ' ORDER BY ci.fecha ASC, ci.hora ASC';
    const [rows] = await pool.query(sql, params);
    res.json({ data: rows });
  } catch (err) {
    fail(res, err);
  }
});

router.post('/', async (req, res) => {
  try {
    const { cliente_id, moto_id, fecha, hora, motivo, tipo_servicio, tecnico_id } = req.body;
    if (!cliente_id || !fecha || !hora || !motivo) {
      return res.status(400).json({ error: 'cliente_id, fecha, hora y motivo son requeridos' });
    }
    const [result] = await pool.query(
      'INSERT INTO citas (cliente_id, moto_id, usuario_id, tecnico_id, fecha, hora, motivo, tipo_servicio) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [cliente_id, moto_id || null, req.usuario.id, tecnico_id || null, fecha, hora, motivo, tipo_servicio || null]
    );
    const [[nueva]] = await pool.query('SELECT * FROM citas WHERE id = ?', [result.insertId]);
    res.status(201).json({ data: nueva, message: 'Cita creada' });
  } catch (err) {
    fail(res, err);
  }
});

router.get('/:id', async (req, res) => {
  try {
    const [[cita]] = await pool.query(
      `SELECT ci.*, c.nombre AS cliente_nombre, c.apellido AS cliente_apellido, c.telefono AS cliente_telefono,
              m.marca, m.modelo, m.placa
       FROM citas ci
       JOIN clientes c ON ci.cliente_id = c.id
       LEFT JOIN motos m ON ci.moto_id = m.id
       WHERE ci.id = ?`,
      [req.params.id]
    );
    if (!cita) return res.status(404).json({ error: 'Cita no encontrada' });
    res.json({ data: cita });
  } catch (err) {
    fail(res, err);
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { cliente_id, moto_id, fecha, hora, motivo, tipo_servicio, tecnico_id } = req.body;
    await pool.query(
      'UPDATE citas SET cliente_id=?, moto_id=?, tecnico_id=?, fecha=?, hora=?, motivo=?, tipo_servicio=? WHERE id=?',
      [cliente_id, moto_id || null, tecnico_id || null, fecha, hora, motivo, tipo_servicio || null, req.params.id]
    );
    const [[actualizada]] = await pool.query('SELECT * FROM citas WHERE id = ?', [req.params.id]);
    res.json({ data: actualizada, message: 'Cita actualizada' });
  } catch (err) {
    fail(res, err);
  }
});

router.patch('/:id/estado', async (req, res) => {
  try {
    const { estado } = req.body;
    if (!ESTADOS.includes(estado)) return res.status(400).json({ error: 'Estado inválido' });

    const [[cita]] = await pool.query('SELECT id, tecnico_id FROM citas WHERE id = ?', [req.params.id]);
    if (!cita) return res.status(404).json({ error: 'Cita no encontrada' });

    // Un técnico solo puede mover SUS citas; jefe_taller+ (y recepción) pueden cualquiera.
    if (req.usuario.rol === 'tecnico' && cita.tecnico_id !== req.usuario.id) {
      return res.status(403).json({ error: 'Solo podés cambiar el estado de tus citas asignadas' });
    }

    await pool.query('UPDATE citas SET estado = ? WHERE id = ?', [estado, req.params.id]);
    await notificarCambioEstado(req.params.id, estado);
    res.json({ message: 'Estado de cita actualizado' });
  } catch (err) {
    fail(res, err);
  }
});

// PATCH /api/citas/:id/asignar — el jefe de taller asigna la cita a un técnico
router.patch('/:id/asignar', requireRol('jefe_taller'), async (req, res) => {
  try {
    const { tecnico_id } = req.body;
    await pool.query('UPDATE citas SET tecnico_id = ? WHERE id = ?', [tecnico_id || null, req.params.id]);
    res.json({ message: tecnico_id ? 'Técnico asignado' : 'Asignación quitada' });
  } catch (err) {
    fail(res, err);
  }
});

module.exports = router;
