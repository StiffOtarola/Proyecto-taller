// Pool de conexiones a MySQL usando mysql2/promise.
// Soporta la variable MYSQL_URL (Railway) o variables individuales DB_* (local).
const mysql = require('mysql2/promise');
require('dotenv').config();

function buildConfig() {
  // Railway inyecta MYSQL_URL con el formato:
  // mysql://user:password@host:port/database
  if (process.env.MYSQL_URL) {
    return { uri: process.env.MYSQL_URL, waitForConnections: true, connectionLimit: 10 };
  }
  return {
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'proyecto_taller',
    waitForConnections: true,
    connectionLimit: 10,
  };
}

const pool = mysql.createPool(buildConfig());

async function testConnection() {
  try {
    const conn = await pool.getConnection();
    await conn.ping();
    conn.release();
    const db = process.env.MYSQL_URL ? '(via MYSQL_URL)' : `${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`;
    console.log(`✅ MySQL conectado ${db}`);
  } catch (err) {
    console.error('❌ No se pudo conectar a MySQL:', err.code || err.message);
  }
}

module.exports = { pool, testConnection };
