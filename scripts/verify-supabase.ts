import fs from 'fs';
import path from 'path';
import { pgPool } from '../src/lib/supabase/db-pool';

// Load .env.local if not already loaded in process
const envPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
      const idx = trimmed.indexOf('=');
      const key = trimmed.substring(0, idx).trim();
      const val = trimmed.substring(idx + 1).trim();
      if (!process.env[key]) {
        process.env[key] = val;
      }
    }
  }
}

async function runVerification() {
  console.log('====================================================');
  console.log('🚀 SUPABASE POSTGRESQL TABLE VERIFICATION');
  console.log('====================================================');

  const client = await pgPool.connect();

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
    await pgPool.end();
  }
}

runVerification();

