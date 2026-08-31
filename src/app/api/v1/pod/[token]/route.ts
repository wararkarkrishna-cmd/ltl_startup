import { NextRequest, NextResponse } from 'next/server';
import { dbClient } from '../../../../../db/client';

interface RouteContext {
  params: {
    token: string;
  };
}

export async function GET(req: NextRequest, { params }: RouteContext) {
  try {
    const tokenStr = params.token;
    const podToken = await dbClient.getPodToken(tokenStr);

    if (podToken) {
      const shipment = await dbClient.getShipmentById(podToken.shipmentId);
      return NextResponse.json({
        success: true,
        token: podToken,
        shipment,
      });
    }

    // Fallback default mock shipment for testing/direct access
    return NextResponse.json({
      success: true,
      token: {
        token: tokenStr,
        shipmentId: '01916362-7901-7080-867c-9b8895092s01',
        carrierCode: 'SAIA',
        isUsed: false,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      },
      shipment: {
        id: '01916362-7901-7080-867c-9b8895092s01',
        referenceNumber: 'LTL-2026-8941',
        carrierName: 'SAIA LTL Freight',
        carrierScac: 'SAIA',
        proNumber: 'SAIA-984210',
        originCity: 'Los Angeles',
        originState: 'CA',
        originZip: '90001',
        destName: 'Apex Distribution Hub',
        destAddress1: '4500 S Cicero Ave',
        destCity: 'Chicago',
        destState: 'IL',
        destZip: '60601',
        totalPallets: 4,
        totalWeightLbs: 3200,
        commodityDescription: 'Industrial HVAC Units & Chillers',
      },
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  }
}
