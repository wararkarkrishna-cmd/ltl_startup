import { NextRequest, NextResponse } from 'next/server';
import { FactoringNoaEngine } from '@/lib/quickpay/factoring-noa-engine';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const tenantId = body.tenantId || '01916362-7901-7080-867c-9b8895092a01';

    const waiver = await FactoringNoaEngine.issueFactoringWaiver({
      tenantId,
      shipmentId: body.shipmentId,
      carrierScac: body.carrierScac,
      factoringCompanyId: body.factoringCompanyId,
      authorizedBy: body.authorizedBy || 'Broker Billing Operations',
      durationDays: body.durationDays,
    });

    return NextResponse.json({
      success: true,
      waiver,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to issue factoring waiver' },
      { status: 400 }
    );
  }
}
