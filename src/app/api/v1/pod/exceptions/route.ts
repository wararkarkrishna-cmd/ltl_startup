import { NextRequest, NextResponse } from 'next/server';
import { dbClient } from '../../../../../db/client';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const tenantId = searchParams.get('tenantId') || '01916362-7901-7080-867c-9b8895092a01';
    const shipmentId = searchParams.get('shipmentId');

    dbClient.setTenantContext(tenantId);

    if (shipmentId) {
      const exceptions = await dbClient.getExceptionsByShipmentId(tenantId, shipmentId);
      return NextResponse.json({ success: true, count: exceptions.length, exceptions });
    }

    const exceptions = await dbClient.getDeliveryExceptions(tenantId);
    return NextResponse.json({ success: true, count: exceptions.length, exceptions });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  }
}
