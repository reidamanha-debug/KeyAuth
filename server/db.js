// db.js
// Camada de acesso ao banco (Postgres via node-postgres, apontando pro Supabase).
// O bot do Discord e a API HTTP compartilham o mesmo pool de conexoes.

// Força o Node.js a priorizar IPv4 na resolução DNS
const dns = require('node:dns');
dns.setDefaultResultOrder('ipv4first');

const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }, // exigido pelo Supabase
});

async function init() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS licenses (
      id            SERIAL PRIMARY KEY,
      license_key   TEXT UNIQUE NOT NULL,
      duration_days INTEGER NOT NULL,
      max_devices   INTEGER NOT NULL DEFAULT 1,
      redeemed      INTEGER NOT NULL DEFAULT 0,
      revoked       INTEGER NOT NULL DEFAULT 0,
      note          TEXT,
      created_by    TEXT,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS users (
      id            SERIAL PRIMARY KEY,
      username      TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      license_key   TEXT NOT NULL,
      hwid          TEXT,
      banned        INTEGER NOT NULL DEFAULT 0,
      expires_at    TIMESTAMPTZ NOT NULL,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS devices (
      id        SERIAL PRIMARY KEY,
      user_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      hwid      TEXT NOT NULL,
      added_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE(user_id, hwid)
    );
  `);
}

module.exports = { pool, init };
