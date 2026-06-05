const { test } = require('node:test');
const assert = require('node:assert');

// Modo degradado: sin RESEND_API_KEY no debe llamar a la red ni lanzar,
// solo loguear el código y devolver true (para que el flujo siga en desarrollo).
test('enviarCodigoReset sin API key devuelve true y no usa fetch', async () => {
  const prevKey = process.env.RESEND_API_KEY;
  delete process.env.RESEND_API_KEY;

  const fetchOriginal = global.fetch;
  let fetchLlamado = false;
  global.fetch = async () => { fetchLlamado = true; return { ok: true }; };

  const origLog = console.log;
  console.log = () => {};

  try {
    const { enviarCodigoReset } = require('../src/services/mailer');
    const ok = await enviarCodigoReset('user@correo.com', 'Ana', '123456');
    assert.equal(ok, true);
    assert.equal(fetchLlamado, false, 'no debe contactar a Resend sin API key');
  } finally {
    global.fetch = fetchOriginal;
    console.log = origLog;
    if (prevKey !== undefined) process.env.RESEND_API_KEY = prevKey;
  }
});
