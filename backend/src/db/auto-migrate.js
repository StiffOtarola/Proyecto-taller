// Migraciones idempotentes que corren al arrancar el servidor.
// Seguras de ejecutar en cada deploy: solo aplican el cambio si falta.
const { pool } = require('./pool');

async function ensureSchema() {
  try {
    // orden_fotos.url debe ser MEDIUMTEXT para guardar imágenes base64 (data URL).
    // En esquemas viejos era VARCHAR(500) y truncaba las fotos.
    const [[col]] = await pool.query(
      `SELECT DATA_TYPE FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'orden_fotos' AND COLUMN_NAME = 'url'`
    );
    if (col && col.DATA_TYPE.toLowerCase() !== 'mediumtext') {
      await pool.query('ALTER TABLE orden_fotos MODIFY COLUMN url MEDIUMTEXT NOT NULL');
      console.log('🔧 Migración: orden_fotos.url → MEDIUMTEXT');
    }
  } catch (err) {
    console.error('⚠️  Auto-migración falló:', err.code || err.message);
  }
}

module.exports = { ensureSchema };
