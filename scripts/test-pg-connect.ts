import { Pool } from 'pg';

const connectionString = 'postgresql://postgres:%3FMxtx_3%3Fp%3F%2FC%2FvK@db.byjhclavuwlomujwuoku.supabase.co:5432/postgres';

const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 10000,
});

async function run() {
  try {
    const res = await pool.query('SELECT NOW(), version();');
    console.log('✅ Connected to Supabase DB via PG Pool:', res.rows[0]);
  } catch (err) {
    console.error('❌ Connection error:', err);
  } finally {
    await pool.end();
  }
}

run();
