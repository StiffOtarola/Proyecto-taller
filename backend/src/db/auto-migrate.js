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

    // Tablas del módulo de garantías (idempotente, no borra datos).
    await pool.query(`
      CREATE TABLE IF NOT EXISTS garantias (
        id                   INT AUTO_INCREMENT PRIMARY KEY,
        orden_id             INT NOT NULL,
        descripcion_problema TEXT NOT NULL,
        cubre_repuestos      TINYINT(1) DEFAULT 0,
        cubre_mano_obra      TINYINT(1) DEFAULT 0,
        estado               ENUM('abierto','en_revision','aprobado','rechazado','resuelto') NOT NULL DEFAULT 'abierto',
        resolucion           TEXT,
        creado_por           INT,
        created_at           TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at           TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (orden_id)   REFERENCES ordenes_trabajo(id),
        FOREIGN KEY (creado_por) REFERENCES usuarios(id)
      )
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS garantia_fotos (
        id          INT AUTO_INCREMENT PRIMARY KEY,
        garantia_id INT NOT NULL,
        url         MEDIUMTEXT NOT NULL,
        descripcion VARCHAR(200),
        created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (garantia_id) REFERENCES garantias(id)
      )
    `);
  } catch (err) {
    console.error('⚠️  Auto-migración falló:', err.code || err.message);
  }
}

module.exports = { ensureSchema };
