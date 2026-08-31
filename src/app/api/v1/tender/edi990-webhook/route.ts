import { NextRequest, NextResponse } from 'next/server';
import { CarrierTenderEngine } from '../../../../../lib/tender/carrier-tender-engine';
import { dbClient } from '../../../../../db/client';

export async function POST(req: NextRequest) {
  try {
    const rawText = await req.text();
    if (!rawText) {
      return NextResponse.json({ success: false, error: 'Empty EDI payload' }, { status: 400 });
    }

    const parsed = CarrierTenderEngine.parseEdi990(rawText);

    return NextResponse.json({
      success: true,
      ediType: 'EDI_990_RESPONSE',
      carrierScac: parsed.carrierScac,
      referenceNumber: parsed.referenceNumber,
      actionCode: parsed.actionCode,
      isAccepted: parsed.isAccepted,
      reasonCode: parsed.reasonCode || null,
      processedAt: new Date().toISOString(),
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  }
}
