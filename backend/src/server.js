require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { testConnection } = require('./db/pool');
const itemsRoutes = require('./routes/items.routes');

const app = express();
const frontendDist = path.join(__dirname, '../../frontend/www');
const hasFrontend = fs.existsSync(path.join(frontendDist, 'index.html'));

// CORS solo si no servimos el frontend desde este mismo servidor
if (!hasFrontend) {
  app.use(cors({ origin: process.env.CORS_ORIGIN || 'http://localhost:8100' }));
}

app.use(express.json());

// Healthcheck
app.get('/api/health', (req, res) => res.json({ ok: true, ts: new Date().toISOString() }));

// Rutas de la API
app.use('/api/items', itemsRoutes);

// Manejador de errores de la API
app.use('/api', (err, req, res, next) => {
  console.error('Error:', err.message);
  res.status(500).json({ error: 'Error interno del servidor' });
});

// Sirve el build de Angular si existe (produccion / Railway)
if (hasFrontend) {
  app.use(express.static(frontendDist));
  // Fallback para el router de Angular (Express 5 requiere named wildcard)
  app.get('/{*path}', (req, res) => {
    res.sendFile(path.join(frontendDist, 'index.html'));
  });
  console.log('🌐 Sirviendo frontend desde', frontendDist);
} else {
  console.log('⚡ Modo desarrollo: frontend en http://localhost:8100');
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
  console.log(`🚀 Servidor en http://localhost:${PORT}`);
  await testConnection();
});
