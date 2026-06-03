require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { testConnection } = require('./db/pool');
const itemsRoutes = require('./routes/items.routes');

const app = express();
const isProd = process.env.NODE_ENV === 'production';

// En dev se necesita CORS porque frontend y backend corren en puertos distintos.
// En produccion Express sirve el frontend directamente, CORS no aplica.
if (!isProd) {
  app.use(cors({ origin: process.env.CORS_ORIGIN || 'http://localhost:8100' }));
}

app.use(express.json());

// Healthcheck
app.get('/api/health', (req, res) => res.json({ ok: true, ts: new Date().toISOString() }));

// Rutas de la API
app.use('/api/items', itemsRoutes);

// Manejador central de errores de la API
app.use('/api', (err, req, res, next) => {
  console.error('Error:', err.message);
  res.status(500).json({ error: 'Error interno del servidor' });
});

// En produccion, sirve el build de Ionic/Angular desde frontend/www
if (isProd) {
  const frontendDist = path.join(__dirname, '../../frontend/www');
  app.use(express.static(frontendDist));
  // Fallback para rutas del router de Angular (Express 5 requiere named wildcard)
  app.get('/{*path}', (req, res) => {
    res.sendFile(path.join(frontendDist, 'index.html'));
  });
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
  console.log(`🚀 Servidor escuchando en http://localhost:${PORT} [${isProd ? 'produccion' : 'desarrollo'}]`);
  await testConnection();
});
