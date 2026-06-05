const { test } = require('node:test');
const assert = require('node:assert');
const { emailValido } = require('../src/utils/validar');

test('acepta correos bien formados', () => {
  assert.equal(emailValido('user@correo.com'), true);
  assert.equal(emailValido('a.b-c+d@sub.dominio.cr'), true);
});

test('recorta espacios alrededor', () => {
  assert.equal(emailValido('  user@correo.com  '), true);
});

test('rechaza correos inválidos', () => {
  for (const malo of ['', 'sin-arroba', 'a@b', 'a@b.', '@b.com', 'a b@c.com', 'a@@b.com']) {
    assert.equal(emailValido(malo), false, `debería rechazar: "${malo}"`);
  }
});

test('rechaza null/undefined sin romper', () => {
  assert.equal(emailValido(null), false);
  assert.equal(emailValido(undefined), false);
});
