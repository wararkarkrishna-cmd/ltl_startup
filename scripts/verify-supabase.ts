import fs from 'fs';
import path from 'path';
import { Pool } from 'pg';

const pool = new Pool({
  host: 'db.byjhclavuwlomujwuoku.supabase.co',
  port: 5432,
  user: 'postgres',
  password: '?Mxtx_3?p?/C/vK',
  database: 'postgres',
  ssl: {
    rejectUnauthorized: false,
  },
  connectionTimeoutMillis: 10000,
});

pool.on('error', (err) => {
  // Ignore idle client connection resets
});

async function runVerification() {
  console.log('====================================================');
  console.log('🚀 SUPABASE POSTGRESQL TABLE VERIFICATION');
  console.log('====================================================');

  const client = await pool.connect();

  try {
    const res = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `);

    console.log(`\n🎉 SUPABASE DATABASE SYNCHRONIZED (${res.rows.length} TABLES LIVE IN PUBLIC SCHEMA):`);
    res.rows.forEach((r, idx) => {
      console.log(`  ${idx + 1}. ${r.table_name}`);
    });

    const tenantRes = await client.query('SELECT count(*) FROM tenants;');
    const accessorialRes = await client.query('SELECT count(*) FROM accessorial_lookups;');
    const marginRes = await client.query('SELECT count(*) FROM margin_rules;');

    console.log('\n📊 SEEDED RECORDS SUMMARY:');
    console.log(`  • Tenants: ${tenantRes.rows[0].count}`);
    console.log(`  • Master Accessorials: ${accessorialRes.rows[0].count}`);
    console.log(`  • Active Margin Rules: ${marginRes.rows[0].count}`);
    console.log('====================================================\n');
  } catch (err: any) {
    console.error('❌ Verification error:', err.message);
  } finally {
    client.release();
    await pool.end();
  }
}

runVerification();
