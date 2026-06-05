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
const esProduccion = process.env.NODE_ENV === 'production' || hasFrontend;

// JWT_SECRET es obligatorio: sin él, firmar/verificar tokens es inseguro o rompe.
// En producción abortamos con un mensaje claro; en dev usamos un secreto efímero
// con aviso ruidoso para no frenar el trabajo local.
if (!process.env.JWT_SECRET) {
  if (esProduccion) {
    console.error('❌ Falta JWT_SECRET. Definí la variable de entorno antes de arrancar.');
    process.exit(1);
  }
  process.env.JWT_SECRET = 'dev-inseguro-no-usar-en-produccion';
  console.warn('⚠️  JWT_SECRET no definido: usando secreto de desarrollo (NO usar en producción).');
}

// Headers de seguridad básicos (sin dependencias). No tocan el CSP para no romper
// el SPA de Angular/Ionic, que usa estilos/scripts inline.
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-XSS-Protection', '0');
  if (esProduccion) {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  next();
});

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
app.use('/api/garantias', require('./routes/garantias.routes'));
app.use('/api/portal',    require('./routes/portal.routes'));
app.use('/api/promos',    require('./routes/promos.routes'));
app.use('/api/mecanico',  require('./routes/mecanico.routes'));

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
// Corre la auto-migración ANTES de aceptar requests, así no hay una ventana
// donde la base esté a medio migrar mientras el server ya responde.
(async () => {
  await testConnection();
  await ensureSchema();
  app.listen(PORT, () => console.log(`🚀 Servidor en http://localhost:${PORT}`));
})();
