const router = require('express').Router();
const bcrypt = require('bcrypt');
const { pool } = require('../db/pool');
const { fail } = require('../utils/responder');
const auth = require('../middleware/auth');
const requireRol = require('../middleware/roles');

router.use(auth, requireRol('admin'));

router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT id, nombre, email, rol, activo, created_at FROM usuarios ORDER BY nombre'
    );
    res.json({ data: rows });
  } catch (err) {
    fail(res, err);
  }
});

router.post('/', async (req, res) => {
  try {
    const { nombre, email, password, rol } = req.body;
    if (!nombre || !email || !password || !rol) {
      return res.status(400).json({ error: 'nombre, email, contraseña y rol son requeridos' });
    }
    const hash = await bcrypt.hash(password, 10);
    const [result] = await pool.query(
      'INSERT INTO usuarios (nombre, email, password_hash, rol) VALUES (?, ?, ?, ?)',
      [nombre, email, hash, rol]
    );
    const [[nuevo]] = await pool.query(
      'SELECT id, nombre, email, rol, activo, created_at FROM usuarios WHERE id = ?',
      [result.insertId]
    );
    res.status(201).json({ data: nuevo, message: 'Usuario creado' });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'El email ya está registrado' });
    fail(res, err);
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { nombre, email, rol } = req.body;
    await pool.query('UPDATE usuarios SET nombre=?, email=?, rol=? WHERE id=?', [nombre, email, rol, req.params.id]);
    const [[actualizado]] = await pool.query(
      'SELECT id, nombre, email, rol, activo, created_at FROM usuarios WHERE id = ?',
      [req.params.id]
    );
    res.json({ data: actualizado, message: 'Usuario actualizado' });
  } catch (err) {
    fail(res, err);
  }
});

router.patch('/:id/activo', async (req, res) => {
  try {
    const { activo } = req.body;
    await pool.query('UPDATE usuarios SET activo = ? WHERE id = ?', [activo ? 1 : 0, req.params.id]);
    res.json({ message: activo ? 'Usuario activado' : 'Usuario desactivado' });
  } catch (err) {
    fail(res, err);
  }
});

module.exports = router;
