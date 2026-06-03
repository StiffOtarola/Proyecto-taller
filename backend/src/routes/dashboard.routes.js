const router = require('express').Router();
const { pool } = require('../db/pool');
const auth = require('../middleware/auth');
const requireRol = require('../middleware/roles');

router.use(auth, requireRol('jefe_taller'));

router.get('/resumen', async (req, res) => {
  try {
    const [[{ motos_activas }]] = await pool.query(
      "SELECT COUNT(*) AS motos_activas FROM ordenes_trabajo WHERE estado NOT IN ('entregada','cancelada')"
    );
    const [[{ motos_atrasadas }]] = await pool.query(
      "SELECT COUNT(*) AS motos_atrasadas FROM ordenes_trabajo WHERE estado NOT IN ('entregada','cancelada') AND fecha_estimada_entrega < CURDATE()"
    );
    const [[{ facturacion_hoy }]] = await pool.query(
      "SELECT COALESCE(SUM(costo_mano_obra + costo_repuestos - descuento), 0) AS facturacion_hoy FROM ordenes_trabajo WHERE DATE(fecha_entrega_real) = CURDATE() AND estado = 'entregada'"
    );
    const [ordenes_por_estado] = await pool.query(
      "SELECT estado, COUNT(*) AS total FROM ordenes_trabajo WHERE estado NOT IN ('entregada','cancelada') GROUP BY estado"
    );
    res.json({ data: { motos_activas, motos_atrasadas, facturacion_hoy, ordenes_por_estado } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/tecnicos', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT u.id, u.nombre,
              COUNT(ot.id) AS ordenes_completadas,
              ROUND(AVG(TIMESTAMPDIFF(HOUR, ot.fecha_ingreso, ot.fecha_entrega_real)), 1) AS horas_promedio
       FROM usuarios u
       LEFT JOIN ordenes_trabajo ot ON ot.tecnico_id = u.id AND ot.estado = 'entregada'
       WHERE u.rol = 'tecnico' AND u.activo = 1
       GROUP BY u.id, u.nombre
       ORDER BY ordenes_completadas DESC`
    );
    res.json({ data: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/tiempos', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT etapa,
              COUNT(*) AS total,
              ROUND(AVG(TIMESTAMPDIFF(HOUR, inicio, COALESCE(fin, NOW()))), 1) AS horas_promedio
       FROM orden_tiempos
       GROUP BY etapa
       ORDER BY FIELD(etapa,'recepcion','diagnostico','esperando_aprobacion','esperando_repuestos','en_reparacion','lista_entrega')`
    );
    res.json({ data: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
