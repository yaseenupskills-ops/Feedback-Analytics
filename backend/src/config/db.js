const { Pool } = require('pg');
require('dotenv').config();

const connectionString = process.env.DATABASE_URL;

// Supabase and Neon require TLS. Enable SSL when explicitly requested via
// DATABASE_SSL=true. PostgreSQL connection strings may also opt in directly
// with `?sslmode=require`, which node-postgres (pg >= 8.8) honors natively.
const useSSL = (process.env.DATABASE_SSL || '').toLowerCase() === 'true';

const pool = new Pool({
  connectionString,
  ...(useSSL ? { ssl: { rejectUnauthorized: false } } : {}),
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle PostgreSQL client', err);
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool,
};