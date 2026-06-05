// Rate-limiter en memoria (Map por clave). La app corre en una sola instancia
// en Railway, así que esto es suficiente; se reinicia en cada deploy (aceptable).
// Si en el futuro escalan a varias instancias, mover a tabla/Redis.

const registros = new Map(); // clave -> array de timestamps (ms)

// Limpieza perezosa: descarta timestamps fuera de la ventana más larga.
function limpiar(lista, ahora, ventanaMax) {
  return lista.filter((t) => ahora - t < ventanaMax);
}

/**
 * Comprueba y registra un intento para `clave`.
 * Reglas por defecto: máx 1 cada 60s y máx 5 por hora.
 * Devuelve { ok: true } o { ok: false, retryAfter: <segundos> }.
 */
function consumir(clave, { porMinuto = 1, porHora = 5 } = {}) {
  const ahora = Date.now();
  const MIN = 60 * 1000;
  const HORA = 60 * MIN;

  const lista = limpiar(registros.get(clave) || [], ahora, HORA);

  const enUltimoMinuto = lista.filter((t) => ahora - t < MIN);
  if (enUltimoMinuto.length >= porMinuto) {
    const retryAfter = Math.ceil((MIN - (ahora - enUltimoMinuto[0])) / 1000);
    return { ok: false, retryAfter };
  }
  if (lista.length >= porHora) {
    const retryAfter = Math.ceil((HORA - (ahora - lista[0])) / 1000);
    return { ok: false, retryAfter };
  }

  lista.push(ahora);
  registros.set(clave, lista);
  return { ok: true };
}

module.exports = { consumir };
