import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const statusFilter = searchParams.get('status');
    const tenantId = searchParams.get('tenantId') || '01916362-7901-7080-867c-9b8895092a01';

    let query = supabaseAdmin
      .from('trucks')
      .select('*, account:accounts(id, name, mc_number)')
      .order('created_at', { ascending: false });

    if (tenantId) {
      query = query.eq('tenant_id', tenantId);
    }

    if (statusFilter && statusFilter !== 'ALL') {
      query = query.eq('status', statusFilter);
    }

    const { data: trucks, error } = await query;

    if (error) {
      console.error('[API /fleet/trucks GET] Error fetching trucks:', error);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      trucks: trucks || [],
      count: trucks?.length || 0,
    });
  } catch (err: any) {
    console.error('[API /fleet/trucks GET] Unexpected error:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const tenantId = body.tenantId || '01916362-7901-7080-867c-9b8895092a01';

    if (!body.unit_number || !body.equipment_type) {
      return NextResponse.json(
        { success: false, error: 'Unit number and equipment type are required.' },
        { status: 400 }
      );
    }

    const newTruck = {
      tenant_id: tenantId,
      carrier_account_id: body.carrier_account_id || null,
      unit_number: String(body.unit_number).toUpperCase().trim(),
      equipment_type: body.equipment_type,
      max_weight_lbs: parseInt(body.max_weight_lbs || '45000', 10),
      max_pallets: parseInt(body.max_pallets || '26', 10),
      has_liftgate: Boolean(body.has_liftgate),
      status: body.status || 'AVAILABLE',
      current_location_zip: body.current_location_zip || '60601',
      current_city: body.current_city || 'Chicago',
      current_state: body.current_state || 'IL',
      assigned_driver_name: body.assigned_driver_name || null,
      assigned_driver_phone: body.assigned_driver_phone || null,
    };

    const { data, error } = await supabaseAdmin
      .from('trucks')
      .insert([newTruck])
      .select('*, account:accounts(id, name, mc_number)')
      .single();

    if (error) {
      console.error('[API /fleet/trucks POST] Database error:', error);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      truck: data,
      message: `Truck unit ${data.unit_number} added successfully.`,
    });
  } catch (err: any) {
    console.error('[API /fleet/trucks POST] Unexpected error:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
