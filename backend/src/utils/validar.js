// Validaciones compartidas del backend.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Verifica que el string tenga forma de correo válido.
const emailValido = (e) => EMAIL_RE.test(String(e || '').trim());

module.exports = { emailValido };
