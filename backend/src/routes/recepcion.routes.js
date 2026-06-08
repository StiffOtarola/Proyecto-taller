const router = require('express').Router();
const { pool } = require('../db/pool');
const { fail } = require('../utils/responder');
const auth = require('../middleware/auth');
const requireRol = require('../middleware/roles');
const { generarNumeroOrden, sincronizarCitaDesdeOrden } = require('../utils/ordenes');

// Panel de recepción: intermediaria entre cliente y mecánico.
// Accesible a recepción y superiores.
router.use(auth, requireRol('recepcion'));

// Estados de la orden que NO se consideran activos.
const ORDEN_CERRADA = ['entregada', 'cancelada'];

// ───────────────────────────────────────────────────────────
// 1.1 Resumen del día
// ───────────────────────────────────────────────────────────
router.get('/resumen', async (req, res) => {
  try {
    const [[{ citas_hoy }]] = await pool.query(
      'SELECT COUNT(*) AS citas_hoy FROM citas WHERE fecha = CURDATE()'
    );
    const [[{ ordenes_activas }]] = await pool.query(
      "SELECT COUNT(*) AS ordenes_activas FROM ordenes_trabajo WHERE estado NOT IN ('entregada','cancelada')"
    );
    const [[{ cotizaciones_pendientes }]] = await pool.query(
      "SELECT COUNT(*) AS cotizaciones_pendientes FROM ordenes_trabajo WHERE estado = 'esperando_aprobacion' AND aprobacion_cliente = 'pendiente'"
    );
    // "Ocupado" = el técnico tiene trabajo activo en cualquiera de los dos mundos
    // (una cita en proceso hoy, o una orden de trabajo abierta). Misma población
    // que mecanicos_totales, así el cociente X/Y es coherente.
    const [[{ mecanicos_ocupados }]] = await pool.query(
      `SELECT COUNT(*) AS mecanicos_ocupados FROM usuarios u
       WHERE u.rol = 'tecnico' AND u.activo = 1 AND (
         EXISTS (SELECT 1 FROM citas c
                 WHERE c.tecnico_id = u.id AND c.fecha = CURDATE()
                   AND c.estado IN ('en_revision','en_mantenimiento'))
         OR EXISTS (SELECT 1 FROM ordenes_trabajo o
                    WHERE o.tecnico_id = u.id AND o.estado NOT IN ('entregada','cancelada'))
       )`
    );
    const [[{ mecanicos_totales }]] = await pool.query(
      "SELECT COUNT(*) AS mecanicos_totales FROM usuarios WHERE rol = 'tecnico' AND activo = 1"
    );
    res.json({
      data: {
        citas_hoy,
        ordenes_activas,
        cotizaciones_pendientes,
        mecanicos_ocupados,
        mecanicos_totales,
      },
    });
  } catch (err) {
    fail(res, err);
  }
});

