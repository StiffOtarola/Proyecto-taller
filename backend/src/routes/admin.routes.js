const router = require('express').Router();
const { pool } = require('../db/pool');
const { fail } = require('../utils/responder');
const auth = require('../middleware/auth');
const requireRol = require('../middleware/roles');

// Panel del administrador: métricas ejecutivas. Solo admin.
router.use(auth, requireRol('admin'));

// GET /api/admin/resumen — KPIs del mes + distribución de citas + ingresos por servicio.
router.get('/resumen', async (req, res) => {
  try {
    const [[{ total_citas }]] = await pool.query(
      'SELECT COUNT(*) AS total_citas FROM citas WHERE MONTH(fecha) = MONTH(CURDATE()) AND YEAR(fecha) = YEAR(CURDATE())'
    );
    const [[{ citas_pendientes }]] = await pool.query(
      "SELECT COUNT(*) AS citas_pendientes FROM citas WHERE estado NOT IN ('entregado','cancelado')"
    );
    // Ingresos del mes unificados (mismo criterio del #3: sin doble conteo de la cita y su orden).
    const [[{ ingresos_mes }]] = await pool.query(
      `SELECT
         (SELECT COALESCE(SUM(monto),0) FROM citas
            WHERE estado='entregado' AND MONTH(fecha_fin)=MONTH(CURDATE()) AND YEAR(fecha_fin)=YEAR(CURDATE()))
       + (SELECT COALESCE(SUM(costo_mano_obra+costo_repuestos-descuento),0) FROM ordenes_trabajo
            WHERE estado='entregada' AND MONTH(fecha_entrega_real)=MONTH(CURDATE()) AND YEAR(fecha_entrega_real)=YEAR(CURDATE())
              AND id NOT IN (SELECT orden_id FROM citas WHERE orden_id IS NOT NULL)) AS ingresos_mes`
    );
    // Tasa de éxito del mes: entregadas / (entregadas + canceladas).
    const [[exito]] = await pool.query(
      `SELECT COALESCE(SUM(estado='entregado'),0) AS entregadas, COALESCE(SUM(estado='cancelado'),0) AS canceladas
       FROM citas WHERE MONTH(fecha)=MONTH(CURDATE()) AND YEAR(fecha)=YEAR(CURDATE())`
    );
    const cerradas = Number(exito.entregadas) + Number(exito.canceladas);
    const tasa_exito = cerradas ? Math.round((Number(exito.entregadas) / cerradas) * 100) : 0;

    const [top_servicios] = await pool.query(
      `SELECT COALESCE(tipo_servicio,'Sin especificar') AS servicio, COUNT(*) AS total
       FROM citas WHERE MONTH(fecha)=MONTH(CURDATE()) AND YEAR(fecha)=YEAR(CURDATE())
       GROUP BY servicio ORDER BY total DESC LIMIT 5`
    );

    const [[estado_citas]] = await pool.query(
      `SELECT
         COALESCE(SUM(estado='agendado'),0) AS agendadas,
         COALESCE(SUM(estado IN ('en_revision','en_mantenimiento','listo')),0) AS en_proceso,
         COALESCE(SUM(estado='entregado'),0) AS completadas,
         COALESCE(SUM(estado='cancelado'),0) AS canceladas,
         COUNT(*) AS total
       FROM citas WHERE MONTH(fecha)=MONTH(CURDATE()) AND YEAR(fecha)=YEAR(CURDATE())`
    );

    const [ingresos_por_servicio] = await pool.query(
      `SELECT COALESCE(tipo_servicio,'Sin especificar') AS servicio,
              COUNT(*) AS citas, COALESCE(SUM(monto),0) AS ingreso, COALESCE(AVG(monto),0) AS promedio
       FROM citas
       WHERE estado='entregado' AND MONTH(fecha_fin)=MONTH(CURDATE()) AND YEAR(fecha_fin)=YEAR(CURDATE())
       GROUP BY servicio ORDER BY ingreso DESC`
    );

    res.json({
      data: { total_citas, ingresos_mes, citas_pendientes, tasa_exito, top_servicios, estado_citas, ingresos_por_servicio },
    });
  } catch (err) {
    fail(res, err);
  }
});

