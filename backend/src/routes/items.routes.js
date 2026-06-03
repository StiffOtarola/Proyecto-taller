// CRUD generico de ejemplo sobre la tabla "items".
// Cuando definas el tipo real de app, renombramos "items" a tu entidad
// (productos, clientes, ordenes, etc.) y ajustamos las columnas.
const { Router } = require('express');
const { pool } = require('../db/pool');

const router = Router();

// GET /api/items  -> lista todos
router.get('/', async (req, res, next) => {
  try {
    const [rows] = await pool.query('SELECT * FROM items ORDER BY id DESC');
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// GET /api/items/:id  -> uno por id
router.get('/:id', async (req, res, next) => {
  try {
    const [rows] = await pool.query('SELECT * FROM items WHERE id = ?', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: 'No encontrado' });
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

// POST /api/items  -> crear
router.post('/', async (req, res, next) => {
  try {
    const { nombre, descripcion } = req.body;
    if (!nombre) return res.status(400).json({ error: 'El campo "nombre" es obligatorio' });
    const [result] = await pool.query(
      'INSERT INTO items (nombre, descripcion) VALUES (?, ?)',
      [nombre, descripcion || null]
    );
    res.status(201).json({ id: result.insertId, nombre, descripcion: descripcion || null });
  } catch (err) {
    next(err);
  }
});

// PUT /api/items/:id  -> actualizar
router.put('/:id', async (req, res, next) => {
  try {
    const { nombre, descripcion } = req.body;
    const [result] = await pool.query(
      'UPDATE items SET nombre = ?, descripcion = ? WHERE id = ?',
      [nombre, descripcion || null, req.params.id]
    );
    if (result.affectedRows === 0) return res.status(404).json({ error: 'No encontrado' });
    res.json({ id: Number(req.params.id), nombre, descripcion: descripcion || null });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/items/:id  -> borrar
router.delete('/:id', async (req, res, next) => {
  try {
    const [result] = await pool.query('DELETE FROM items WHERE id = ?', [req.params.id]);
    if (result.affectedRows === 0) return res.status(404).json({ error: 'No encontrado' });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

module.exports = router;
