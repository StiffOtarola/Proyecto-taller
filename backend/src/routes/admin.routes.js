const router = require('express').Router();
const { pool } = require('../db/pool');
const { fail } = require('../utils/responder');
const auth = require('../middleware/auth');
const requireRol = require('../middleware/roles');

// Panel del administrador: métricas ejecutivas. Solo admin/gerencia.
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

module.exports = router;
