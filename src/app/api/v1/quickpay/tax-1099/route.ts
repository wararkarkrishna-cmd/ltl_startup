import { NextRequest, NextResponse } from 'next/server';
import { dbClient } from '../../../../../db/client';
import { Form1099TaxEngine } from '../../../../../lib/quickpay/tax-1099-engine';

export async function GET(req: NextRequest) {
  try {
    const tenantId = req.nextUrl.searchParams.get('tenantId') || '01916362-7901-7080-867c-9b8895092a01';
    const taxYear = parseInt(req.nextUrl.searchParams.get('taxYear') || new Date().getFullYear().toString(), 10);
    dbClient.setTenantContext(tenantId);

    const summaries = await Form1099TaxEngine.aggregateTaxYearPayouts(tenantId, taxYear);
    const existingRecords = await dbClient.getForm1099Records(tenantId, taxYear);

    return NextResponse.json({
      success: true,
      taxYear,
      carrierCount: summaries.length,
      reportableCount: summaries.filter((s) => s.isThresholdMet).length,
      summaries,
      savedRecords: existingRecords,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to retrieve 1099 tax summaries' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const tenantId = body.tenantId || '01916362-7901-7080-867c-9b8895092a01';
    dbClient.setTenantContext(tenantId);

    const record = await Form1099TaxEngine.generate1099Record(tenantId, body);

    return NextResponse.json({
      success: true,
      record,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to generate 1099 record' },
      { status: 400 }
    );
  }
}
