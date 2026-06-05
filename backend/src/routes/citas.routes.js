const router = require('express').Router();
const { pool } = require('../db/pool');
const { fail } = require('../utils/responder');
const auth = require('../middleware/auth');

router.use(auth);

router.get('/', async (req, res) => {
  try {
    const { fecha, estado } = req.query;
    let sql = `SELECT ci.*, c.nombre AS cliente_nombre, c.apellido AS cliente_apellido, c.telefono AS cliente_telefono,
                      m.marca, m.modelo, m.placa,
                      u.nombre AS usuario_nombre
               FROM citas ci
               JOIN clientes c ON ci.cliente_id = c.id
               LEFT JOIN motos m ON ci.moto_id = m.id
               LEFT JOIN usuarios u ON ci.usuario_id = u.id
               WHERE 1=1`;
    const params = [];
    if (fecha) { sql += ' AND ci.fecha = ?'; params.push(fecha); }
    if (estado) { sql += ' AND ci.estado = ?'; params.push(estado); }
    sql += ' ORDER BY ci.fecha ASC, ci.hora ASC';
    const [rows] = await pool.query(sql, params);
    res.json({ data: rows });
  } catch (err) {
    fail(res, err);
  }
});

router.post('/', async (req, res) => {
  try {
    const { cliente_id, moto_id, fecha, hora, motivo } = req.body;
    if (!cliente_id || !fecha || !hora || !motivo) {
      return res.status(400).json({ error: 'cliente_id, fecha, hora y motivo son requeridos' });
    }
    const [result] = await pool.query(
      'INSERT INTO citas (cliente_id, moto_id, usuario_id, fecha, hora, motivo) VALUES (?, ?, ?, ?, ?, ?)',
      [cliente_id, moto_id || null, req.usuario.id, fecha, hora, motivo]
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
    const { cliente_id, moto_id, fecha, hora, motivo } = req.body;
    await pool.query(
      'UPDATE citas SET cliente_id=?, moto_id=?, fecha=?, hora=?, motivo=? WHERE id=?',
      [cliente_id, moto_id || null, fecha, hora, motivo, req.params.id]
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
    const validos = ['pendiente', 'confirmada', 'cancelada', 'completada'];
    if (!validos.includes(estado)) return res.status(400).json({ error: 'Estado inválido' });
    await pool.query('UPDATE citas SET estado = ? WHERE id = ?', [estado, req.params.id]);
    res.json({ message: 'Estado de cita actualizado' });
  } catch (err) {
    fail(res, err);
  }
});

module.exports = router;
