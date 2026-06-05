const { test } = require('node:test');
const assert = require('node:assert');
const { fail } = require('../src/utils/responder');

// res falso que captura status() y json()
function fakeRes() {
  return {
    _status: null,
    _body: null,
    status(code) { this._status = code; return this; },
    json(body) { this._body = body; return this; },
  };
}

// Silencia el console.error que fail() emite a propósito.
function silenciandoErrores(fn) {
  const orig = console.error;
  console.error = () => {};
  try { fn(); } finally { console.error = orig; }
}

test('responde 500 genérico por defecto y no filtra el mensaje interno', () => {
  silenciandoErrores(() => {
    const res = fakeRes();
    fail(res, new Error('detalle interno con SQL secreto'));
    assert.equal(res._status, 500);
    assert.deepEqual(res._body, { error: 'Error interno del servidor' });
    assert.ok(!JSON.stringify(res._body).includes('SQL secreto'), 'no debe filtrar el detalle');
  });
});

test('acepta un status personalizado', () => {
  silenciandoErrores(() => {
    const res = fakeRes();
    fail(res, new Error('x'), 503);
    assert.equal(res._status, 503);
  });
});
