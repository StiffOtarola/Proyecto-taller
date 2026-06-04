require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { testConnection } = require('./db/pool');
const { ensureSchema } = require('./db/auto-migrate');

const app = express();
const frontendDist = path.join(__dirname, '../../frontend/www');
const hasFrontend = fs.existsSync(path.join(frontendDist, 'index.html'));

if (!hasFrontend) {
  app.use(cors({ origin: process.env.CORS_ORIGIN || 'http://localhost:8100' }));
}

app.use(express.json({ limit: '10mb' }));

app.get('/api/health', (req, res) => res.json({ ok: true, ts: new Date().toISOString() }));

app.use('/api/auth',      require('./routes/auth.routes'));
app.use('/api/clientes',  require('./routes/clientes.routes'));
app.use('/api/motos',     require('./routes/motos.routes'));
app.use('/api/ordenes',   require('./routes/ordenes.routes'));
app.use('/api/citas',     require('./routes/citas.routes'));
app.use('/api/usuarios',  require('./routes/usuarios.routes'));
app.use('/api/dashboard', require('./routes/dashboard.routes'));

app.use('/api', (err, req, res, next) => {
  console.error('Error:', err.message);
  res.status(500).json({ error: 'Error interno del servidor' });
});

if (hasFrontend) {
  app.use(express.static(frontendDist));
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
  await ensureSchema();
});
