// Pool de conexiones a MySQL usando mysql2/promise.
// Un pool reutiliza conexiones en vez de abrir una nueva por cada query.
const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'proyecto_taller',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

// Verifica la conexion al arrancar y avisa con un mensaje claro si falla.
async function testConnection() {
  try {
    const conn = await pool.getConnection();
    await conn.ping();
    conn.release();
    console.log(`✅ MySQL conectado (${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME})`);
  } catch (err) {
    console.error('❌ No se pudo conectar a MySQL:', err.code || err.message);
    console.error('   Revisa que el servidor MySQL este corriendo y que el archivo .env sea correcto.');
  }
}

module.exports = { pool, testConnection };
