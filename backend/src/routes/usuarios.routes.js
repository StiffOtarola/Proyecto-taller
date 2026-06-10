const router = require('express').Router();
const bcrypt = require('bcrypt');
const { pool } = require('../db/pool');
const { fail } = require('../utils/responder');
const auth = require('../middleware/auth');
const requireRol = require('../middleware/roles');
const { emailValido } = require('../utils/validar');

router.use(auth, requireRol('admin'));

// Roles válidos del personal (debe coincidir con el ENUM de la tabla usuarios).
const ROLES = ['recepcion', 'tecnico', 'admin'];

router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT id, nombre, email, telefono, rol, activo, created_at FROM usuarios ORDER BY nombre'
    );
    res.json({ data: rows });
  } catch (err) {
    fail(res, err);
  }
});

router.post('/', async (req, res) => {
  try {
    const { nombre, email, password, rol, telefono } = req.body;
    if (!nombre || !email || !password || !rol) {
      return res.status(400).json({ error: 'nombre, email, contraseña y rol son requeridos' });
    }
    if (!emailValido(email)) return res.status(400).json({ error: 'El correo no tiene un formato válido' });
    if (!ROLES.includes(rol)) return res.status(400).json({ error: 'Rol no válido' });
    const hash = await bcrypt.hash(password, 10);
    const [result] = await pool.query(
      'INSERT INTO usuarios (nombre, email, password_hash, rol, telefono) VALUES (?, ?, ?, ?, ?)',
      [nombre, email, hash, rol, telefono || null]
    );
    const [[nuevo]] = await pool.query(
      'SELECT id, nombre, email, telefono, rol, activo, created_at FROM usuarios WHERE id = ?',
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
    const { nombre, email, rol, telefono } = req.body;
    if (!nombre || !nombre.trim() || !email || !rol) {
      return res.status(400).json({ error: 'nombre, email y rol son requeridos' });
    }
    if (!emailValido(email)) return res.status(400).json({ error: 'El correo no tiene un formato válido' });
    if (!ROLES.includes(rol)) return res.status(400).json({ error: 'Rol no válido' });
    // Anti-lockout: el admin logueado no puede quitarse a sí mismo el rol admin.
    if (Number(req.params.id) === req.usuario.id && rol !== 'admin') {
      return res.status(400).json({ error: 'No podés cambiar tu propio rol de administrador' });
    }
    await pool.query(
      'UPDATE usuarios SET nombre=?, email=?, rol=?, telefono=? WHERE id=?',
      [nombre, email, rol, telefono ?? null, req.params.id]
    );
    const [[actualizado]] = await pool.query(
      'SELECT id, nombre, email, telefono, rol, activo, created_at FROM usuarios WHERE id = ?',
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
    // Anti-lockout: el admin logueado no puede desactivarse a sí mismo.
    if (Number(req.params.id) === req.usuario.id && !activo) {
      return res.status(400).json({ error: 'No podés desactivar tu propia cuenta' });
    }
    await pool.query('UPDATE usuarios SET activo = ? WHERE id = ?', [activo ? 1 : 0, req.params.id]);
    res.json({ message: activo ? 'Usuario activado' : 'Usuario desactivado' });
  } catch (err) {
    fail(res, err);
  }
});

module.exports = router;
