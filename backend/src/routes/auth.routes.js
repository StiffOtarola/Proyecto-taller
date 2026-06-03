const router = require('express').Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { pool } = require('../db/pool');
const auth = require('../middleware/auth');

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email y contraseña requeridos' });
    }
    const [[usuario]] = await pool.query(
      'SELECT * FROM usuarios WHERE email = ? AND activo = 1',
      [email]
    );
    if (!usuario) {
      return res.status(401).json({ error: 'Credenciales incorrectas' });
    }
    const ok = await bcrypt.compare(password, usuario.password_hash);
    if (!ok) {
      return res.status(401).json({ error: 'Credenciales incorrectas' });
    }
    const payload = { id: usuario.id, nombre: usuario.nombre, email: usuario.email, rol: usuario.rol };
    const token = jwt.sign(payload, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN || '8h',
    });
    res.json({ data: { token, usuario: payload } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/me', auth, async (req, res) => {
  try {
    const [[usuario]] = await pool.query(
      'SELECT id, nombre, email, rol, activo, created_at FROM usuarios WHERE id = ?',
      [req.usuario.id]
    );
    if (!usuario) return res.status(404).json({ error: 'Usuario no encontrado' });
    res.json({ data: usuario });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
