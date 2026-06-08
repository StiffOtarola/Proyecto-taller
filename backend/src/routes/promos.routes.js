const router = require('express').Router();
const { pool } = require('../db/pool');
const { fail } = require('../utils/responder');
const auth = require('../middleware/auth');
const requireRol = require('../middleware/roles');

router.use(auth);

// GET /api/promos — todas (para gestión del personal)
router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM promos ORDER BY created_at DESC');
    res.json({ data: rows });
  } catch (err) {
    fail(res, err);
  }
});

// Gestión: solo admin
router.post('/', requireRol('admin'), async (req, res) => {
  try {
    const { titulo, descripcion, descuento, activa, imagen, precio_final } = req.body;
    if (!titulo || !descripcion) return res.status(400).json({ error: 'Título y descripción son requeridos' });
    const [result] = await pool.query(
      'INSERT INTO promos (titulo, descripcion, descuento, activa, imagen, precio_final) VALUES (?, ?, ?, ?, ?, ?)',
      [titulo, descripcion, descuento || 0, activa === false ? 0 : 1, imagen || null, precio_final || null]
    );
    const [[nueva]] = await pool.query('SELECT * FROM promos WHERE id = ?', [result.insertId]);
    res.status(201).json({ data: nueva, message: 'Promoción creada' });
  } catch (err) {
    fail(res, err);
  }
});

// Editar oferta (incluye imagen)
router.put('/:id', requireRol('admin'), async (req, res) => {
  try {
    const { titulo, descripcion, descuento, imagen, precio_final } = req.body;
    if (!titulo || !descripcion) return res.status(400).json({ error: 'Título y descripción son requeridos' });
    await pool.query(
      'UPDATE promos SET titulo = ?, descripcion = ?, descuento = ?, imagen = ?, precio_final = ? WHERE id = ?',
      [titulo, descripcion, descuento || 0, imagen || null, precio_final || null, req.params.id]
    );
    const [[promo]] = await pool.query('SELECT * FROM promos WHERE id = ?', [req.params.id]);
    if (!promo) return res.status(404).json({ error: 'Promoción no encontrada' });
    res.json({ data: promo, message: 'Promoción actualizada' });
  } catch (err) {
    fail(res, err);
  }
});

router.patch('/:id/toggle', requireRol('admin'), async (req, res) => {
  try {
    await pool.query('UPDATE promos SET activa = NOT activa WHERE id = ?', [req.params.id]);
    const [[promo]] = await pool.query('SELECT * FROM promos WHERE id = ?', [req.params.id]);
    if (!promo) return res.status(404).json({ error: 'Promoción no encontrada' });
    res.json({ data: promo, message: promo.activa ? 'Promoción activada' : 'Promoción desactivada' });
  } catch (err) {
    fail(res, err);
  }
});

router.delete('/:id', requireRol('admin'), async (req, res) => {
  try {
    await pool.query('DELETE FROM promos WHERE id = ?', [req.params.id]);
    res.json({ message: 'Promoción eliminada' });
  } catch (err) {
    fail(res, err);
  }
});

module.exports = router;
