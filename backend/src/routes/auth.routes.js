const router = require('express').Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { pool } = require('../db/pool');
const auth = require('../middleware/auth');
const { emailValido } = require('../utils/validar');

function firmar(payload) {
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '8h' });
}

// Login unificado: el mismo formulario sirve para personal y para clientes.
// Busca primero en usuarios (personal) y, si no, en clientes con acceso al portal.
// La respuesta incluye `tipo` ('staff' | 'cliente') para que el front sepa a dónde mandar.
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email y contraseña requeridos' });
    }
    if (!emailValido(email)) {
      return res.status(400).json({ error: 'El correo no tiene un formato válido' });
    }

    // 1) Personal del taller (usuarios)
    const [[usuario]] = await pool.query(
      'SELECT * FROM usuarios WHERE email = ? AND activo = 1',
      [email]
    );
    if (usuario && (await bcrypt.compare(password, usuario.password_hash))) {
      const payload = { id: usuario.id, nombre: usuario.nombre, email: usuario.email, rol: usuario.rol };
      return res.json({ data: { token: firmar(payload), tipo: 'staff', usuario: payload } });
    }

    // 2) Cliente del portal (clientes con contraseña definida)
    const [[cliente]] = await pool.query(
      'SELECT * FROM clientes WHERE email = ? AND activo = 1 AND password_hash IS NOT NULL',
      [email]
    );
    if (cliente && (await bcrypt.compare(password, cliente.password_hash))) {
      const payload = { id: cliente.id, tipo: 'cliente', nombre: cliente.nombre, apellido: cliente.apellido };
      return res.json({ data: { token: firmar(payload), tipo: 'cliente', cliente: payload } });
    }

    return res.status(401).json({ error: 'Credenciales incorrectas' });
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
