// Respuesta de error centralizada: loguea el detalle real en el servidor
// y devuelve un mensaje genérico al cliente (no filtra mensajes internos/SQL).
function fail(res, err, status = 500) {
  console.error('Error:', err?.message || err);
  res.status(status).json({ error: 'Error interno del servidor' });
}

module.exports = { fail };
