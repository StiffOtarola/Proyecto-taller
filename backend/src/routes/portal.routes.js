const router = require('express').Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const { pool } = require('../db/pool');
const { fail } = require('../utils/responder');
const authCliente = require('../middleware/auth-cliente');
const { emailValido } = require('../utils/validar');
const { consumir } = require('../utils/rate-limit');
const { enviarCodigoReset } = require('../services/mailer');

// Firma el JWT del cliente y arma el payload estándar.
function tokenCliente(cliente) {
  const payload = { id: cliente.id, tipo: 'cliente', nombre: cliente.nombre, apellido: cliente.apellido };
  const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '8h' });
  return { payload, token };
}

// POST /api/portal/login — login del cliente con email + contraseña
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email y contraseña requeridos' });
    if (!emailValido(email)) return res.status(400).json({ error: 'El correo no tiene un formato válido' });
    const [[cliente]] = await pool.query(
      'SELECT * FROM clientes WHERE email = ? AND activo = 1',
      [email]
    );
    if (!cliente || !cliente.password_hash) {
      return res.status(401).json({ error: 'Credenciales incorrectas o portal no habilitado' });
    }
    const ok = await bcrypt.compare(password, cliente.password_hash);
    if (!ok) return res.status(401).json({ error: 'Credenciales incorrectas' });

    const { payload, token } = tokenCliente(cliente);
    res.json({ data: { token, cliente: payload } });
  } catch (err) {
    fail(res, err);
  }
});

// POST /api/portal/registro — auto-registro del cliente (público)
router.post('/registro', async (req, res) => {
  try {
    const { nombre, apellido, telefono, email, cedula, password } = req.body;
    if (!nombre || !apellido || !telefono || !email || !password) {
      return res.status(400).json({ error: 'Nombre, apellido, teléfono, correo y contraseña son requeridos' });
    }
    if (!emailValido(email)) return res.status(400).json({ error: 'El correo no tiene un formato válido' });
    if (password.length < 6) return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });

    const [[existente]] = await pool.query('SELECT id, password_hash FROM clientes WHERE email = ? AND activo = 1', [email]);
    const hash = await bcrypt.hash(password, 10);
    let clienteId;

    if (existente) {
      if (existente.password_hash) {
        return res.status(409).json({ error: 'Ese correo ya tiene una cuenta. Iniciá sesión.' });
      }
      // El taller ya tenía registrado al cliente: "reclama" la cuenta definiendo su contraseña
      await pool.query(
        'UPDATE clientes SET password_hash = ?, cedula = COALESCE(cedula, ?) WHERE id = ?',
        [hash, cedula || null, existente.id]
      );
      clienteId = existente.id;
    } else {
      const [result] = await pool.query(
        'INSERT INTO clientes (nombre, apellido, telefono, email, cedula, password_hash) VALUES (?, ?, ?, ?, ?, ?)',
        [nombre, apellido, telefono, email, cedula || null, hash]
      );
      clienteId = result.insertId;
    }

    const [[cliente]] = await pool.query('SELECT id, nombre, apellido FROM clientes WHERE id = ?', [clienteId]);
    const { payload, token } = tokenCliente(cliente);
    res.status(201).json({ data: { token, cliente: payload } });
  } catch (err) {
    fail(res, err);
  }
});

// POST /api/portal/recuperar/solicitar — envía un código de 6 dígitos al correo (público)
// Respuesta genérica siempre (anti-enumeración de cuentas).
const MSG_GENERICO = 'Si la cuenta existe, te enviamos un código a tu correo.';
router.post('/recuperar/solicitar', async (req, res) => {
  try {
    const { email } = req.body;
    if (!emailValido(email)) return res.status(400).json({ error: 'El correo no tiene un formato válido' });

    const clave = String(email).trim().toLowerCase();
    const limite = consumir(`reset:${clave}`, { porMinuto: 1, porHora: 5 });
    if (!limite.ok) {
      return res.status(429).json({ error: `Esperá ${limite.retryAfter}s antes de pedir otro código.` });
    }

    const [[cliente]] = await pool.query(
      'SELECT id, nombre, apellido FROM clientes WHERE email = ? AND activo = 1 AND password_hash IS NOT NULL',
      [email]
    );

    if (cliente) {
      const codigo = String(Math.floor(100000 + Math.random() * 900000)); // 6 dígitos
      const codeHash = await bcrypt.hash(codigo, 10);
      // Invalida códigos previos y guarda el nuevo (vence en 10 min).
      await pool.query('UPDATE password_reset_codes SET used = 1 WHERE cliente_id = ? AND used = 0', [cliente.id]);
      await pool.query(
        'INSERT INTO password_reset_codes (cliente_id, code_hash, expires_at) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 10 MINUTE))',
        [cliente.id, codeHash]
      );
      await enviarCodigoReset(email, cliente.nombre, codigo);
    }

    res.json({ message: MSG_GENERICO });
  } catch (err) {
    fail(res, err);
  }
});