// ───────────────────────────────────────────────────────────
// 1.2 Citas del día
// ───────────────────────────────────────────────────────────
router.get('/citas-hoy', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT ci.id, ci.fecha, ci.hora, ci.motivo, ci.tipo_servicio, ci.estado, ci.monto,
              ci.orden_id, o.numero_orden,
              c.id AS cliente_id, c.nombre AS cliente_nombre, c.apellido AS cliente_apellido, c.telefono AS cliente_telefono,
              m.marca, m.modelo, m.placa,
              t.nombre AS tecnico_nombre
       FROM citas ci
       JOIN clientes c ON ci.cliente_id = c.id
       LEFT JOIN motos m ON ci.moto_id = m.id
       LEFT JOIN usuarios t ON ci.tecnico_id = t.id
       LEFT JOIN ordenes_trabajo o ON o.id = ci.orden_id
       WHERE ci.fecha = CURDATE()
       ORDER BY ci.hora ASC`
    );
    res.json({ data: rows });
  } catch (err) {
    fail(res, err);
  }
});

// Crear (o recuperar) la orden de trabajo de una cita: activa el puente cita ↔ orden.
router.post('/citas/:id/crear-orden', async (req, res) => {
  try {
    const [[cita]] = await pool.query(
      'SELECT id, cliente_id, moto_id, motivo, tecnico_id, orden_id FROM citas WHERE id = ?',
      [req.params.id]
    );
    if (!cita) return res.status(404).json({ error: 'Cita no encontrada' });

    // Idempotente: si ya tiene orden, la devuelve.
    if (cita.orden_id) {
      const [[o]] = await pool.query('SELECT id, numero_orden FROM ordenes_trabajo WHERE id = ?', [cita.orden_id]);
      if (o) return res.json({ data: { orden_id: o.id, numero_orden: o.numero_orden }, message: 'La cita ya tiene una orden' });
    }
    if (!cita.moto_id) return res.status(400).json({ error: 'La cita no tiene una moto asociada; no se puede crear la orden' });

    const numero_orden = await generarNumeroOrden();
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      const [result] = await conn.query(
        `INSERT INTO ordenes_trabajo
          (numero_orden, moto_id, cliente_id, recepcionista_id, tecnico_id, problema_reportado, estado)
         VALUES (?, ?, ?, ?, ?, ?, 'diagnostico')`,
        [numero_orden, cita.moto_id, cita.cliente_id, req.usuario.id, cita.tecnico_id || null, cita.motivo || 'Orden generada desde la cita']
      );
      await conn.query('INSERT INTO orden_tiempos (orden_id, etapa) VALUES (?, ?)', [result.insertId, 'diagnostico']);
      await conn.query('UPDATE citas SET orden_id = ? WHERE id = ?', [result.insertId, req.params.id]);
      await conn.commit();
      await sincronizarCitaDesdeOrden(result.insertId, 'diagnostico'); // cita → en_revision + notificación
      res.status(201).json({ data: { orden_id: result.insertId, numero_orden }, message: 'Orden creada desde la cita' });
    } catch (e) {
      await conn.rollback();
      throw e;
    } finally {
      conn.release();
    }
  } catch (err) {
    fail(res, err);
  }
});

// ───────────────────────────────────────────────────────────
// 1.3 Alertas recientes (fotos nuevas + cambios de estado)
// ───────────────────────────────────────────────────────────
router.get('/alertas', async (req, res) => {
  try {
    const [fotos] = await pool.query(
      `SELECT 'foto' AS tipo, f.created_at, f.tipo AS foto_tipo,
              o.numero_orden, o.id AS orden_id,
              m.marca, m.modelo,
              u.nombre AS tecnico_nombre
       FROM orden_fotos f
       JOIN ordenes_trabajo o ON o.id = f.orden_id
       JOIN motos m ON m.id = o.moto_id
       LEFT JOIN usuarios u ON u.id = o.tecnico_id
       WHERE o.estado NOT IN ('entregada','cancelada')
         AND f.created_at >= NOW() - INTERVAL 24 HOUR
       ORDER BY f.created_at DESC LIMIT 10`
    );
    const [estados] = await pool.query(
      `SELECT 'estado' AS tipo, n.created_at, n.titulo, n.mensaje, n.cita_id
       FROM notificaciones n
       WHERE n.created_at >= NOW() - INTERVAL 24 HOUR
       ORDER BY n.created_at DESC LIMIT 10`
    );
    const todas = [...fotos, ...estados]
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, 20);
    res.json({ data: todas });
  } catch (err) {
    fail(res, err);
  }
});

// ───────────────────────────────────────────────────────────
// 1.4 Órdenes con evidencia (activas o completadas según ?estado=)
// ───────────────────────────────────────────────────────────
router.get('/ordenes', async (req, res) => {
  try {
    // ?estado=completadas → entregadas/canceladas; por defecto, activas.
    const completadas = req.query.estado === 'completadas';
    const filtro = completadas
      ? "o.estado IN ('entregada','cancelada')"
      : "o.estado NOT IN ('entregada','cancelada')";
    const [rows] = await pool.query(
      `SELECT o.id, o.numero_orden, o.estado, o.problema_reportado,
              o.costo_mano_obra, o.costo_repuestos, o.descuento,
              (o.costo_mano_obra + o.costo_repuestos - o.descuento) AS total,
              o.fecha_ingreso, o.fecha_estimada_entrega,
              c.id AS cliente_id, c.nombre AS cliente_nombre, c.apellido AS cliente_apellido, c.telefono AS cliente_telefono,
              m.marca, m.modelo, m.placa,
              t.nombre AS tecnico_nombre,
              (SELECT COUNT(*) FROM orden_fotos WHERE orden_id = o.id) AS total_fotos
       FROM ordenes_trabajo o
       JOIN clientes c ON o.cliente_id = c.id
       JOIN motos m ON o.moto_id = m.id
       LEFT JOIN usuarios t ON o.tecnico_id = t.id
       WHERE ${filtro}
       ORDER BY o.fecha_ingreso DESC`
    );
    res.json({ data: rows });
  } catch (err) {
    fail(res, err);
  }
});

// 1.5 Fotos de una orden
router.get('/ordenes/:id/fotos', async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT * FROM orden_fotos WHERE orden_id = ? ORDER BY created_at ASC',
      [req.params.id]
    );
    res.json({ data: rows });
  } catch (err) {
    fail(res, err);
  }
});

// 1.6 Subir foto a una orden (data URL base64). Reusa la lógica de ordenes.routes.js.
router.post('/ordenes/:id/fotos', async (req, res) => {
  try {
    const { url, tipo, descripcion } = req.body;
    if (!url) return res.status(400).json({ error: 'Imagen requerida' });
    const tiposValidos = ['ingreso', 'diagnostico', 'avance', 'entrega'];
    const tipoFinal = tiposValidos.includes(tipo) ? tipo : 'avance';
    const [result] = await pool.query(
      'INSERT INTO orden_fotos (orden_id, url, tipo, descripcion) VALUES (?, ?, ?, ?)',
      [req.params.id, url, tipoFinal, descripcion || null]
    );
    const [[nueva]] = await pool.query('SELECT * FROM orden_fotos WHERE id = ?', [result.insertId]);
    res.status(201).json({ data: nueva, message: 'Foto agregada' });
  } catch (err) {
    fail(res, err);
  }
});

// ───────────────────────────────────────────────────────────
// 1.7 Cotizaciones (órdenes con costos)
// ───────────────────────────────────────────────────────────
router.get('/cotizaciones', async (req, res) => {
  try {
    let filtroAprob = '';
    const params = [];
    if (req.query.estado === 'pendiente') {
      filtroAprob = " AND o.aprobacion_cliente = 'pendiente'";
    } else if (req.query.estado === 'enviada') {
      filtroAprob = " AND o.aprobacion_cliente != 'pendiente'";
    }
    const [rows] = await pool.query(
      `SELECT o.id, o.numero_orden, o.estado, o.aprobacion_cliente,
              o.costo_mano_obra, o.costo_repuestos, o.descuento,
              (o.costo_mano_obra + o.costo_repuestos - o.descuento) AS total,
              c.id AS cliente_id, c.nombre AS cliente_nombre, c.apellido AS cliente_apellido, c.telefono AS cliente_telefono,
              m.marca, m.modelo, m.placa,
              t.nombre AS tecnico_nombre
       FROM ordenes_trabajo o
       JOIN clientes c ON o.cliente_id = c.id
       JOIN motos m ON o.moto_id = m.id
       LEFT JOIN usuarios t ON o.tecnico_id = t.id
       WHERE o.estado NOT IN ('entregada','cancelada')
         AND (o.costo_mano_obra > 0 OR o.costo_repuestos > 0)${filtroAprob}
       ORDER BY o.created_at DESC`,
      params
    );
    res.json({ data: rows });
  } catch (err) {
    fail(res, err);
  }
});

// Repuestos de una orden
router.get('/cotizaciones/:id/repuestos', async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT * FROM orden_repuestos WHERE orden_id = ? ORDER BY created_at ASC',
      [req.params.id]
    );
    res.json({ data: rows });
  } catch (err) {
    fail(res, err);
  }
});

// Recalcula costo_repuestos de la orden a partir de sus piezas.
async function recalcularRepuestos(ordenId) {
  await pool.query(
    'UPDATE ordenes_trabajo SET costo_repuestos = (SELECT COALESCE(SUM(cantidad * costo_unitario), 0) FROM orden_repuestos WHERE orden_id = ?) WHERE id = ?',
    [ordenId, ordenId]
  );
}

// Agregar repuesto
router.post('/cotizaciones/:id/repuestos', async (req, res) => {
  try {
    const { nombre, cantidad, costo_unitario, estado } = req.body;
    if (!nombre) return res.status(400).json({ error: 'Nombre del repuesto requerido' });
    const [result] = await pool.query(
      'INSERT INTO orden_repuestos (orden_id, nombre, cantidad, costo_unitario, estado) VALUES (?, ?, ?, ?, ?)',
      [req.params.id, nombre, cantidad || 1, costo_unitario || 0, estado || 'pendiente']
    );
    await recalcularRepuestos(req.params.id);
    const [[nuevo]] = await pool.query('SELECT * FROM orden_repuestos WHERE id = ?', [result.insertId]);
    res.status(201).json({ data: nuevo, message: 'Repuesto agregado' });
  } catch (err) {
    fail(res, err);
  }
});

// Editar repuesto
router.put('/cotizaciones/:id/repuestos/:rid', async (req, res) => {
  try {
    const { nombre, cantidad, costo_unitario, estado } = req.body;
    const [[existe]] = await pool.query('SELECT id FROM orden_repuestos WHERE id = ? AND orden_id = ?', [req.params.rid, req.params.id]);
    if (!existe) return res.status(404).json({ error: 'Repuesto no encontrado' });
    await pool.query(
      'UPDATE orden_repuestos SET nombre=?, cantidad=?, costo_unitario=?, estado=? WHERE id=? AND orden_id=?',
      [nombre, cantidad || 1, costo_unitario || 0, estado || 'pendiente', req.params.rid, req.params.id]
    );
    await recalcularRepuestos(req.params.id);
    const [[actualizado]] = await pool.query('SELECT * FROM orden_repuestos WHERE id = ?', [req.params.rid]);
    res.json({ data: actualizado, message: 'Repuesto actualizado' });
  } catch (err) {
    fail(res, err);
  }
});

// Eliminar repuesto
router.delete('/cotizaciones/:id/repuestos/:rid', async (req, res) => {
  try {
    const [result] = await pool.query('DELETE FROM orden_repuestos WHERE id=? AND orden_id=?', [req.params.rid, req.params.id]);
    if (!result.affectedRows) return res.status(404).json({ error: 'Repuesto no encontrado' });
    await recalcularRepuestos(req.params.id);
    res.json({ message: 'Repuesto eliminado' });
  } catch (err) {
    fail(res, err);
  }
});

// Actualizar mano de obra y descuento
router.put('/cotizaciones/:id/costos', async (req, res) => {
  try {
    const { costo_mano_obra, descuento } = req.body;
    const [[orden]] = await pool.query('SELECT id FROM ordenes_trabajo WHERE id = ?', [req.params.id]);
    if (!orden) return res.status(404).json({ error: 'Orden no encontrada' });
    await pool.query(
      'UPDATE ordenes_trabajo SET costo_mano_obra = ?, descuento = ? WHERE id = ?',
      [costo_mano_obra || 0, descuento || 0, req.params.id]
    );
    const [[actualizada]] = await pool.query(
      'SELECT id, costo_mano_obra, costo_repuestos, descuento, (costo_mano_obra + costo_repuestos - descuento) AS total FROM ordenes_trabajo WHERE id = ?',
      [req.params.id]
    );
    res.json({ data: actualizada, message: 'Costos actualizados' });
  } catch (err) {
    fail(res, err);
  }
});

// Armar una cotización completa en UNA transacción: asigna técnico (opcional),
// inserta todas las piezas, fija mano de obra + descuento y recalcula los repuestos.
// Si algo falla, no queda nada a medias (antes el front encadenaba varias llamadas).
router.post('/cotizaciones/:id/armar', async (req, res) => {
  const ordenId = req.params.id;
  const { tecnico_id, piezas, costo_mano_obra, descuento } = req.body;

  const piezasValidas = Array.isArray(piezas)
    ? piezas
        .map(p => ({ nombre: String(p?.nombre || '').trim(), cantidad: Number(p?.cantidad) || 1, costo_unitario: Number(p?.costo_unitario) || 0 }))
        .filter(p => p.nombre && p.costo_unitario > 0)
    : [];
  if (!piezasValidas.length) {
    return res.status(400).json({ error: 'Agregá al menos una pieza con monto' });
  }

  try {
    const [[orden]] = await pool.query('SELECT id FROM ordenes_trabajo WHERE id = ?', [ordenId]);
    if (!orden) return res.status(404).json({ error: 'Orden no encontrada' });

    if (tecnico_id) {
      const [[tec]] = await pool.query(
        "SELECT id FROM usuarios WHERE id = ? AND rol = 'tecnico' AND activo = 1",
        [tecnico_id]
      );
      if (!tec) return res.status(400).json({ error: 'El técnico no existe o está inactivo' });
    }

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      if (tecnico_id) {
        await conn.query('UPDATE ordenes_trabajo SET tecnico_id = ? WHERE id = ?', [tecnico_id, ordenId]);
      }
      for (const p of piezasValidas) {
        await conn.query(
          "INSERT INTO orden_repuestos (orden_id, nombre, cantidad, costo_unitario, estado) VALUES (?, ?, ?, ?, 'pendiente')",
          [ordenId, p.nombre, p.cantidad, p.costo_unitario]
        );
      }
      await conn.query(
        'UPDATE ordenes_trabajo SET costo_mano_obra = ?, descuento = ? WHERE id = ?',
        [Number(costo_mano_obra) || 0, Number(descuento) || 0, ordenId]
      );
      await conn.query(
        'UPDATE ordenes_trabajo SET costo_repuestos = (SELECT COALESCE(SUM(cantidad * costo_unitario), 0) FROM orden_repuestos WHERE orden_id = ?) WHERE id = ?',
        [ordenId, ordenId]
      );
      await conn.commit();
    } catch (e) {
      await conn.rollback();
      throw e;
    } finally {
      conn.release();
    }

    const [[cotizacion]] = await pool.query(
      'SELECT id, costo_mano_obra, costo_repuestos, descuento, (costo_mano_obra + costo_repuestos - descuento) AS total FROM ordenes_trabajo WHERE id = ?',
      [ordenId]
    );
    res.status(201).json({ data: cotizacion, message: 'Cotización guardada' });
  } catch (err) {
    fail(res, err);
  }
});

// Enviar cotización: la orden pasa a esperando aprobación del cliente.
router.post('/cotizaciones/:id/enviar', async (req, res) => {
  try {
    const [result] = await pool.query(
      "UPDATE ordenes_trabajo SET estado = 'esperando_aprobacion' WHERE id = ? AND estado IN ('diagnostico','recepcion')",
      [req.params.id]
    );
    if (!result.affectedRows) {
      return res.status(400).json({ error: 'La orden no está en un estado que permita enviar la cotización' });
    }
    // Aviso en el feed del cliente (además del WhatsApp que abre la recepción).
    const [[o]] = await pool.query(
      `SELECT o.cliente_id, o.numero_orden, m.marca, m.modelo
       FROM ordenes_trabajo o JOIN motos m ON m.id = o.moto_id WHERE o.id = ?`,
      [req.params.id]
    );
    if (o) {
      const moto = [o.marca, o.modelo].filter(Boolean).join(' ') || 'tu moto';
      await pool.query(
        'INSERT INTO notificaciones (cliente_id, titulo, mensaje) VALUES (?, ?, ?)',
        [o.cliente_id, `Presupuesto listo: ${moto}`, `Tu presupuesto (orden ${o.numero_orden}) está listo. Revisalo y aprobalo desde el portal.`]
      );
    }
    res.json({ message: 'Cotización enviada al cliente' });
  } catch (err) {
    fail(res, err);
  }
});

// ───────────────────────────────────────────────────────────
// Órdenes activas de un cliente (para armar una cotización nueva)
// ───────────────────────────────────────────────────────────
router.get('/clientes/:id/ordenes', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT o.id, o.numero_orden, o.estado, o.problema_reportado,
              m.marca, m.modelo, m.placa
       FROM ordenes_trabajo o
       JOIN motos m ON o.moto_id = m.id
       WHERE o.cliente_id = ? AND o.estado NOT IN ('entregada','cancelada')
       ORDER BY o.fecha_ingreso DESC`,
      [req.params.id]
    );
    res.json({ data: rows });
  } catch (err) {
    fail(res, err);
  }
});

