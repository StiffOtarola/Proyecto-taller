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

    // Portal del cliente: contraseña opcional para acceso al seguimiento.
    await addColumnIfMissing('clientes', 'password_hash', 'VARCHAR(255) NULL');

    // Aprobación digital del presupuesto por parte del cliente.
    await addColumnIfMissing(
      'ordenes_trabajo', 'aprobacion_cliente',
      "ENUM('pendiente','aprobado','rechazado') NOT NULL DEFAULT 'pendiente'"
    );
    await addColumnIfMissing('ordenes_trabajo', 'motivo_rechazo', 'TEXT NULL');

    // Encuesta de satisfacción del cliente al entregar.
    await addColumnIfMissing('ordenes_trabajo', 'calificacion', 'TINYINT NULL');
    await addColumnIfMissing('ordenes_trabajo', 'comentario_satisfaccion', 'TEXT NULL');

    // Promociones (marketing).
    await pool.query(`
      CREATE TABLE IF NOT EXISTS promos (
        id          INT AUTO_INCREMENT PRIMARY KEY,
        titulo      VARCHAR(150) NOT NULL,
        descripcion TEXT NOT NULL,
        descuento   INT DEFAULT 0,
        activa      TINYINT(1) DEFAULT 1,
        created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);

    // Fidelización: visitas del cliente y cortesía disponible cada N entregas.
    await addColumnIfMissing('clientes', 'visitas', 'INT DEFAULT 0');
    await addColumnIfMissing('clientes', 'cortesia_disponible', 'TINYINT(1) DEFAULT 0');
    await addColumnIfMissing('ordenes_trabajo', 'visita_contada', 'TINYINT(1) DEFAULT 0');
  } catch (err) {
    console.error('⚠️  Auto-migración falló:', err.code || err.message);
  }
}

// Agrega una columna solo si no existe (idempotente, no destructivo).
async function addColumnIfMissing(tabla, columna, definicion) {
  const [[existe]] = await pool.query(
    `SELECT COUNT(*) AS n FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [tabla, columna]
  );
  if (!existe.n) {
    await pool.query(`ALTER TABLE ${tabla} ADD COLUMN ${columna} ${definicion}`);
    console.log(`🔧 Migración: ${tabla}.${columna} agregada`);
  }
}

module.exports = { ensureSchema };
