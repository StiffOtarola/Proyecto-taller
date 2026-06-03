require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');
const fs = require('fs');
const path = require('path');

async function run() {
  const config = process.env.MYSQL_URL
    ? { uri: process.env.MYSQL_URL, multipleStatements: true }
    : {
        host: process.env.DB_HOST || 'localhost',
        port: Number(process.env.DB_PORT) || 3306,
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'proyecto_taller',
        multipleStatements: true,
      };

  const conn = await mysql.createConnection(config);
  console.log('✅ Conectado a MySQL');

  const sql = fs.readFileSync(path.join(__dirname, '../../schema.sql'), 'utf8');
  await conn.query(sql);
  console.log('✅ Schema ejecutado');

  const hash = await bcrypt.hash('Admin2024!', 10);
  await conn.query(
    'INSERT IGNORE INTO usuarios (nombre, email, password_hash, rol) VALUES (?, ?, ?, ?)',
    ['Administrador', 'admin@taller.com', hash, 'gerencia']
  );
  console.log('✅ Usuario admin creado (admin@taller.com / Admin2024!)');

  await conn.end();
  console.log('🎉 Migración completa');
}

run().catch(err => {
  console.error('❌ Error en migración:', err.message);
  process.exit(1);
});
