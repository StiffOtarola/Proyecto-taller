const { test } = require('node:test');
const assert = require('node:assert');
const { recompensas } = require('../src/utils/recompensas');

test('sin citas completadas: faltan 6, sin cortesía', () => {
  const r = recompensas(0);
  assert.equal(r.cortesia_disponible, false);
  assert.equal(r.faltan, 6);
  assert.equal(r.ciclo, 0);
});

test('a la 6ª completada se habilita la cortesía', () => {
  const r = recompensas(6);
  assert.equal(r.cortesia_disponible, true);
  assert.equal(r.faltan, 0);
});

test('la 7ª reinicia el ciclo (cortesía ya canjeada)', () => {
  const r = recompensas(7);
  assert.equal(r.cortesia_disponible, false);
  assert.equal(r.ciclo, 0);
  assert.equal(r.faltan, 6);
});

test('cuenta el ciclo intermedio', () => {
  assert.equal(recompensas(3).faltan, 3);
  assert.equal(recompensas(13).cortesia_disponible, true); // 13 % 7 === 6
});

test('valores inválidos no rompen', () => {
  assert.equal(recompensas(null).completadas, 0);
  assert.equal(recompensas(-5).completadas, 0);
});