// GET /api/admin/reportes?periodo=mes|mes_pasado|anio&empleado=<tecnico_id>
// Analítica por período: KPIs, serie temporal, ingresos por servicio,
// rendimiento por mecánico y cotizaciones por recepción.
router.get('/reportes', async (req, res) => {
  try {
    const periodos = { mes: 'Este mes', mes_pasado: 'Mes pasado', anio: 'Este año' };
    const periodo = periodos[req.query.periodo] ? req.query.periodo : 'mes';
    const empRaw = Number(req.query.empleado);
    const empleado = Number.isInteger(empRaw) && empRaw > 0 ? empRaw : null;

    // Condición de rango para una columna de fecha, según el período (sin params).
    const rango = (col) => {
      if (periodo === 'mes_pasado')
        return `${col} >= DATE_FORMAT(CURDATE() - INTERVAL 1 MONTH, '%Y-%m-01') AND ${col} < DATE_FORMAT(CURDATE(), '%Y-%m-01')`;
      if (periodo === 'anio') return `YEAR(${col}) = YEAR(CURDATE())`;
      return `MONTH(${col}) = MONTH(CURDATE()) AND YEAR(${col}) = YEAR(CURDATE())`;
    };
    // Filtro opcional por mecánico (aplica a métricas basadas en citas).
    const empCita = empleado ? ' AND c.tecnico_id = ?' : '';
    const pEmp = empleado ? [empleado] : [];

    // KPIs del período.
    const [[k]] = await pool.query(
      `SELECT COUNT(*) AS total_citas,
              COALESCE(SUM(estado='entregado'),0) AS entregadas,
              COALESCE(SUM(estado='cancelado'),0) AS canceladas,
              COALESCE(AVG(NULLIF(calificacion,0)),0) AS calificacion_promedio
       FROM citas c WHERE ${rango('c.fecha')}${empCita}`, pEmp
    );
    const cerradas = Number(k.entregadas) + Number(k.canceladas);
    const tasa_exito = cerradas ? Math.round((Number(k.entregadas) / cerradas) * 100) : 0;

    // Ticket promedio y total cobrado en citas entregadas (por fecha de entrega).
    const [[tk]] = await pool.query(
      `SELECT COALESCE(AVG(NULLIF(monto,0)),0) AS ticket_promedio
       FROM citas c WHERE estado='entregado' AND ${rango('c.fecha_fin')}${empCita}`, pEmp
    );

    // Ingresos unificados del período (mismo criterio del #3, sin doble conteo).
    const [[ing]] = await pool.query(
      `SELECT
         (SELECT COALESCE(SUM(monto),0) FROM citas c
            WHERE estado='entregado' AND ${rango('c.fecha_fin')}${empCita})
       + (SELECT COALESCE(SUM(costo_mano_obra+costo_repuestos-descuento),0) FROM ordenes_trabajo o
            WHERE estado='entregada' AND ${rango('o.fecha_entrega_real')}
              ${empleado ? 'AND o.tecnico_id = ?' : ''}
              AND o.id NOT IN (SELECT orden_id FROM citas WHERE orden_id IS NOT NULL)) AS ingresos`,
      empleado ? [empleado, empleado] : []
    );

    // Serie temporal: citas e ingreso por día (mes) o por mes (año), con huecos en cero.
    const bucket = periodo === 'anio' ? 'MONTH(c.fecha)' : 'DAY(c.fecha)';
    const [serieRows] = await pool.query(
      `SELECT ${bucket} AS b, COUNT(*) AS citas,
              COALESCE(SUM(CASE WHEN estado='entregado' THEN monto ELSE 0 END),0) AS ingreso
       FROM citas c WHERE ${rango('c.fecha')}${empCita}
       GROUP BY b ORDER BY b`, pEmp
    );
    const mapSerie = {};
    serieRows.forEach(r => { mapSerie[Number(r.b)] = r; });
    let serie;
    if (periodo === 'anio') {
      const meses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
      serie = meses.map((m, i) => {
        const r = mapSerie[i + 1];
        return { label: m, citas: r ? Number(r.citas) : 0, ingreso: r ? Number(r.ingreso) : 0 };
      });
    } else {
      const [[{ dias }]] = await pool.query(
        periodo === 'mes_pasado'
          ? 'SELECT DAYOFMONTH(LAST_DAY(CURDATE() - INTERVAL 1 MONTH)) AS dias'
          : 'SELECT DAYOFMONTH(LAST_DAY(CURDATE())) AS dias'
      );
      serie = Array.from({ length: Number(dias) }, (_, i) => {
        const r = mapSerie[i + 1];
        return { label: String(i + 1), citas: r ? Number(r.citas) : 0, ingreso: r ? Number(r.ingreso) : 0 };
      });
    }

    // Ingresos por servicio (citas entregadas en el período).
    const [ingresos_por_servicio] = await pool.query(
      `SELECT COALESCE(tipo_servicio,'Sin especificar') AS servicio,
              COUNT(*) AS citas, COALESCE(SUM(monto),0) AS ingreso, COALESCE(AVG(monto),0) AS promedio
       FROM citas c WHERE estado='entregado' AND ${rango('c.fecha_fin')}${empCita}
       GROUP BY servicio ORDER BY ingreso DESC`, pEmp
    );

    // Rendimiento por mecánico: citas, entregas, ingresos, tiempo y calificación.
    const [rendimiento] = await pool.query(
      `SELECT u.id AS tecnico_id, u.nombre,
              COUNT(*) AS citas,
              COALESCE(SUM(c.estado='entregado'),0) AS entregadas,
              COALESCE(SUM(c.estado='cancelado'),0) AS canceladas,
              COALESCE(SUM(CASE WHEN c.estado='entregado' THEN c.monto ELSE 0 END),0) AS ingresos,
              AVG(CASE WHEN c.estado='entregado' AND c.fecha_inicio IS NOT NULL AND c.fecha_fin IS NOT NULL
                       THEN TIMESTAMPDIFF(MINUTE, c.fecha_inicio, c.fecha_fin) END) AS tiempo_prom_min,
              AVG(NULLIF(c.calificacion,0)) AS calificacion
       FROM citas c JOIN usuarios u ON u.id = c.tecnico_id
       WHERE ${rango('c.fecha')}${empCita}
       GROUP BY u.id, u.nombre
       ORDER BY ingresos DESC, citas DESC`, pEmp
    );

    // Cotizaciones por recepción (órdenes creadas y su aprobación por el cliente).
    const [recepcion] = await pool.query(
      `SELECT u.id, u.nombre,
              COUNT(*) AS ordenes,
              COALESCE(SUM(o.aprobacion_cliente='aprobado'),0) AS aprobadas,
              COALESCE(SUM(o.aprobacion_cliente='rechazado'),0) AS rechazadas
       FROM ordenes_trabajo o JOIN usuarios u ON u.id = o.recepcionista_id
       WHERE ${rango('o.fecha_ingreso')}
       GROUP BY u.id, u.nombre ORDER BY ordenes DESC`
    );

    res.json({
      data: {
        periodo: { clave: periodo, label: periodos[periodo] },
        kpis: {
          total_citas: Number(k.total_citas),
          entregadas: Number(k.entregadas),
          canceladas: Number(k.canceladas),
          tasa_exito,
          ingresos: Number(ing.ingresos),
          ticket_promedio: Math.round(Number(tk.ticket_promedio)),
          calificacion_promedio: Number(Number(k.calificacion_promedio).toFixed(1)),
        },
        serie,
        ingresos_por_servicio,
        rendimiento,
        recepcion,
      },
    });
  } catch (err) {
    fail(res, err);
  }
});

