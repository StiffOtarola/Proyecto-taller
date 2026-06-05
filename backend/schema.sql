-- =============================================
-- TallerMS — Schema completo de base de datos
-- Para Railway: este script no incluye CREATE DATABASE ni USE
-- Para local: conectar a la DB proyecto_taller antes de ejecutar
-- =============================================

DROP TABLE IF EXISTS promos;
DROP TABLE IF EXISTS garantia_fotos;
DROP TABLE IF EXISTS garantias;
DROP TABLE IF EXISTS orden_checklist;
DROP TABLE IF EXISTS orden_tiempos;
DROP TABLE IF EXISTS orden_fotos;
DROP TABLE IF EXISTS orden_avances;
DROP TABLE IF EXISTS orden_repuestos;
DROP TABLE IF EXISTS ordenes_trabajo;
DROP TABLE IF EXISTS citas;
DROP TABLE IF EXISTS motos;
DROP TABLE IF EXISTS clientes;
DROP TABLE IF EXISTS usuarios;
DROP TABLE IF EXISTS items;

CREATE TABLE IF NOT EXISTS usuarios (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  nombre        VARCHAR(100) NOT NULL,
  email         VARCHAR(100) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  rol           ENUM('recepcion','tecnico','jefe_taller','admin','gerencia') NOT NULL DEFAULT 'tecnico',
  activo        TINYINT(1) DEFAULT 1,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS clientes (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  nombre        VARCHAR(100) NOT NULL,
  apellido      VARCHAR(100) NOT NULL,
  telefono      VARCHAR(20) NOT NULL,
  email         VARCHAR(100),
  cedula        VARCHAR(20),
  direccion     TEXT,
  password_hash VARCHAR(255) NULL,  -- acceso opcional al portal del cliente
  visitas       INT DEFAULT 0,            -- fidelización: entregas acumuladas
  cortesia_disponible TINYINT(1) DEFAULT 0, -- fidelización: cortesía ganada
  activo        TINYINT(1) DEFAULT 1,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Códigos de recuperación de contraseña del portal (olvidé mi contraseña).
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
);

CREATE TABLE IF NOT EXISTS motos (
  id                 INT AUTO_INCREMENT PRIMARY KEY,
  cliente_id         INT NOT NULL,
  marca              VARCHAR(50) NOT NULL,
  modelo             VARCHAR(100) NOT NULL,
  anio               YEAR,
  placa              VARCHAR(20),
  color              VARCHAR(50),
  numero_motor       VARCHAR(50),
  numero_chasis      VARCHAR(50),
  kilometraje_actual INT DEFAULT 0,
  foto_url           VARCHAR(500),
  activa             TINYINT(1) DEFAULT 1,
  created_at         TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at         TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (cliente_id) REFERENCES clientes(id)
);

CREATE TABLE IF NOT EXISTS citas (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  cliente_id INT NOT NULL,
  moto_id    INT,
  usuario_id INT,
  fecha      DATE NOT NULL,
  hora       TIME NOT NULL,
  motivo     TEXT NOT NULL,
  estado     ENUM('pendiente','confirmada','cancelada','completada') DEFAULT 'pendiente',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (cliente_id) REFERENCES clientes(id),
  FOREIGN KEY (moto_id)    REFERENCES motos(id),
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
);

CREATE TABLE IF NOT EXISTS ordenes_trabajo (
  id                    INT AUTO_INCREMENT PRIMARY KEY,
  numero_orden          VARCHAR(20) UNIQUE NOT NULL,
  moto_id               INT NOT NULL,
  cliente_id            INT NOT NULL,
  recepcionista_id      INT,
  tecnico_id            INT,
  estado                ENUM('recepcion','diagnostico','esperando_aprobacion','esperando_repuestos','en_reparacion','lista_entrega','entregada','cancelada') NOT NULL DEFAULT 'recepcion',
  problema_reportado    TEXT NOT NULL,
  kilometraje_ingreso   INT,
  nivel_combustible     ENUM('vacio','cuarto','mitad','tres_cuartos','lleno') DEFAULT 'cuarto',
  accesorios_entregados TEXT,
  estado_fisico         TEXT,
  prioridad             ENUM('normal','urgente','emergencia','garantia') DEFAULT 'normal',
  categoria             ENUM('rapido','garantia','emergencia','diagnostico','preventivo','mayor') DEFAULT 'diagnostico',
  diagnostico           TEXT,
  tiempo_estimado_horas DECIMAL(5,2),
  costo_mano_obra       DECIMAL(10,2) DEFAULT 0,
  costo_repuestos       DECIMAL(10,2) DEFAULT 0,
  descuento             DECIMAL(10,2) DEFAULT 0,
  aprobado_por_cliente  TINYINT(1) DEFAULT 0,
  aprobacion_cliente    ENUM('pendiente','aprobado','rechazado') NOT NULL DEFAULT 'pendiente',
  motivo_rechazo        TEXT,
  fecha_aprobacion      TIMESTAMP NULL,
  fecha_ingreso         TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  fecha_estimada_entrega DATE,
  fecha_entrega_real    TIMESTAMP NULL,
  metodo_pago           ENUM('efectivo','sinpe','tarjeta','transferencia') NULL,
  garantia_dias         INT DEFAULT 0,
  observaciones_finales TEXT,
  calificacion          TINYINT NULL,
  comentario_satisfaccion TEXT,
  visita_contada        TINYINT(1) DEFAULT 0,
  created_at            TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at            TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (moto_id)          REFERENCES motos(id),
  FOREIGN KEY (cliente_id)       REFERENCES clientes(id),
  FOREIGN KEY (recepcionista_id) REFERENCES usuarios(id),
  FOREIGN KEY (tecnico_id)       REFERENCES usuarios(id)
);

CREATE TABLE IF NOT EXISTS orden_repuestos (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  orden_id       INT NOT NULL,
  nombre         VARCHAR(200) NOT NULL,
  cantidad       INT NOT NULL DEFAULT 1,
  costo_unitario DECIMAL(10,2) DEFAULT 0,
  estado         ENUM('disponible','pendiente','pedido_especial') DEFAULT 'pendiente',
  created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (orden_id) REFERENCES ordenes_trabajo(id)
);

CREATE TABLE IF NOT EXISTS orden_avances (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  orden_id    INT NOT NULL,
  usuario_id  INT NOT NULL,
  descripcion TEXT NOT NULL,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (orden_id)   REFERENCES ordenes_trabajo(id),
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
);

CREATE TABLE IF NOT EXISTS orden_fotos (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  orden_id    INT NOT NULL,
  url         MEDIUMTEXT NOT NULL,
  tipo        ENUM('ingreso','diagnostico','avance','entrega') DEFAULT 'ingreso',
  descripcion VARCHAR(200),
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (orden_id) REFERENCES ordenes_trabajo(id)
);

CREATE TABLE IF NOT EXISTS orden_tiempos (
  id       INT AUTO_INCREMENT PRIMARY KEY,
  orden_id INT NOT NULL,
  etapa    ENUM('recepcion','diagnostico','esperando_aprobacion','esperando_repuestos','en_reparacion','lista_entrega') NOT NULL,
  inicio   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  fin      TIMESTAMP NULL,
  FOREIGN KEY (orden_id) REFERENCES ordenes_trabajo(id)
);

CREATE TABLE IF NOT EXISTS orden_checklist (
  id                 INT AUTO_INCREMENT PRIMARY KEY,
  orden_id           INT UNIQUE NOT NULL,
  prueba_realizada   TINYINT(1) DEFAULT 0,
  lavado             TINYINT(1) DEFAULT 0,
  calidad_revisada   TINYINT(1) DEFAULT 0,
  facturacion_lista  TINYINT(1) DEFAULT 0,
  cliente_notificado TINYINT(1) DEFAULT 0,
  observaciones      TEXT,
  created_at         TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at         TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (orden_id) REFERENCES ordenes_trabajo(id)
);

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
);

CREATE TABLE IF NOT EXISTS garantia_fotos (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  garantia_id INT NOT NULL,
  url         MEDIUMTEXT NOT NULL,
  descripcion VARCHAR(200),
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (garantia_id) REFERENCES garantias(id)
);

CREATE TABLE IF NOT EXISTS promos (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  titulo      VARCHAR(150) NOT NULL,
  descripcion TEXT NOT NULL,
  descuento   INT DEFAULT 0,
  activa      TINYINT(1) DEFAULT 1,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
