import { pgPool } from '../src/lib/supabase/db-pool';

async function main() {
  const accCols = await pgPool.query(
    "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'accounts'"
  );
  console.log('Accounts Columns:', accCols.rows.map((r) => r.column_name));

  const tenantRes = await pgPool.query("SELECT id, name FROM tenants LIMIT 5");
  console.log('Tenants:', tenantRes.rows);

  await pgPool.end();
}

main();
