import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

export async function POST(req: NextRequest) {
  try {
    const tenantId = '00000000-0000-0000-0000-000000000001';

    // 1. Ensure a carrier account exists
    let carrierAccountId: string | null = null;
    const { data: existingCarrier } = await supabaseAdmin
      .from('accounts')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('account_type', 'CARRIER')
      .maybeSingle();

    if (existingCarrier) {
      carrierAccountId = existingCarrier.id;
    } else {
      const { data: newCarrier } = await supabaseAdmin
        .from('accounts')
        .insert([
          {
            tenant_id: tenantId,
            name: 'Apex Dedicated Logistics LLC',
            account_type: 'CARRIER',
            mc_number: 'MC-987654',
            dot_number: 'DOT-3891029',
            billing_email: 'dispatch@apexlogistics.com',
            phone: '(312) 555-0199',
            city: 'Chicago',
            state: 'IL',
            zip: '60601',
          },
        ])
        .select()
        .single();
      if (newCarrier) carrierAccountId = newCarrier.id;
    }

    const sampleTrucks = [
      {
        tenant_id: tenantId,
        carrier_account_id: carrierAccountId,
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
        carrier_account_id: carrierAccountId,
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
        carrier_account_id: carrierAccountId,
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
        carrier_account_id: carrierAccountId,
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
      {
        tenant_id: tenantId,
        carrier_account_id: carrierAccountId,
        unit_number: 'PWR-501',
        equipment_type: 'POWER_ONLY',
        max_weight_lbs: 45000,
        max_pallets: 26,
        has_liftgate: false,
        status: 'AVAILABLE',
        current_location_zip: '44101',
        current_city: 'Cleveland',
        current_state: 'OH',
        assigned_driver_name: 'James Wilson',
        assigned_driver_phone: '(216) 555-0199',
      },
    ];

    const { data: insertedTrucks, error } = await supabaseAdmin
      .from('trucks')
      .insert(sampleTrucks)
      .select();

    if (error) {
      console.error('[API /fleet/seed POST] Error:', error);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      count: insertedTrucks.length,
      trucks: insertedTrucks,
      message: `Successfully seeded ${insertedTrucks.length} realistic fleet units into Supabase PostgreSQL.`,
    });
  } catch (err: any) {
    console.error('[API /fleet/seed POST] Unexpected error:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
