const { test } = require('node:test');
const assert = require('node:assert');
const { normalizarPlaca } = require('../src/utils/placa');

test('quita espacios y guiones y pasa a mayúsculas', () => {
  assert.equal(normalizarPlaca('abc-123'), 'ABC123');
  assert.equal(normalizarPlaca('  mot 456 '), 'MOT456');
  assert.equal(normalizarPlaca('SJB-789'), 'SJB789');
});

test('placas que solo difieren en formato son iguales al normalizar', () => {
  assert.equal(normalizarPlaca('abc 123'), normalizarPlaca('ABC-123'));
});

test('null/undefined devuelven cadena vacía', () => {
  assert.equal(normalizarPlaca(null), '');
  assert.equal(normalizarPlaca(undefined), '');
});
