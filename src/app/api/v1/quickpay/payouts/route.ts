import { NextRequest, NextResponse } from 'next/server';
import { dbClient } from '../../../../../db/client';

export async function GET(req: NextRequest) {
  try {
    const tenantId = req.nextUrl.searchParams.get('tenantId') || '01916362-7901-7080-867c-9b8895092a01';
    dbClient.setTenantContext(tenantId);

    const payouts = await dbClient.getCarrierPayouts(tenantId);
    const totalGmvCents = payouts.reduce((sum, p) => sum + p.grossAmountCents, 0);
    const totalRevenueCents = payouts.reduce((sum, p) => sum + p.feeAmountCents, 0);
    const totalDisbursedCents = payouts.reduce((sum, p) => sum + p.netPayoutCents, 0);

    return NextResponse.json({
      success: true,
      metrics: {
        totalPayoutCount: payouts.length,
        totalGmvCents,
        totalRevenueCents,
        totalDisbursedCents,
        activeProcessingCount: payouts.filter((p) => p.status === 'PROCESSING').length,
        settledCount: payouts.filter((p) => p.status === 'SETTLED').length,
      },
      payouts,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to list payouts' },
      { status: 500 }
    );
  }
}
