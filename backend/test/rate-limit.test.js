const { test } = require('node:test');
const assert = require('node:assert');
const { consumir } = require('../src/utils/rate-limit');

// Cada test usa una clave única para no interferir con los demás (el estado es global).
const k = (s) => `${s}:${Math.random()}`;

test('permite el primer intento y bloquea el segundo dentro del minuto', () => {
  const clave = k('min');
  assert.equal(consumir(clave, { porMinuto: 1, porHora: 5 }).ok, true);
  const segundo = consumir(clave, { porMinuto: 1, porHora: 5 });
  assert.equal(segundo.ok, false);
  assert.ok(segundo.retryAfter > 0 && segundo.retryAfter <= 60, 'retryAfter debe estar en (0, 60]');
});

test('respeta el tope por hora aunque no se exceda el de minuto', () => {
  const clave = k('hora');
  for (let i = 0; i < 3; i++) {
    assert.equal(consumir(clave, { porMinuto: 100, porHora: 3 }).ok, true, `intento ${i + 1}`);
  }
  assert.equal(consumir(clave, { porMinuto: 100, porHora: 3 }).ok, false, 'el 4º debe bloquear');
});

test('claves distintas no se afectan entre sí', () => {
  assert.equal(consumir(k('a'), { porMinuto: 1 }).ok, true);
  assert.equal(consumir(k('b'), { porMinuto: 1 }).ok, true);
});

test('usa valores por defecto (1/min, 5/h) sin opciones', () => {
  const clave = k('def');
  assert.equal(consumir(clave).ok, true);
  assert.equal(consumir(clave).ok, false);
});
