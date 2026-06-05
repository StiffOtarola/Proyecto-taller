// Cálculo de recompensas de fidelización (única fuente de verdad).
// Cuenta citas entregadas: cada `meta` citas, la siguiente es cortesía.
// Pura y sin estado para poder testearla sin base de datos.
const META_CORTESIA = 7;

function recompensas(completadas, meta = META_CORTESIA) {
  const n = Math.max(0, Number(completadas) || 0);
  const ciclo = n % meta;
  const cortesia_disponible = n > 0 && ciclo === meta - 1;
  const faltan = cortesia_disponible ? 0 : meta - 1 - ciclo;
  return { completadas: n, ciclo, meta, faltan, cortesia_disponible };
}

module.exports = { recompensas, META_CORTESIA };
