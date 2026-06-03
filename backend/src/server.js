require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { testConnection } = require('./db/pool');
const itemsRoutes = require('./routes/items.routes');

const app = express();

// Middlewares
app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
app.use(express.json());

// Healthcheck simple para verificar que el servidor responde
app.get('/api/health', (req, res) => res.json({ ok: true, ts: new Date().toISOString() }));

// Rutas de la API
app.use('/api/items', itemsRoutes);

// Manejador central de errores
app.use((err, req, res, next) => {
  console.error('Error:', err.message);
  res.status(500).json({ error: 'Error interno del servidor' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
  console.log(`🚀 API escuchando en http://localhost:${PORT}`);
  await testConnection();
});
