const { test } = require('node:test');
const assert = require('node:assert');
const requireRol = require('../src/middleware/roles');
const { soloRoles } = require('../src/middleware/roles');

function fakeRes() {
  return {
    _status: null, _body: null,
    status(c) { this._status = c; return this; },
    json(b) { this._body = b; return this; },
  };
}
// req con un rol de staff; sin argumento simula un payload sin rol (cliente).
function reqRol(rol) {
  return { usuario: rol ? { rol } : {} };
}

test('requireRol: recepcion pasa el piso recepcion', () => {
  const res = fakeRes(); let llamado = false;
  requireRol('recepcion')(reqRol('recepcion'), res, () => { llamado = true; });
  assert.equal(llamado, true);
});

test('requireRol: recepcion NO pasa el piso admin (403)', () => {
  const res = fakeRes(); let llamado = false;
  requireRol('admin')(reqRol('recepcion'), res, () => { llamado = true; });
  assert.equal(res._status, 403);
  assert.equal(llamado, false);
});

test('requireRol: admin pasa cualquier piso (jerarquía)', () => {
  for (const piso of ['recepcion', 'tecnico', 'admin']) {
    const res = fakeRes(); let llamado = false;
    requireRol(piso)(reqRol('admin'), res, () => { llamado = true; });
    assert.equal(llamado, true, `admin debe pasar el piso ${piso}`);
  }
});

// Defensa en profundidad de #2-#5: un payload sin rol (cliente) no pasa ningún piso.
test('requireRol: payload sin rol es rechazado en cualquier piso', () => {
  for (const piso of ['recepcion', 'tecnico', 'admin']) {
    const res = fakeRes(); let llamado = false;
    requireRol(piso)(reqRol(), res, () => { llamado = true; });
    assert.equal(res._status, 403, `sin rol debe dar 403 en ${piso}`);
    assert.equal(llamado, false);
  }
});

// #6: soloRoles es membresía exacta, no jerarquía → el técnico queda excluido.
test('soloRoles(recepcion,admin): recepcion y admin pasan; tecnico no', () => {
  for (const [rol, ok] of [['recepcion', true], ['admin', true], ['tecnico', false]]) {
    const res = fakeRes(); let llamado = false;
    soloRoles('recepcion', 'admin')(reqRol(rol), res, () => { llamado = true; });
    assert.equal(llamado, ok, `${rol} esperado ${ok}`);
  }
});
