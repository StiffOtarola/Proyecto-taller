-- Esquema inicial de la base de datos.
-- Ejecutar en MySQL Workbench o por linea de comandos:
--   mysql -u root -p < schema.sql

CREATE DATABASE IF NOT EXISTS proyecto_taller
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE proyecto_taller;

-- Tabla generica de ejemplo. La renombramos/ampliamos cuando definas la app.
CREATE TABLE IF NOT EXISTS items (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  nombre      VARCHAR(150) NOT NULL,
  descripcion TEXT NULL,
  creado_en   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Datos de ejemplo
INSERT INTO items (nombre, descripcion) VALUES
  ('Primer item', 'Registro de prueba creado por schema.sql'),
  ('Segundo item', 'Puedes borrarlo desde la app');
