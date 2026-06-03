const router = require('express').Router();
const { pool } = require('../db/pool');
const auth = require('../middleware/auth');

router.use(auth);

router.get('/', async (req, res) => {
  try {
    const { q } = req.query;
    let sql = 'SELECT * FROM clientes WHERE activo = 1';
    const params = [];
    if (q) {
      sql += ' AND (nombre LIKE ? OR apellido LIKE ? OR telefono LIKE ? OR cedula LIKE ?)';
      const like = `%${q}%`;
      params.push(like, like, like, like);
    }
    sql += ' ORDER BY nombre, apellido';
    const [rows] = await pool.query(sql, params);
    res.json({ data: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { nombre, apellido, telefono, email, cedula, direccion } = req.body;
    if (!nombre || !apellido || !telefono) {
      return res.status(400).json({ error: 'Nombre, apellido y teléfono son requeridos' });
    }
    const [result] = await pool.query(
      'INSERT INTO clientes (nombre, apellido, telefono, email, cedula, direccion) VALUES (?, ?, ?, ?, ?, ?)',
      [nombre, apellido, telefono, email || null, cedula || null, direccion || null]
    );
    const [[nuevo]] = await pool.query('SELECT * FROM clientes WHERE id = ?', [result.insertId]);
    res.status(201).json({ data: nuevo, message: 'Cliente creado' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const [[cliente]] = await pool.query('SELECT * FROM clientes WHERE id = ? AND activo = 1', [req.params.id]);
    if (!cliente) return res.status(404).json({ error: 'Cliente no encontrado' });
    res.json({ data: cliente });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { nombre, apellido, telefono, email, cedula, direccion } = req.body;
    await pool.query(
      'UPDATE clientes SET nombre=?, apellido=?, telefono=?, email=?, cedula=?, direccion=? WHERE id=?',
      [nombre, apellido, telefono, email || null, cedula || null, direccion || null, req.params.id]
    );
    const [[actualizado]] = await pool.query('SELECT * FROM clientes WHERE id = ?', [req.params.id]);
    res.json({ data: actualizado, message: 'Cliente actualizado' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id/motos', async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT * FROM motos WHERE cliente_id = ? AND activa = 1 ORDER BY created_at DESC',
      [req.params.id]
    );
    res.json({ data: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id/ordenes', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT ot.*, m.marca, m.modelo, m.placa,
              u.nombre AS tecnico_nombre
       FROM ordenes_trabajo ot
       JOIN motos m ON ot.moto_id = m.id
       LEFT JOIN usuarios u ON ot.tecnico_id = u.id
       WHERE ot.cliente_id = ?
       ORDER BY ot.fecha_ingreso DESC`,
      [req.params.id]
    );
    res.json({ data: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