// Técnicos activos (recepción no puede usar /api/usuarios, que es solo admin)
router.get('/tecnicos', async (req, res) => {
  try {
    const [rows] = await pool.query(
      "SELECT id, nombre FROM usuarios WHERE rol = 'tecnico' AND activo = 1 ORDER BY nombre"
    );
    res.json({ data: rows });
  } catch (err) {
    fail(res, err);
  }
});

// Asignar técnico a una orden (al crear/editar una cotización)
router.patch('/ordenes/:id/tecnico', async (req, res) => {
  try {
    const { tecnico_id } = req.body;
    const [[orden]] = await pool.query('SELECT id FROM ordenes_trabajo WHERE id = ?', [req.params.id]);
    if (!orden) return res.status(404).json({ error: 'Orden no encontrada' });
    if (tecnico_id) {
      const [[tec]] = await pool.query("SELECT id FROM usuarios WHERE id = ? AND rol = 'tecnico' AND activo = 1", [tecnico_id]);
      if (!tec) return res.status(400).json({ error: 'El técnico no existe o está inactivo' });
    }
    await pool.query('UPDATE ordenes_trabajo SET tecnico_id = ? WHERE id = ?', [tecnico_id || null, req.params.id]);
    res.json({ message: 'Técnico asignado' });
  } catch (err) {
    fail(res, err);
  }
});

