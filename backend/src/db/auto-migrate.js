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

    // Códigos de recuperación de contraseña (olvidé mi contraseña) enviados por correo.
    await pool.query(`
      CREATE TABLE IF NOT EXISTS password_reset_codes (
        id         INT AUTO_INCREMENT PRIMARY KEY,
        cliente_id INT NOT NULL,
        code_hash  VARCHAR(255) NOT NULL,
        expires_at DATETIME NOT NULL,
        used       TINYINT(1) DEFAULT 0,
        attempts   INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_cliente (cliente_id),
        FOREIGN KEY (cliente_id) REFERENCES clientes(id)
      )
    `);

    // Aprobación digital del presupuesto por parte del cliente.
    await addColumnIfMissing(
      'ordenes_trabajo', 'aprobacion_cliente',
      "ENUM('pendiente','aprobado','rechazado') NOT NULL DEFAULT 'pendiente'"
    );
    await addColumnIfMissing('ordenes_trabajo', 'motivo_rechazo', 'TEXT NULL');

    // Encuesta de satisfacción del cliente al entregar.
    await addColumnIfMissing('ordenes_trabajo', 'calificacion', 'TINYINT NULL');
    await addColumnIfMissing('ordenes_trabajo', 'comentario_satisfaccion', 'TEXT NULL');

    // Contador atómico por año para numero_orden (evita la condición de carrera de COUNT(*)).
    await pool.query(`
      CREATE TABLE IF NOT EXISTS orden_contadores (
        anio   INT PRIMARY KEY,
        ultimo INT NOT NULL DEFAULT 0
      )
    `);
    // Siembra el contador con el último correlativo ya usado por año (idempotente).
    await pool.query(`
      INSERT IGNORE INTO orden_contadores (anio, ultimo)
      SELECT YEAR(created_at), COUNT(*) FROM ordenes_trabajo GROUP BY YEAR(created_at)
    `);

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

    // Panel del mecánico: la cita es la unidad de trabajo del técnico.
    await addColumnIfMissing('citas', 'tecnico_id', 'INT NULL');
    await addColumnIfMissing('citas', 'tipo_servicio', 'VARCHAR(100) NULL');
    await addColumnIfMissing('citas', 'monto', 'DECIMAL(10,2) DEFAULT 0');
    await addColumnIfMissing('citas', 'calificacion', 'TINYINT NULL');
    await addColumnIfMissing('citas', 'comentario_satisfaccion', 'TEXT NULL');
    await addColumnIfMissing('citas', 'fecha_inicio', 'TIMESTAMP NULL');
    await addColumnIfMissing('citas', 'fecha_fin', 'TIMESTAMP NULL');

    // Nuevos estados de la cita (flujo que ve el cliente en el portal).
    // Idempotente: solo migra si el enum todavía tiene los estados viejos.
    const [[citaEstado]] = await pool.query(
      `SELECT COLUMN_TYPE FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'citas' AND COLUMN_NAME = 'estado'`
    );
    if (citaEstado && citaEstado.COLUMN_TYPE.includes('pendiente')) {
      await pool.query('ALTER TABLE citas MODIFY COLUMN estado VARCHAR(20)');
      await pool.query(`
        UPDATE citas SET estado = CASE estado
          WHEN 'pendiente'  THEN 'agendado'
          WHEN 'confirmada' THEN 'agendado'
          WHEN 'completada' THEN 'entregado'
          WHEN 'cancelada'  THEN 'cancelado'
          ELSE estado END
      `);
      await pool.query(`
        ALTER TABLE citas MODIFY COLUMN estado
          ENUM('agendado','en_revision','en_mantenimiento','listo','entregado','cancelado')
          NOT NULL DEFAULT 'agendado'
      `);
      console.log('🔧 Migración: citas.estado → nuevo flujo del mecánico');
    }

    // Portal v2: feed de notificaciones de avance para el cliente.
    await pool.query(`
      CREATE TABLE IF NOT EXISTS notificaciones (
        id         INT AUTO_INCREMENT PRIMARY KEY,
        cliente_id INT NOT NULL,
        cita_id    INT,
        titulo     VARCHAR(150) NOT NULL,
        mensaje    VARCHAR(255) NOT NULL,
        leida      TINYINT(1) DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_cliente (cliente_id),
        FOREIGN KEY (cliente_id) REFERENCES clientes(id),
        FOREIGN KEY (cita_id)    REFERENCES citas(id)
      )
    `);

    // Ofertas con imagen (data URL base64).
    await addColumnIfMissing('promos', 'imagen', 'MEDIUMTEXT NULL');

    // Puente cita ↔ orden: una cita puede generar/enlazar una orden de trabajo.
    await addColumnIfMissing('citas', 'orden_id', 'INT NULL');

    // Índice (fecha,hora) en citas: acelera la disponibilidad y permite que el
    // bloqueo de rango (FOR UPDATE) del control de cupo sea preciso.
    await crearIndiceSiFalta('citas', 'idx_citas_fecha_hora', '(fecha, hora)');

    // Placa única a nivel de base (no solo en la app). Columna generada normalizada
    // (sin espacios/guiones, mayúsculas) + índice único. Se guarda cada paso por
    // separado para que, si hay placas duplicadas heredadas, el índice falle sin
    // abortar el resto de la migración (la validación de la app sigue cubriendo).
    await tryStep('motos.placa_norm', () =>
      addColumnIfMissing(
        'motos', 'placa_norm',
        "VARCHAR(32) AS (UPPER(REPLACE(REPLACE(placa,' ',''),'-',''))) STORED"
      )
    );
    await tryStep('uq_motos_placa_norm', () =>
      crearIndiceSiFalta('motos', 'uq_motos_placa_norm', '(placa_norm)', { unico: true })
    );

    // Panel del mecánico v2: perfil profesional (lo edita el propio técnico).
    await addColumnIfMissing('usuarios', 'telefono', 'VARCHAR(20) NULL');
    await addColumnIfMissing('usuarios', 'especialidades', 'VARCHAR(300) NULL');
    await addColumnIfMissing('usuarios', 'horario', 'VARCHAR(200) NULL');

    // Tareas pendientes del mecánico (checklist propio).
    await pool.query(`
      CREATE TABLE IF NOT EXISTS tareas_mecanico (
        id         INT AUTO_INCREMENT PRIMARY KEY,
        tecnico_id INT NOT NULL,
        titulo     VARCHAR(150) NOT NULL,
        detalle    VARCHAR(300),
        prioridad  ENUM('normal','alta') NOT NULL DEFAULT 'normal',
        hecha      TINYINT(1) DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_tarea_tecnico (tecnico_id),
        FOREIGN KEY (tecnico_id) REFERENCES usuarios(id)
      )
    `);

    // Mensajería interna mecánico ↔ recepción.
    // destino_rol agrupa por rol (p. ej. mensaje "a recepción"); destino_id apunta
    // a un usuario puntual (p. ej. la respuesta de recepción a un técnico).
    await pool.query(`
      CREATE TABLE IF NOT EXISTS mensajes_internos (
        id          INT AUTO_INCREMENT PRIMARY KEY,
        remitente_id INT NOT NULL,
        destino_rol VARCHAR(20),
        destino_id  INT,
        mensaje     VARCHAR(500) NOT NULL,
        leido       TINYINT(1) DEFAULT 0,
        created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_msg_remitente (remitente_id),
        INDEX idx_msg_destino (destino_id),
        FOREIGN KEY (remitente_id) REFERENCES usuarios(id),
        FOREIGN KEY (destino_id)   REFERENCES usuarios(id)
      )
    `);
  } catch (err) {
    console.error('⚠️  Auto-migración falló:', err.code || err.message);
  }
}

// Ejecuta un paso aislado: si falla, lo loguea y sigue (no aborta la migración).
async function tryStep(label, fn) {
  try {
    await fn();
  } catch (err) {
    console.error(`⚠️  Migración (${label}) omitida:`, err.code || err.message);
  }
}

// Crea un índice solo si no existe (idempotente). `opts.unico` para índice único.
async function crearIndiceSiFalta(tabla, nombre, columnas, { unico = false } = {}) {
  const [[existe]] = await pool.query(
    `SELECT COUNT(*) AS n FROM information_schema.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ?`,
    [tabla, nombre]
  );
  if (!existe.n) {
    await pool.query(`CREATE ${unico ? 'UNIQUE ' : ''}INDEX ${nombre} ON ${tabla} ${columnas}`);
    console.log(`🔧 Migración: índice ${nombre} en ${tabla} creado`);
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
