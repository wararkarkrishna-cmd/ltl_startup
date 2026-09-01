import { NextRequest, NextResponse } from 'next/server';
import { dbClient } from '@/db/client';
import { FactoringNoaEngine } from '@/lib/quickpay/factoring-noa-engine';

export async function GET(req: NextRequest) {
  try {
    const tenantId = req.nextUrl.searchParams.get('tenantId') || '01916362-7901-7080-867c-9b8895092a01';
    const carrierScac = req.nextUrl.searchParams.get('carrierScac');
    const shipmentId = req.nextUrl.searchParams.get('shipmentId') || '01916362-7901-7080-867c-9b8895092s01';

    if (carrierScac) {
      const evaluation = await FactoringNoaEngine.evaluateCarrierFactoringStatus(
        tenantId,
        carrierScac,
        shipmentId
      );
      return NextResponse.json({
        success: true,
        evaluation,
      });
    }

    dbClient.setTenantContext(tenantId);
    const noaRecords = await dbClient.getCarrierNoaRecords(tenantId);
    const factoringCompanies = await dbClient.getFactoringCompanies(tenantId);

    return NextResponse.json({
      success: true,
      noaRecords,
      factoringCompanies,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to retrieve factoring records' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const tenantId = body.tenantId || '01916362-7901-7080-867c-9b8895092a01';
    dbClient.setTenantContext(tenantId);

    const record = await dbClient.insertCarrierNoaRecord({
      tenantId,
      carrierScac: body.carrierScac,
      carrierName: body.carrierName,
      dotNumber: body.dotNumber,
      mcNumber: body.mcNumber,
      taxIdEin: body.taxIdEin,
      factoringCompanyId: body.factoringCompanyId,
      noaStatus: body.noaStatus || 'ACTIVE',
      effectiveDate: new Date(body.effectiveDate || Date.now()),
      terminationDate: body.terminationDate ? new Date(body.terminationDate) : null,
      noaDocumentUrl: body.noaDocumentUrl || null,
    });

    return NextResponse.json({
      success: true,
      noaRecord: record,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to save NOA record' },
      { status: 400 }
    );
  }
}
