import { supabaseAdmin } from '../src/lib/supabase/admin';

async function checkSupabase() {
  console.log('Checking Supabase tables with Supabase Admin JS Client...');
  
  const tables = [
    'tenants',
    'users',
    'accounts',
    'shipments',
    'shipment_items',
    'accessorial_lookups',
    'carrier_credentials',
    'margin_rules',
    'quotes',
    'carrier_tenders',
    'digital_bols',
    'customer_invoices',
    'carrier_invoices',
    'trucks',
    'drivers',
  ];

  for (const table of tables) {
    const { count, error } = await supabaseAdmin.from(table).select('*', { count: 'exact', head: true });
    if (error) {
      console.log(`  ❌ ${table}: ${error.message}`);
    } else {
      console.log(`  ✅ ${table}: ${count} rows`);
    }
  }
}

checkSupabase();
