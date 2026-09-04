import { supabaseAdmin } from '../src/lib/supabase/admin';

async function seedData() {
  console.log('🌱 Seeding initial real production data into Supabase PostgreSQL...');

  const tenantId = '01916362-7901-7080-867c-9b8895092a01';

  // 1. Carrier Account
  const { data: carrier, error: carrierErr } = await supabaseAdmin
    .from('accounts')
    .insert([
      {
        tenant_id: tenantId,
        name: 'Apex Dedicated Fleet Services LLC',
        account_type: 'CARRIER',
        mc_number: 'MC-882104',
        dot_number: 'DOT-3910291',
        contact_email: 'dispatch@apexfleet.com',
        contact_phone: '(312) 555-0199',
        billing_city: 'Chicago',
        billing_state: 'IL',
        billing_zip: '60601',
      },
    ])
    .select()
    .single();

  if (carrierErr) {
    console.error('Carrier error:', carrierErr.message);
  } else {
    console.log('  ✅ Created Carrier Account:', carrier.name, carrier.id);
  }

  const carrierId = carrier?.id || null;

  // 2. Customer Accounts
  const customers = [
    {
      tenant_id: tenantId,
      name: 'Midwest Industrial Supply Co.',
      account_type: 'SHIPPER',
      contact_email: 'ap@midwestindustrial.com',
      contact_phone: '(312) 555-0122',
      billing_city: 'Chicago',
      billing_state: 'IL',
      billing_zip: '60601',
    },
    {
      tenant_id: tenantId,
      name: 'Pacific Freight Distributors',
      account_type: 'SHIPPER',
      contact_email: 'logistics@pacificfreight.com',
      contact_phone: '(213) 555-0188',
      billing_city: 'Los Angeles',
      billing_state: 'CA',
      billing_zip: '90001',
    },
  ];

  const { data: createdCust, error: custErr } = await supabaseAdmin.from('accounts').insert(customers).select();
  if (custErr) {
    console.error('Customer error:', custErr.message);
  } else {
    console.log(`  ✅ Created ${createdCust?.length || 0} Customer Accounts in Supabase.`);
  }

  // 3. Fleet Trucks
  const trucks = [
    {
      tenant_id: tenantId,
      carrier_account_id: carrierId,
      unit_number: 'TRK-101',
      equipment_type: 'DRY_VAN_53',
      max_weight_lbs: 45000,
      max_pallets: 26,
      has_liftgate: false,
      status: 'AVAILABLE',
      current_location_zip: '60601',
      current_city: 'Chicago',
      current_state: 'IL',
      assigned_driver_name: 'Marcus Vance',
      assigned_driver_phone: '(312) 555-0144',
    },
    {
      tenant_id: tenantId,
      carrier_account_id: carrierId,
      unit_number: 'REF-204',
      equipment_type: 'REEFER_53',
      max_weight_lbs: 43500,
      max_pallets: 26,
      has_liftgate: false,
      status: 'AVAILABLE',
      current_location_zip: '30301',
      current_city: 'Atlanta',
      current_state: 'GA',
      assigned_driver_name: 'Elena Rostova',
      assigned_driver_phone: '(404) 555-0188',
    },
    {
      tenant_id: tenantId,
      carrier_account_id: carrierId,
      unit_number: 'BOX-308',
      equipment_type: 'BOX_TRUCK_26',
      max_weight_lbs: 10000,
      max_pallets: 12,
      has_liftgate: true,
      status: 'AVAILABLE',
      current_location_zip: '90001',
      current_city: 'Los Angeles',
      current_state: 'CA',
      assigned_driver_name: 'David Miller',
      assigned_driver_phone: '(213) 555-0122',
    },
    {
      tenant_id: tenantId,
      carrier_account_id: carrierId,
      unit_number: 'FLT-402',
      equipment_type: 'FLATBED_48',
      max_weight_lbs: 48000,
      max_pallets: 24,
      has_liftgate: false,
      status: 'ASSIGNED',
      current_location_zip: '75001',
      current_city: 'Dallas',
      current_state: 'TX',
      assigned_driver_name: 'Robert Hayes',
      assigned_driver_phone: '(214) 555-0166',
    },
  ];

  const { data: createdTrucks, error: trkErr } = await supabaseAdmin
    .from('trucks')
    .insert(trucks)
    .select();

  if (trkErr) {
    console.error('Truck error:', trkErr.message);
  } else {
    console.log(`  ✅ Created ${createdTrucks?.length || 0} Fleet Trucks in Supabase PostgreSQL.`);
  }

  console.log('🎉 Initial Supabase seeding complete!');
}

seedData();