// Marcar una cotización como aprobada por el cliente (atajo desde recepción)
router.post('/cotizaciones/:id/aprobar', async (req, res) => {
  try {
    const [[orden]] = await pool.query('SELECT id FROM ordenes_trabajo WHERE id = ?', [req.params.id]);
    if (!orden) return res.status(404).json({ error: 'Orden no encontrada' });
    await pool.query(
      "UPDATE ordenes_trabajo SET aprobacion_cliente = 'aprobado', aprobado_por_cliente = 1, fecha_aprobacion = NOW() WHERE id = ?",
      [req.params.id]
    );
    res.json({ message: 'Cotización aprobada' });
  } catch (err) {
    fail(res, err);
  }
});

// ───────────────────────────────────────────────────────────
// 1.8 Directorio de clientes (con búsqueda ?q=)
// ───────────────────────────────────────────────────────────
router.get('/clientes', async (req, res) => {
  try {
    const q = (req.query.q || '').trim();
    let sql = `
      SELECT c.id, c.nombre, c.apellido, c.telefono, c.email,
             (SELECT COUNT(*) FROM motos WHERE cliente_id = c.id AND activa = 1) AS total_motos,
             (SELECT COUNT(*) FROM citas WHERE cliente_id = c.id) AS total_citas
      FROM clientes c
      WHERE c.activo = 1`;
    const params = [];
    if (q) {
      sql += ' AND (c.nombre LIKE ? OR c.apellido LIKE ? OR c.telefono LIKE ? OR c.email LIKE ? OR CONCAT(c.nombre, " ", c.apellido) LIKE ?)';
      const like = `%${q}%`;
      params.push(like, like, like, like, like);
    }
    sql += ' ORDER BY c.nombre, c.apellido';
    const [rows] = await pool.query(sql, params);
    res.json({ data: rows });
  } catch (err) {
    fail(res, err);
  }
});

