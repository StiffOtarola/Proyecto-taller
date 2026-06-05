// Normaliza una placa igual que el índice de la base:
// mayúsculas y sin espacios ni guiones. Para comparar/buscar de forma consistente.
function normalizarPlaca(placa) {
  return String(placa || '').toUpperCase().replace(/[\s-]/g, '');
}

module.exports = { normalizarPlaca };
