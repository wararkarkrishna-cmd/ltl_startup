import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { CarrierTenderEngine } from '../../../../../lib/tender/carrier-tender-engine';
import { CARRIER_CODES } from '../../../../../db/schema';
import { dbClient } from '../../../../../db/client';

const TenderSubmitSchema = z.object({
  tenantId: z.string().min(1).default('01916362-7901-7080-867c-9b8895092a01'),
  shipmentId: z.string().min(1),
  quoteId: z.string().min(1),
  carrierCode: z.enum(CARRIER_CODES),
  carrierScac: z.string().min(2).max(10),
  carrierName: z.string().min(1),
  tenderMethod: z.enum(['REST_API', 'EDI_204', 'EMAIL']).default('REST_API'),
  pickupDate: z.string().default(() => new Date().toISOString().split('T')[0]),
  specialInstructions: z.string().optional().default(''),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = TenderSubmitSchema.parse(body);

    const result = await CarrierTenderEngine.submitTender({
      tenantId: parsed.tenantId,
      shipmentId: parsed.shipmentId,
      quoteId: parsed.quoteId,
      carrierCode: parsed.carrierCode,
      carrierScac: parsed.carrierScac,
      carrierName: parsed.carrierName,
      tenderMethod: parsed.tenderMethod,
      pickupDate: parsed.pickupDate,
      specialInstructions: parsed.specialInstructions,
    });

    return NextResponse.json({
      success: true,
      tender: result,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Tender submission failed' },
      { status: 400 }
    );
  }
}
