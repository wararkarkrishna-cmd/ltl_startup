import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

export async function GET(req: NextRequest) {
  try {
    const tenantId = '01916362-7901-7080-867c-9b8895092a01';

    // 1. Active loads count (not delivered or settled)
    const { count: activeLoadsCount } = await supabaseAdmin
      .from('shipments')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .not('status', 'in', '("DELIVERED","SETTLED")');

    // 2. Total shipments count
    const { count: totalShipmentsCount } = await supabaseAdmin
      .from('shipments')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenantId);

    // 3. Connected carriers count
    const { count: connectedCarriersCount } = await supabaseAdmin
      .from('carrier_credentials')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenantId);

    // 4. Available fleet trucks count
    const { count: availableTrucksCount } = await supabaseAdmin
      .from('trucks')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('status', 'AVAILABLE');

    // 5. Total trucks count
    const { count: totalTrucksCount } = await supabaseAdmin
      .from('trucks')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenantId);

    // 6. Invoiced revenue from customer_invoices or active shipments
    const { data: invoices } = await supabaseAdmin
      .from('customer_invoices')
      .select('total_amount_cents')
      .eq('tenant_id', tenantId);

    let totalInvoicedCents = 0;
    if (invoices && invoices.length > 0) {
      totalInvoicedCents = invoices.reduce((acc, inv) => acc + (inv.total_amount_cents || 0), 0);
    }

    // 7. Recent 5 shipments
    const { data: recentShipments } = await supabaseAdmin
      .from('shipments')
      .select('id, origin_city, origin_state, destination_city, destination_state, status, total_quote_amount_cents, created_at')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(5);

    // 8. Recent 5 carrier credentials
    const { data: carrierIntegrations } = await supabaseAdmin
      .from('carrier_credentials')
      .select('id, carrier_code, account_number, environment, created_at')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(5);

    return NextResponse.json({
      success: true,
      metrics: {
        activeLoads: activeLoadsCount || 0,
        totalShipments: totalShipmentsCount || 0,
        connectedCarriers: connectedCarriersCount || 0,
        availableTrucks: availableTrucksCount || 0,
        totalTrucks: totalTrucksCount || 0,
        totalInvoicedCents: totalInvoicedCents || 0,
        totalInvoicedFormatted: `$${(totalInvoicedCents / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
      },
      recentShipments: recentShipments || [],
      carrierIntegrations: carrierIntegrations || [],
    });
  } catch (err: any) {
    console.error('[API /dashboard/metrics GET] Error:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