// ───────────────────────────────────────────────────────────
// 1.9 Mensajes: avances de mecánicos (entrada) y notificaciones a clientes (salida)
// ───────────────────────────────────────────────────────────

// Avances recientes registrados por los mecánicos en órdenes activas.
router.get('/avances', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT a.id, a.descripcion, a.created_at,
              o.id AS orden_id, o.numero_orden, o.estado,
              c.id AS cliente_id, c.nombre AS cliente_nombre, c.apellido AS cliente_apellido, c.telefono AS cliente_telefono,
              m.marca, m.modelo, m.placa,
              u.nombre AS tecnico_nombre, u.rol AS tecnico_rol,
              (SELECT COUNT(*) FROM orden_fotos WHERE orden_id = o.id) AS total_fotos
       FROM orden_avances a
       JOIN ordenes_trabajo o ON o.id = a.orden_id
       JOIN clientes c ON c.id = o.cliente_id
       JOIN motos m ON m.id = o.moto_id
       JOIN usuarios u ON u.id = a.usuario_id
       ORDER BY a.created_at DESC LIMIT 40`
    );
    res.json({ data: rows });
  } catch (err) {
    fail(res, err);
  }
});

// Notificaciones enviadas a clientes (feed de salida).
router.get('/notificaciones', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT n.id, n.titulo, n.mensaje, n.leida, n.created_at,
              c.id AS cliente_id, c.nombre AS cliente_nombre, c.apellido AS cliente_apellido, c.telefono AS cliente_telefono
       FROM notificaciones n
       JOIN clientes c ON c.id = n.cliente_id
       ORDER BY n.created_at DESC LIMIT 40`
    );
    res.json({ data: rows });
  } catch (err) {
    fail(res, err);
  }
});

