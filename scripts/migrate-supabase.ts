import fs from 'fs';
import path from 'path';
import { pgPool } from '../src/lib/supabase/db-pool';

async function runMigrations() {
  console.log('====================================================');
  console.log('🚀 CONNECTING TO SUPABASE POSTGRESQL & RUNNING DDL');
  console.log('====================================================');

  const client = await pgPool.connect();

  try {
    const migrations = [
      '001_initial_schema.sql',
      '002_cdc_audit_triggers.sql',
      '003_phase2_phase3_tables.sql',
    ];

    for (const file of migrations) {
      const filePath = path.join(process.cwd(), 'src', 'db', 'migrations', file);
      if (!fs.existsSync(filePath)) {
        console.warn(`⚠️ Migration file not found: ${filePath}`);
        continue;
      }

      console.log(`\n⏳ Executing migration: ${file}...`);
      let sql = fs.readFileSync(filePath, 'utf-8');
      sql = sql.replace(/^\uFEFF/, '').trim();

      // Execute SQL
      await client.query(sql);
      console.log(`✅ Successfully applied: ${file}`);
    }

    // Seed Master Data
    console.log('\n⏳ Seeding master initial data...');
    const seedSql = `
      -- Seed Default Tenant Organization
      INSERT INTO tenants (id, name, slug, is_active)
      VALUES ('01916362-7901-7080-867c-9b8895092a01', 'Apex Freight Solutions LLC', 'apex-freight', true)
      ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name;

      -- Seed Master Users
      INSERT INTO users (id, tenant_id, email, full_name, role)
      VALUES (
        '01916362-7901-7080-867c-9b8895092a02',
        '01916362-7901-7080-867c-9b8895092a01',
        'admin@apex-freight.com',
        'Chief Logistics Officer',
        'OWNER'
      )
      ON CONFLICT (tenant_id, email) DO NOTHING;

      -- Seed Master Accessorial Dictionary
      INSERT INTO accessorial_lookups (code, name, category, default_fee_cents) VALUES
      ('LIFTGATE_PICKUP', 'Liftgate Pickup Service', 'PICKUP', 7500),
      ('LIFTGATE_DELIVERY', 'Liftgate Delivery Service', 'DELIVERY', 7500),
      ('RESIDENTIAL_PICKUP', 'Residential Origin Pickup', 'PICKUP', 9500),
      ('RESIDENTIAL_DELIVERY', 'Residential Final Delivery', 'DELIVERY', 9500),
      ('INSIDE_PICKUP', 'Inside White Glove Pickup', 'PICKUP', 11000),
      ('INSIDE_DELIVERY', 'Inside White Glove Delivery', 'DELIVERY', 11000),
      ('LIMITED_ACCESS_PICKUP', 'Limited Access Origin (Mine/Govt/Port)', 'PICKUP', 8500),
      ('LIMITED_ACCESS_DELIVERY', 'Limited Access Destination', 'DELIVERY', 8500),
      ('APPOINTMENT_DELIVERY', 'Mandatory Scheduled Delivery Appointment', 'DELIVERY', 4500),
      ('HAZMAT', 'Hazardous Materials Handling (DOT Compliant)', 'ACCESSORIAL', 17500),
      ('OVER_DIMENSION', 'Over-length / Extreme Dimensions (>8ft)', 'ACCESSORIAL', 12500)
      ON CONFLICT (code) DO NOTHING;

      -- Seed Default Global Margin Rule
      INSERT INTO margin_rules (tenant_id, rule_type, markup_percent, min_margin_cents, priority, is_active)
      VALUES (
        '01916362-7901-7080-867c-9b8895092a01',
        'GLOBAL_DEFAULT',
        15.00,
        7500,
        100,
        true
      );
    `;

    await client.query(seedSql);
    console.log('✅ Master seed data successfully inserted!');

    // Query and display all created tables
    console.log('\n⏳ Verifying database tables in Supabase...');
    const res = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `);

    console.log('\n====================================================');
    console.log(`🎉 SUPABASE DATABASE SYNCHRONIZED (${res.rows.length} TABLES LIVE)`);
    console.log('====================================================');
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

runMigrations();