// POST /api/portal/recuperar/confirmar — valida el código y define la nueva contraseña (público)
router.post('/recuperar/confirmar', async (req, res) => {
  try {
    const { email, codigo, password } = req.body;
    if (!emailValido(email)) return res.status(400).json({ error: 'El correo no tiene un formato válido' });
    if (!codigo || !password) return res.status(400).json({ error: 'Código y nueva contraseña son requeridos' });
    if (password.length < 6) return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });

    const [[cliente]] = await pool.query(
      'SELECT id, nombre, apellido FROM clientes WHERE email = ? AND activo = 1 AND password_hash IS NOT NULL',
      [email]
    );
    const ERR_CODIGO = 'Código inválido o expirado';
    if (!cliente) return res.status(400).json({ error: ERR_CODIGO });

    const [[reg]] = await pool.query(
      `SELECT id, code_hash, attempts FROM password_reset_codes
       WHERE cliente_id = ? AND used = 0 AND expires_at > NOW()
       ORDER BY created_at DESC LIMIT 1`,
      [cliente.id]
    );
    if (!reg || reg.attempts >= 5) return res.status(400).json({ error: ERR_CODIGO });

    const ok = await bcrypt.compare(String(codigo).trim(), reg.code_hash);
    if (!ok) {
      await pool.query('UPDATE password_reset_codes SET attempts = attempts + 1 WHERE id = ?', [reg.id]);
      return res.status(400).json({ error: ERR_CODIGO });
    }

    const hash = await bcrypt.hash(password, 10);
    await pool.query('UPDATE clientes SET password_hash = ? WHERE id = ?', [hash, cliente.id]);
    await pool.query('UPDATE password_reset_codes SET used = 1 WHERE id = ?', [reg.id]);

    const { payload, token } = tokenCliente(cliente);
    res.json({ data: { token, cliente: payload } });
  } catch (err) {
    fail(res, err);
  }
});

// Todo lo de abajo requiere token de cliente
router.use(authCliente);

