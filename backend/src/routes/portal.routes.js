const router = require('express').Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const { pool } = require('../db/pool');
const authCliente = require('../middleware/auth-cliente');

// POST /api/portal/login — login del cliente con email + contraseña
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email y contraseña requeridos' });
    const [[cliente]] = await pool.query(
      'SELECT * FROM clientes WHERE email = ? AND activo = 1',
      [email]
    );
    if (!cliente || !cliente.password_hash) {
      return res.status(401).json({ error: 'Credenciales incorrectas o portal no habilitado' });
    }
    const ok = await bcrypt.compare(password, cliente.password_hash);
    if (!ok) return res.status(401).json({ error: 'Credenciales incorrectas' });

    const payload = { id: cliente.id, tipo: 'cliente', nombre: cliente.nombre, apellido: cliente.apellido };
    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '8h' });
    res.json({ data: { token, cliente: payload } });
  } catch (err) {
    res.status(500).json({ error: err.message });
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
    res.status(500).json({ error: err.message });
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
              o.metodo_pago, o.garantia_dias,
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
    res.status(500).json({ error: err.message });
  }
});

// POST /api/portal/ordenes/:id/aprobar — el cliente aprueba el presupuesto
router.post('/ordenes/:id/aprobar', async (req, res) => {
  try {
    const ok = await actualizarAprobacion(req.params.id, req.cliente.id, 'aprobado', null);
    if (!ok) return res.status(400).json({ error: 'La orden no está esperando aprobación' });
    res.json({ message: 'Presupuesto aprobado' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/portal/ordenes/:id/rechazar — el cliente rechaza el presupuesto
router.post('/ordenes/:id/rechazar', async (req, res) => {
  try {
    const ok = await actualizarAprobacion(req.params.id, req.cliente.id, 'rechazado', req.body.motivo || null);
    if (!ok) return res.status(400).json({ error: 'La orden no está esperando aprobación' });
    res.json({ message: 'Presupuesto rechazado' });
  } catch (err) {
    res.status(500).json({ error: err.message });
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
