import mysql from 'mysql2/promise';
import config from './config.js';

let pool;

/**
 * Membuat connection pool ke MySQL
 */
export function getPool() {
  if (!pool) {
    pool = mysql.createPool(config.db);
  }
  return pool;
}

/**
 * Test koneksi database
 */
export async function testConnection() {
  try {
    const connection = await getPool().getConnection();
    console.log('✅ MySQL connected');
    connection.release();
    return true;
  } catch (error) {
    console.error('❌ MySQL connection failed:', error.message);
    return false;
  }
}

/**
 * Menutup semua koneksi pool (untuk graceful shutdown)
 */
export async function closePool() {
  if (pool) {
    await pool.end();
    console.log('🔌 MySQL pool closed');
  }
}