// GET /api/portal/ordenes — órdenes del cliente autenticado
router.get('/ordenes', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT o.id, o.numero_orden, o.estado, o.problema_reportado, o.aprobacion_cliente,
              o.fecha_ingreso, o.fecha_estimada_entrega,
              m.marca, m.modelo, m.placa
       FROM ordenes_trabajo o
       JOIN motos m ON m.id = o.moto_id
       WHERE o.cliente_id = ?
       ORDER BY o.fecha_ingreso DESC`,
      [req.cliente.id]
    );
    res.json({ data: rows });
  } catch (err) {
    fail(res, err);
  }
});

// GET /api/portal/ordenes/:id — detalle de una orden propia
router.get('/ordenes/:id', async (req, res) => {
  try {
    const [[orden]] = await pool.query(
      `SELECT o.id, o.numero_orden, o.estado, o.problema_reportado, o.diagnostico,
              o.costo_mano_obra, o.costo_repuestos, o.descuento,
              (o.costo_mano_obra + o.costo_repuestos - o.descuento) AS total,
              o.aprobacion_cliente, o.motivo_rechazo, o.tiempo_estimado_horas,
              o.fecha_ingreso, o.fecha_estimada_entrega, o.fecha_entrega_real,
              o.metodo_pago, o.garantia_dias, o.calificacion, o.comentario_satisfaccion,
              m.marca, m.modelo, m.placa, m.anio,
              u.nombre AS tecnico_nombre
       FROM ordenes_trabajo o
       JOIN motos m ON m.id = o.moto_id
       LEFT JOIN usuarios u ON u.id = o.tecnico_id
       WHERE o.id = ? AND o.cliente_id = ?`,
      [req.params.id, req.cliente.id]
    );
    if (!orden) return res.status(404).json({ error: 'Orden no encontrada' });

    const [avances] = await pool.query(
      `SELECT a.descripcion, a.created_at, u.nombre AS usuario_nombre
       FROM orden_avances a LEFT JOIN usuarios u ON u.id = a.usuario_id
       WHERE a.orden_id = ? ORDER BY a.created_at ASC`,
      [req.params.id]
    );
    const [repuestos] = await pool.query(
      'SELECT nombre, cantidad, costo_unitario, estado FROM orden_repuestos WHERE orden_id = ? ORDER BY created_at ASC',
      [req.params.id]
    );
    const [fotos] = await pool.query(
      'SELECT url, tipo, descripcion FROM orden_fotos WHERE orden_id = ? ORDER BY created_at ASC',
      [req.params.id]
    );
    res.json({ data: { ...orden, avances, repuestos, fotos } });
  } catch (err) {
    fail(res, err);
  }
});

// POST /api/portal/ordenes/:id/aprobar — el cliente aprueba el presupuesto
router.post('/ordenes/:id/aprobar', async (req, res) => {
  try {
    const ok = await actualizarAprobacion(req.params.id, req.cliente.id, 'aprobado', null);
    if (!ok) return res.status(400).json({ error: 'La orden no está esperando aprobación' });
    res.json({ message: 'Presupuesto aprobado' });
  } catch (err) {
    fail(res, err);
  }
});

// POST /api/portal/ordenes/:id/rechazar — el cliente rechaza el presupuesto
router.post('/ordenes/:id/rechazar', async (req, res) => {
  try {
    const ok = await actualizarAprobacion(req.params.id, req.cliente.id, 'rechazado', req.body.motivo || null);
    if (!ok) return res.status(400).json({ error: 'La orden no está esperando aprobación' });
    res.json({ message: 'Presupuesto rechazado' });
  } catch (err) {
    fail(res, err);
  }
});

// POST /api/portal/ordenes/:id/encuesta — calificación de satisfacción (1-5)
router.post('/ordenes/:id/encuesta', async (req, res) => {
  try {
    const calificacion = Number(req.body.calificacion);
    if (!(calificacion >= 1 && calificacion <= 5)) {
      return res.status(400).json({ error: 'La calificación debe ser de 1 a 5' });
    }
    const [[orden]] = await pool.query(
      "SELECT id, calificacion FROM ordenes_trabajo WHERE id = ? AND cliente_id = ? AND estado = 'entregada'",
      [req.params.id, req.cliente.id]
    );
    if (!orden) return res.status(404).json({ error: 'Orden no encontrada o no entregada' });
    if (orden.calificacion) return res.status(400).json({ error: 'Ya calificaste esta orden' });

    await pool.query(
      'UPDATE ordenes_trabajo SET calificacion = ?, comentario_satisfaccion = ? WHERE id = ?',
      [calificacion, req.body.comentario || null, req.params.id]
    );
    res.json({ message: '¡Gracias por tu opinión!' });
  } catch (err) {
    fail(res, err);
  }
});

// GET /api/portal/fidelidad — estado de fidelización del cliente
const VISITAS_PARA_CORTESIA = 7;
router.get('/fidelidad', async (req, res) => {
  try {
    const [[cli]] = await pool.query('SELECT visitas, cortesia_disponible FROM clientes WHERE id = ?', [req.cliente.id]);
    const visitas = cli?.visitas || 0;
    const faltan = cli?.cortesia_disponible ? 0 : (VISITAS_PARA_CORTESIA - (visitas % VISITAS_PARA_CORTESIA)) % VISITAS_PARA_CORTESIA || VISITAS_PARA_CORTESIA;
    res.json({
      data: {
        visitas,
        cortesia_disponible: !!cli?.cortesia_disponible,
        meta: VISITAS_PARA_CORTESIA,
        faltan: cli?.cortesia_disponible ? 0 : faltan,
      },
    });
  } catch (err) {
    fail(res, err);
  }
});

// GET /api/portal/promos — promociones activas (visibles para el cliente)
router.get('/promos', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT id, titulo, descripcion, descuento FROM promos WHERE activa = 1 ORDER BY created_at DESC');
    res.json({ data: rows });
  } catch (err) {
    fail(res, err);
  }
});

// GET /api/portal/motos — motos del cliente (para asociar a una cita)
router.get('/motos', async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT id, marca, modelo, placa, anio, color, kilometraje_actual FROM motos WHERE cliente_id = ? AND activa = 1 ORDER BY created_at DESC',
      [req.cliente.id]
    );
    res.json({ data: rows });
  } catch (err) {
    fail(res, err);
  }
});

// POST /api/portal/motos — el cliente registra una moto propia
// Obligatorios: marca, modelo, placa. Evita placas duplicadas.
router.post('/motos', async (req, res) => {
  try {
    const { marca, modelo, placa, anio, color, kilometraje_actual } = req.body;
    if (!marca || !modelo || !placa) {
      return res.status(400).json({ error: 'Marca, modelo y placa son requeridos' });
    }
    // Bloquea placas ya registradas (normaliza espacios y guiones).
    const [[existe]] = await pool.query(
      `SELECT id FROM motos WHERE activa = 1
         AND UPPER(REPLACE(REPLACE(placa, ' ', ''), '-', '')) = UPPER(REPLACE(REPLACE(?, ' ', ''), '-', ''))`,
      [placa]
    );
    if (existe) return res.status(409).json({ error: 'Esa placa ya está registrada en el taller' });

    const [result] = await pool.query(
      'INSERT INTO motos (cliente_id, marca, modelo, placa, anio, color, kilometraje_actual) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [req.cliente.id, marca, modelo, placa, anio || null, color || null, kilometraje_actual || 0]
    );
    const [[nueva]] = await pool.query(
      'SELECT id, marca, modelo, placa, anio, color, kilometraje_actual FROM motos WHERE id = ?',
      [result.insertId]
    );
    res.status(201).json({ data: nueva, message: 'Moto registrada' });
  } catch (err) {
    fail(res, err);
  }
});

// GET /api/portal/citas — citas del cliente
router.get('/citas', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT ci.id, ci.fecha, ci.hora, ci.motivo, ci.estado,
              m.marca, m.modelo, m.placa
       FROM citas ci
       LEFT JOIN motos m ON m.id = ci.moto_id
       WHERE ci.cliente_id = ?
       ORDER BY ci.fecha DESC, ci.hora DESC`,
      [req.cliente.id]
    );
    res.json({ data: rows });
  } catch (err) {
    fail(res, err);
  }
});