// ───────────────────────────────────────────────────────────
// Asignar tareas a los mecánicos (Fase C)
// ───────────────────────────────────────────────────────────
const PRIORIDADES = ['baja', 'normal', 'alta', 'urgente'];

// GET /api/admin/tareas?empleado= — tareas asignadas por el admin (monitoreo).
router.get('/tareas', async (req, res) => {
  try {
    const empRaw = Number(req.query.empleado);
    const empleado = Number.isInteger(empRaw) && empRaw > 0 ? empRaw : null;
    let sql =
      `SELECT t.id, t.tecnico_id, t.titulo, t.detalle, t.prioridad, t.hecha, t.vence, t.created_at,
              u.nombre AS tecnico_nombre, a.nombre AS asignado_por_nombre
       FROM tareas_mecanico t
       JOIN usuarios u ON u.id = t.tecnico_id
       LEFT JOIN usuarios a ON a.id = t.asignado_por
       WHERE t.asignado_por IS NOT NULL`;
    const params = [];
    if (empleado) { sql += ' AND t.tecnico_id = ?'; params.push(empleado); }
    sql += ` ORDER BY t.hecha ASC, FIELD(t.prioridad,'urgente','alta','normal','baja'),
             (t.vence IS NULL), t.vence ASC, t.created_at DESC`;
    const [rows] = await pool.query(sql, params);
    res.json({ data: rows });
  } catch (err) {
    fail(res, err);
  }
});

// POST /api/admin/tareas — asignar una tarea a un mecánico.
router.post('/tareas', async (req, res) => {
  try {
    const { tecnico_id, titulo, detalle, prioridad, vence } = req.body;
    if (!tecnico_id) return res.status(400).json({ error: 'Elegí un mecánico' });
    if (!titulo || !titulo.trim()) return res.status(400).json({ error: 'El título es requerido' });
    const [[tec]] = await pool.query(
      "SELECT id FROM usuarios WHERE id = ? AND rol = 'tecnico' AND activo = 1", [tecnico_id]
    );
    if (!tec) return res.status(400).json({ error: 'Mecánico no válido' });
    const prio = PRIORIDADES.includes(prioridad) ? prioridad : 'normal';
    const [r] = await pool.query(
      'INSERT INTO tareas_mecanico (tecnico_id, titulo, detalle, prioridad, vence, asignado_por) VALUES (?, ?, ?, ?, ?, ?)',
      [tecnico_id, titulo.trim(), (detalle || '').trim() || null, prio, vence || null, req.usuario.id]
    );
    const [[nueva]] = await pool.query('SELECT * FROM tareas_mecanico WHERE id = ?', [r.insertId]);
    res.status(201).json({ data: nueva, message: 'Tarea asignada' });
  } catch (err) {
    fail(res, err);
  }
});

// DELETE /api/admin/tareas/:id — cancelar una tarea asignada (solo asignadas, no las propias del técnico).
router.delete('/tareas/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM tareas_mecanico WHERE id = ? AND asignado_por IS NOT NULL', [req.params.id]);
    res.json({ message: 'Tarea eliminada' });
  } catch (err) {
    fail(res, err);
  }
});

module.exports = router;
