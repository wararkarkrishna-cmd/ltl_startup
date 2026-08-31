import { NextRequest, NextResponse } from 'next/server';
import { dbClient } from '../../../../../db/client';
import { CustomerInvoiceEngine } from '../../../../../lib/billing/customer-invoice-engine';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      tenantId = '01916362-7901-7080-867c-9b8895092a01',
      shipmentId,
      podId,
      customerPoNumber,
      paymentTermsDays,
      manualBrokerRelease,
      customAccessorials,
    } = body;

    dbClient.setTenantContext(tenantId);

    const result = await CustomerInvoiceEngine.generateAndIssueInvoice({
      tenantId,
      shipmentId,
      podId,
      customerPoNumber,
      paymentTermsDays,
      manualBrokerRelease,
      customAccessorials,
    });

    return NextResponse.json({
      success: true,
      invoice: result.invoice,
      emailDispatchStatus: result.emailDispatchStatus,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  }
}
