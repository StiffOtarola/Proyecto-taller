// Limitadores de tasa por IP. Protegen el pool de conexiones y la CPU del proceso
// (sobre todo bcrypt en login) ante abuso o picos. Store en memoria: suficiente
// para una sola instancia; al escalar a varias, mover el store a Redis (ver SCALING.md).
const rateLimit = require('express-rate-limit');

// General: toda la API. Generoso para no afectar el uso normal del SPA, pero
// frena un cliente que dispare miles de requests y sature la base.
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,        // 1 minuto
  max: 600,                   // 600 req/min por IP (~10/seg)
  standardHeaders: true,      // expone RateLimit-* headers
  legacyHeaders: false,
  message: { error: 'Demasiadas solicitudes. Esperá un momento e intentá de nuevo.' },
});

// Autenticación: login/registro/recuperar. Estricto porque son el blanco de
// fuerza bruta y cada intento corre bcrypt (caro en CPU).
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,   // 15 minutos
  max: 30,                    // 30 intentos por IP en la ventana
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiados intentos. Esperá unos minutos e intentá de nuevo.' },
});

module.exports = { apiLimiter, authLimiter };