// Enviar una notificación manual al cliente.
router.post('/notificar', async (req, res) => {
  try {
    const { cliente_id, cita_id, titulo, mensaje } = req.body;
    if (!cliente_id || !titulo || !mensaje) {
      return res.status(400).json({ error: 'cliente_id, titulo y mensaje son requeridos' });
    }
    const [result] = await pool.query(
      'INSERT INTO notificaciones (cliente_id, cita_id, titulo, mensaje) VALUES (?, ?, ?, ?)',
      [cliente_id, cita_id || null, titulo, mensaje]
    );
    const [[nueva]] = await pool.query('SELECT * FROM notificaciones WHERE id = ?', [result.insertId]);
    res.status(201).json({ data: nueva, message: 'Notificación enviada' });
  } catch (err) {
    fail(res, err);
  }
});

// ───────────────────────────────────────────────────────────
// Mensajería interna con los mecánicos (lado recepción)
// ───────────────────────────────────────────────────────────
const SELECT_MSG_INT = `
  SELECT m.id, m.mensaje, m.created_at, m.leido, m.remitente_id, m.destino_rol, m.destino_id,
         ru.nombre AS remitente_nombre, ru.rol AS remitente_rol,
         du.nombre AS destino_nombre
  FROM mensajes_internos m
  JOIN usuarios ru ON ru.id = m.remitente_id
  LEFT JOIN usuarios du ON du.id = m.destino_id`;

router.get('/mensajes-internos', async (req, res) => {
  try {
    const [rows] = await pool.query(`${SELECT_MSG_INT} ORDER BY m.created_at DESC LIMIT 100`);
    // Marca como leídos los mensajes que los mecánicos dirigieron a recepción.
    await pool.query("UPDATE mensajes_internos SET leido = 1 WHERE destino_rol = 'recepcion' AND leido = 0");
    res.json({ data: rows });
  } catch (err) {
    fail(res, err);
  }
});

router.post('/mensajes-internos', async (req, res) => {
  try {
    const { destino_id, mensaje } = req.body;
    if (!destino_id || !mensaje || !mensaje.trim()) {
      return res.status(400).json({ error: 'Destinatario y mensaje son requeridos' });
    }
    const [r] = await pool.query(
      'INSERT INTO mensajes_internos (remitente_id, destino_id, mensaje) VALUES (?, ?, ?)',
      [req.usuario.id, destino_id, mensaje.trim()]
    );
    const [[nuevo]] = await pool.query(`${SELECT_MSG_INT} WHERE m.id = ?`, [r.insertId]);
    res.status(201).json({ data: nuevo, message: 'Respuesta enviada' });
  } catch (err) {
    fail(res, err);
  }
});

module.exports = router;
