const router = require('express').Router();
const bcrypt = require('bcrypt');
const { pool } = require('../db/pool');
const { fail } = require('../utils/responder');
const auth = require('../middleware/auth');
const requireRol = require('../middleware/roles');

router.use(auth);

// Columnas seguras (nunca exponer password_hash); tiene_portal indica si el acceso está activo.
const COLS = `id, nombre, apellido, telefono, email, cedula, direccion, activo, created_at, updated_at,
              visitas, cortesia_disponible,
              (password_hash IS NOT NULL) AS tiene_portal`;

router.get('/', async (req, res) => {
  try {
    const { q } = req.query;
    let sql = `SELECT ${COLS} FROM clientes WHERE activo = 1`;
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
    fail(res, err);
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
    fail(res, err);
  }
});

router.get('/:id', async (req, res) => {
  try {
    const [[cliente]] = await pool.query(`SELECT ${COLS} FROM clientes WHERE id = ? AND activo = 1`, [req.params.id]);
    if (!cliente) return res.status(404).json({ error: 'Cliente no encontrado' });
    res.json({ data: cliente });
  } catch (err) {
    fail(res, err);
  }
});

// PATCH /api/clientes/:id/cortesia — canjea (consume) la cortesía de fidelización
router.patch('/:id/cortesia', async (req, res) => {
  try {
    const [[cliente]] = await pool.query('SELECT cortesia_disponible FROM clientes WHERE id = ? AND activo = 1', [req.params.id]);
    if (!cliente) return res.status(404).json({ error: 'Cliente no encontrado' });
    if (!cliente.cortesia_disponible) return res.status(400).json({ error: 'El cliente no tiene cortesía disponible' });
    await pool.query('UPDATE clientes SET cortesia_disponible = 0 WHERE id = ?', [req.params.id]);
    res.json({ message: 'Cortesía canjeada' });
  } catch (err) {
    fail(res, err);
  }
});

// PATCH /api/clientes/:id/portal — activa/define o desactiva el acceso al portal del cliente.
// Sensible (fija contraseñas de acceso): restringido a administración.
router.patch('/:id/portal', requireRol('admin'), async (req, res) => {
  try {
    const { password, activar } = req.body;
    const [[cliente]] = await pool.query('SELECT id, email FROM clientes WHERE id = ? AND activo = 1', [req.params.id]);
    if (!cliente) return res.status(404).json({ error: 'Cliente no encontrado' });

    if (activar === false) {
      await pool.query('UPDATE clientes SET password_hash = NULL WHERE id = ?', [req.params.id]);
      return res.json({ message: 'Acceso al portal desactivado' });
    }
    if (!cliente.email) return res.status(400).json({ error: 'El cliente necesita un email para acceder al portal' });
    if (!password || password.length < 6) {
      return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });
    }
    const hash = await bcrypt.hash(password, 10);
    await pool.query('UPDATE clientes SET password_hash = ? WHERE id = ?', [hash, req.params.id]);
    res.json({ message: 'Acceso al portal activado' });
  } catch (err) {
    fail(res, err);
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
    fail(res, err);
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
    fail(res, err);
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
    fail(res, err);
  }
});

module.exports = router;
