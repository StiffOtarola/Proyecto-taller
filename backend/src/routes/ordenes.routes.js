const router = require('express').Router();
const { pool } = require('../db/pool');
const auth = require('../middleware/auth');
const requireRol = require('../middleware/roles');

router.use(auth);

// Generar numero_orden: OT-YYYY-XXXX
async function generarNumeroOrden() {
  const year = new Date().getFullYear();
  const [[{ count }]] = await pool.query(
    'SELECT COUNT(*) as count FROM ordenes_trabajo WHERE YEAR(created_at) = ?',
    [year]
  );
  return `OT-${year}-${String(count + 1).padStart(4, '0')}`;
}

// GET /api/ordenes
router.get('/', async (req, res) => {
  try {
    const { estado, tecnico_id, fecha_desde, fecha_hasta } = req.query;
    let sql = `
      SELECT ot.id, ot.numero_orden, ot.estado, ot.prioridad, ot.categoria, ot.problema_reportado,
             ot.fecha_ingreso, ot.fecha_estimada_entrega,
             ot.costo_mano_obra, ot.costo_repuestos, ot.descuento,
             (ot.costo_mano_obra + ot.costo_repuestos - ot.descuento) AS total,
             c.nombre AS cliente_nombre, c.apellido AS cliente_apellido, c.telefono AS cliente_telefono,
             m.marca, m.modelo, m.placa, m.color,
             u.nombre AS tecnico_nombre
      FROM ordenes_trabajo ot
      JOIN clientes c ON ot.cliente_id = c.id
      JOIN motos m ON ot.moto_id = m.id
      LEFT JOIN usuarios u ON ot.tecnico_id = u.id
      WHERE 1=1`;
    const params = [];
    if (estado) { sql += ' AND ot.estado = ?'; params.push(estado); }
    if (tecnico_id) { sql += ' AND ot.tecnico_id = ?'; params.push(tecnico_id); }
    if (fecha_desde) { sql += ' AND DATE(ot.fecha_ingreso) >= ?'; params.push(fecha_desde); }
    if (fecha_hasta) { sql += ' AND DATE(ot.fecha_ingreso) <= ?'; params.push(fecha_hasta); }
    sql += ' ORDER BY ot.fecha_ingreso DESC';
    const [rows] = await pool.query(sql, params);
    res.json({ data: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/ordenes
router.post('/', async (req, res) => {
  try {
    const {
      moto_id, cliente_id, problema_reportado, kilometraje_ingreso,
      nivel_combustible, accesorios_entregados, estado_fisico,
      prioridad, categoria, fecha_estimada_entrega,
    } = req.body;

    if (!moto_id || !cliente_id || !problema_reportado) {
      return res.status(400).json({ error: 'moto_id, cliente_id y problema_reportado son requeridos' });
    }

    const numero_orden = await generarNumeroOrden();

    const [result] = await pool.query(
      `INSERT INTO ordenes_trabajo
        (numero_orden, moto_id, cliente_id, recepcionista_id, problema_reportado,
         kilometraje_ingreso, nivel_combustible, accesorios_entregados, estado_fisico,
         prioridad, categoria, fecha_estimada_entrega)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        numero_orden, moto_id, cliente_id, req.usuario.id, problema_reportado,
        kilometraje_ingreso || null, nivel_combustible || 'cuarto',
        accesorios_entregados || null, estado_fisico || null,
        prioridad || 'normal', categoria || 'diagnostico',
        fecha_estimada_entrega || null,
      ]
    );

    // Registrar tiempo inicial
    await pool.query(
      'INSERT INTO orden_tiempos (orden_id, etapa) VALUES (?, ?)',
      [result.insertId, 'recepcion']
    );

    const [[nueva]] = await pool.query('SELECT * FROM ordenes_trabajo WHERE id = ?', [result.insertId]);
    res.status(201).json({ data: nueva, message: 'Orden creada' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/ordenes/:id
router.get('/:id', async (req, res) => {
  try {
    const [[orden]] = await pool.query(
      `SELECT ot.*,
              c.nombre AS cliente_nombre, c.apellido AS cliente_apellido, c.telefono AS cliente_telefono, c.email AS cliente_email,
              m.marca, m.modelo, m.placa, m.color, m.anio, m.kilometraje_actual,
              u.nombre AS tecnico_nombre,
              r.nombre AS recepcionista_nombre,
              (ot.costo_mano_obra + ot.costo_repuestos - ot.descuento) AS total
       FROM ordenes_trabajo ot
       JOIN clientes c ON ot.cliente_id = c.id
       JOIN motos m ON ot.moto_id = m.id
       LEFT JOIN usuarios u ON ot.tecnico_id = u.id
       LEFT JOIN usuarios r ON ot.recepcionista_id = r.id
       WHERE ot.id = ?`,
      [req.params.id]
    );
    if (!orden) return res.status(404).json({ error: 'Orden no encontrada' });
    res.json({ data: orden });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/ordenes/:id
router.put('/:id', async (req, res) => {
  try {
    const {
      diagnostico, tiempo_estimado_horas, costo_mano_obra, costo_repuestos, descuento,
      fecha_estimada_entrega, prioridad, categoria, accesorios_entregados, estado_fisico,
    } = req.body;
    await pool.query(
      `UPDATE ordenes_trabajo SET
        diagnostico=?, tiempo_estimado_horas=?, costo_mano_obra=?, costo_repuestos=?,
        descuento=?, fecha_estimada_entrega=?, prioridad=?, categoria=?,
        accesorios_entregados=?, estado_fisico=?
       WHERE id=?`,
      [
        diagnostico || null, tiempo_estimado_horas || null,
        costo_mano_obra || 0, costo_repuestos || 0, descuento || 0,
        fecha_estimada_entrega || null, prioridad || 'normal', categoria || 'diagnostico',
        accesorios_entregados || null, estado_fisico || null,
        req.params.id,
      ]
    );
    const [[actualizada]] = await pool.query('SELECT * FROM ordenes_trabajo WHERE id = ?', [req.params.id]);
    res.json({ data: actualizada, message: 'Orden actualizada' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/ordenes/:id/estado
const ESTADOS_VALIDOS = ['recepcion','diagnostico','esperando_aprobacion','esperando_repuestos','en_reparacion','lista_entrega','entregada','cancelada'];
const ETAPAS_TIEMPO = ['recepcion','diagnostico','esperando_aprobacion','esperando_repuestos','en_reparacion','lista_entrega'];

router.patch('/:id/estado', async (req, res) => {
  try {
    const { estado } = req.body;
    if (!ESTADOS_VALIDOS.includes(estado)) {
      return res.status(400).json({ error: 'Estado inválido' });
    }

    // Solo admin/gerencia pueden cancelar
    if (estado === 'cancelada') {
      const nivel = ['recepcion','tecnico','jefe_taller','admin','gerencia'].indexOf(req.usuario.rol);
      if (nivel < 3) return res.status(403).json({ error: 'Solo admin o gerencia pueden cancelar una orden' });
    }

    const [[orden]] = await pool.query('SELECT estado FROM ordenes_trabajo WHERE id = ?', [req.params.id]);
    if (!orden) return res.status(404).json({ error: 'Orden no encontrada' });

    // Cerrar tiempo de etapa anterior
    if (ETAPAS_TIEMPO.includes(orden.estado)) {
      await pool.query(
        'UPDATE orden_tiempos SET fin = NOW() WHERE orden_id = ? AND etapa = ? AND fin IS NULL',
        [req.params.id, orden.estado]
      );
    }

    await pool.query('UPDATE ordenes_trabajo SET estado = ? WHERE id = ?', [estado, req.params.id]);

    // Abrir nuevo tiempo
    if (ETAPAS_TIEMPO.includes(estado)) {
      await pool.query('INSERT INTO orden_tiempos (orden_id, etapa) VALUES (?, ?)', [req.params.id, estado]);
    }

    res.json({ data: { estado }, message: 'Estado actualizado' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/ordenes/:id/tecnico
router.patch('/:id/tecnico', requireRol('jefe_taller'), async (req, res) => {
  try {
    const { tecnico_id } = req.body;
    await pool.query('UPDATE ordenes_trabajo SET tecnico_id = ? WHERE id = ?', [tecnico_id || null, req.params.id]);
    res.json({ message: 'Técnico asignado' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/ordenes/:id/avances
router.post('/:id/avances', async (req, res) => {
  try {
    const { descripcion } = req.body;
    if (!descripcion) return res.status(400).json({ error: 'Descripción requerida' });
    const [result] = await pool.query(
      'INSERT INTO orden_avances (orden_id, usuario_id, descripcion) VALUES (?, ?, ?)',
      [req.params.id, req.usuario.id, descripcion]
    );
    const [[nuevo]] = await pool.query('SELECT * FROM orden_avances WHERE id = ?', [result.insertId]);
    res.status(201).json({ data: nuevo, message: 'Avance registrado' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/ordenes/:id/avances
router.get('/:id/avances', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT oa.*, u.nombre AS usuario_nombre, u.rol AS usuario_rol
       FROM orden_avances oa JOIN usuarios u ON oa.usuario_id = u.id
       WHERE oa.orden_id = ? ORDER BY oa.created_at ASC`,
      [req.params.id]
    );
    res.json({ data: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/ordenes/:id/repuestos
router.post('/:id/repuestos', async (req, res) => {
  try {
    const { nombre, cantidad, costo_unitario, estado } = req.body;
    if (!nombre) return res.status(400).json({ error: 'Nombre del repuesto requerido' });
    const [result] = await pool.query(
      'INSERT INTO orden_repuestos (orden_id, nombre, cantidad, costo_unitario, estado) VALUES (?, ?, ?, ?, ?)',
      [req.params.id, nombre, cantidad || 1, costo_unitario || 0, estado || 'pendiente']
    );
    // Actualizar costo_repuestos en la orden
    await pool.query(
      'UPDATE ordenes_trabajo SET costo_repuestos = (SELECT COALESCE(SUM(cantidad * costo_unitario), 0) FROM orden_repuestos WHERE orden_id = ?) WHERE id = ?',
      [req.params.id, req.params.id]
    );
    const [[nuevo]] = await pool.query('SELECT * FROM orden_repuestos WHERE id = ?', [result.insertId]);
    res.status(201).json({ data: nuevo, message: 'Repuesto agregado' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/ordenes/:id/repuestos
router.get('/:id/repuestos', async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT * FROM orden_repuestos WHERE orden_id = ? ORDER BY created_at ASC',
      [req.params.id]
    );
    res.json({ data: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/ordenes/:id/repuestos/:rid
router.put('/:id/repuestos/:rid', async (req, res) => {
  try {
    const { nombre, cantidad, costo_unitario, estado } = req.body;
    await pool.query(
      'UPDATE orden_repuestos SET nombre=?, cantidad=?, costo_unitario=?, estado=? WHERE id=? AND orden_id=?',
      [nombre, cantidad || 1, costo_unitario || 0, estado || 'pendiente', req.params.rid, req.params.id]
    );
    await pool.query(
      'UPDATE ordenes_trabajo SET costo_repuestos = (SELECT COALESCE(SUM(cantidad * costo_unitario), 0) FROM orden_repuestos WHERE orden_id = ?) WHERE id = ?',
      [req.params.id, req.params.id]
    );
    const [[actualizado]] = await pool.query('SELECT * FROM orden_repuestos WHERE id = ?', [req.params.rid]);
    res.json({ data: actualizado, message: 'Repuesto actualizado' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/ordenes/:id/repuestos/:rid
router.delete('/:id/repuestos/:rid', async (req, res) => {
  try {
    await pool.query('DELETE FROM orden_repuestos WHERE id=? AND orden_id=?', [req.params.rid, req.params.id]);
    await pool.query(
      'UPDATE ordenes_trabajo SET costo_repuestos = (SELECT COALESCE(SUM(cantidad * costo_unitario), 0) FROM orden_repuestos WHERE orden_id = ?) WHERE id = ?',
      [req.params.id, req.params.id]
    );
    res.json({ message: 'Repuesto eliminado' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/ordenes/:id/aprobar
router.patch('/:id/aprobar', async (req, res) => {
  try {
    await pool.query(
      'UPDATE ordenes_trabajo SET aprobado_por_cliente = 1, fecha_aprobacion = NOW() WHERE id = ?',
      [req.params.id]
    );
    res.json({ message: 'Orden aprobada por el cliente' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /GET /api/ordenes/:id/checklist
router.post('/:id/checklist', async (req, res) => {
  try {
    const { prueba_realizada, lavado, calidad_revisada, facturacion_lista, cliente_notificado, observaciones } = req.body;
    await pool.query(
      `INSERT INTO orden_checklist (orden_id, prueba_realizada, lavado, calidad_revisada, facturacion_lista, cliente_notificado, observaciones)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE prueba_realizada=VALUES(prueba_realizada), lavado=VALUES(lavado),
         calidad_revisada=VALUES(calidad_revisada), facturacion_lista=VALUES(facturacion_lista),
         cliente_notificado=VALUES(cliente_notificado), observaciones=VALUES(observaciones)`,
      [req.params.id, prueba_realizada ? 1 : 0, lavado ? 1 : 0, calidad_revisada ? 1 : 0, facturacion_lista ? 1 : 0, cliente_notificado ? 1 : 0, observaciones || null]
    );
    res.json({ message: 'Checklist guardado' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id/checklist', async (req, res) => {
  try {
    const [[checklist]] = await pool.query('SELECT * FROM orden_checklist WHERE orden_id = ?', [req.params.id]);
    res.json({ data: checklist || null });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Fidelización: cada cuántas entregas el cliente gana una cortesía
const VISITAS_PARA_CORTESIA = 7;

// PATCH /api/ordenes/:id/cerrar
router.patch('/:id/cerrar', requireRol('jefe_taller'), async (req, res) => {
  try {
    const { metodo_pago, garantia_dias, observaciones_finales } = req.body;
    await pool.query(
      `UPDATE ordenes_trabajo SET estado='entregada', metodo_pago=?, garantia_dias=?,
       observaciones_finales=?, fecha_entrega_real=NOW() WHERE id=?`,
      [metodo_pago || null, garantia_dias || 0, observaciones_finales || null, req.params.id]
    );

    // Fidelización: contar la visita una sola vez por orden y otorgar cortesía cada N entregas
    const [[orden]] = await pool.query('SELECT cliente_id, visita_contada FROM ordenes_trabajo WHERE id = ?', [req.params.id]);
    let cortesiaGanada = false;
    if (orden && !orden.visita_contada) {
      await pool.query('UPDATE ordenes_trabajo SET visita_contada = 1 WHERE id = ?', [req.params.id]);
      await pool.query('UPDATE clientes SET visitas = visitas + 1 WHERE id = ?', [orden.cliente_id]);
      const [[cli]] = await pool.query('SELECT visitas FROM clientes WHERE id = ?', [orden.cliente_id]);
      if (cli && cli.visitas > 0 && cli.visitas % VISITAS_PARA_CORTESIA === 0) {
        await pool.query('UPDATE clientes SET cortesia_disponible = 1 WHERE id = ?', [orden.cliente_id]);
        cortesiaGanada = true;
      }
    }

    res.json({ message: 'Orden cerrada y entregada', cortesia_ganada: cortesiaGanada });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/ordenes/:id/fotos — guarda una foto (data URL base64) como evidencia
router.post('/:id/fotos', async (req, res) => {
  try {
    const { url, tipo, descripcion } = req.body;
    if (!url) return res.status(400).json({ error: 'Imagen requerida' });
    const tiposValidos = ['ingreso', 'diagnostico', 'avance', 'entrega'];
    const tipoFinal = tiposValidos.includes(tipo) ? tipo : 'ingreso';
    const [result] = await pool.query(
      'INSERT INTO orden_fotos (orden_id, url, tipo, descripcion) VALUES (?, ?, ?, ?)',
      [req.params.id, url, tipoFinal, descripcion || null]
    );
    const [[nueva]] = await pool.query('SELECT * FROM orden_fotos WHERE id = ?', [result.insertId]);
    res.status(201).json({ data: nueva, message: 'Foto agregada' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/ordenes/:id/fotos
router.get('/:id/fotos', async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT * FROM orden_fotos WHERE orden_id = ? ORDER BY created_at ASC',
      [req.params.id]
    );
    res.json({ data: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/ordenes/:id/fotos/:fid
router.delete('/:id/fotos/:fid', async (req, res) => {
  try {
    await pool.query('DELETE FROM orden_fotos WHERE id = ? AND orden_id = ?', [req.params.fid, req.params.id]);
    res.json({ message: 'Foto eliminada' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
