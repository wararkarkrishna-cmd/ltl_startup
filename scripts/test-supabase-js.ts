import { supabaseAdmin } from '../src/lib/supabase/admin';

async function testSupabaseJs() {
  console.log('Testing Supabase JS Client...');
  const { data, error } = await supabaseAdmin.from('accessorial_lookups').select('*').limit(5);

  if (error) {
    console.error('❌ Supabase JS query error:', error.message);
    process.exit(1);
  }

  console.log('✅ Supabase JS query succeeded!');
  console.log('Retrieved accessorials from Supabase:', data?.map((d) => d.code));
}

testSupabaseJs();