// POST /api/portal/citas — el cliente solicita una cita (queda pendiente de confirmar)
router.post('/citas', async (req, res) => {
  try {
    const { moto_id, fecha, hora, motivo } = req.body;
    if (!fecha || !hora || !motivo) {
      return res.status(400).json({ error: 'Fecha, hora y motivo son requeridos' });
    }
    if (fecha < new Date().toISOString().slice(0, 10)) {
      return res.status(400).json({ error: 'La fecha no puede ser en el pasado' });
    }
    // Si indica moto, validar que sea suya
    if (moto_id) {
      const [[moto]] = await pool.query('SELECT id FROM motos WHERE id = ? AND cliente_id = ?', [moto_id, req.cliente.id]);
      if (!moto) return res.status(400).json({ error: 'Moto no válida' });
    }
    const [result] = await pool.query(
      "INSERT INTO citas (cliente_id, moto_id, fecha, hora, motivo, estado) VALUES (?, ?, ?, ?, ?, 'pendiente')",
      [req.cliente.id, moto_id || null, fecha, hora, motivo]
    );
    const [[nueva]] = await pool.query(
      `SELECT ci.id, ci.fecha, ci.hora, ci.motivo, ci.estado, m.marca, m.modelo, m.placa
       FROM citas ci LEFT JOIN motos m ON m.id = ci.moto_id WHERE ci.id = ?`,
      [result.insertId]
    );
    res.status(201).json({ data: nueva, message: 'Solicitud de cita enviada' });
  } catch (err) {
    fail(res, err);
  }
});

// Solo permite aprobar/rechazar si la orden es del cliente y está esperando aprobación.
async function actualizarAprobacion(ordenId, clienteId, decision, motivo) {
  const [[orden]] = await pool.query(
    "SELECT id FROM ordenes_trabajo WHERE id = ? AND cliente_id = ? AND estado = 'esperando_aprobacion'",
    [ordenId, clienteId]
  );
  if (!orden) return false;
  await pool.query(
    `UPDATE ordenes_trabajo
       SET aprobacion_cliente = ?, motivo_rechazo = ?,
           aprobado_por_cliente = ?, fecha_aprobacion = NOW()
     WHERE id = ?`,
    [decision, motivo, decision === 'aprobado' ? 1 : 0, ordenId]
  );
  return true;
}

module.exports = router;
