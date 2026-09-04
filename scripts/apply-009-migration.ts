import fs from 'fs';
import path from 'path';
import { pgPool } from '../src/lib/supabase/db-pool';

async function applyMigration009() {
  console.log('====================================================');
  console.log('🚀 APPLYING MIGRATION 009: TRUCKS & DRIVERS');
  console.log('====================================================');

  const client = await pgPool.connect();

  try {
    const filePath = path.join(process.cwd(), 'src', 'db', 'migrations', '009_fleet_trucks_drivers.sql');
    if (!fs.existsSync(filePath)) {
      throw new Error(`Migration file not found: ${filePath}`);
    }

    console.log(`\n⏳ Reading and executing: 009_fleet_trucks_drivers.sql...`);
    let sql = fs.readFileSync(filePath, 'utf-8');
    sql = sql.replace(/^\uFEFF/, '').trim();

    await client.query(sql);
    console.log('✅ Migration 009 applied successfully!');

    // Verify tables exist
    const res = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name IN ('trucks', 'drivers')
      ORDER BY table_name;
    `);

    console.log('\n====================================================');
    console.log(`🎉 VERIFIED CREATED TABLES:`);
    res.rows.forEach((r, idx) => {
      console.log(`  ${idx + 1}. ${r.table_name}`);
    });
    console.log('====================================================\n');
  } catch (err: any) {
    console.error('❌ Migration failed with error:', err.message);
    console.error(err);
    process.exit(1);
  } finally {
    client.release();
    await pgPool.end();
  }
}

applyMigration009();
