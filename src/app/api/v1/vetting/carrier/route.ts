import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { FmcsaCarrierVettingEngine, VettingRequest } from '../../../../../lib/vetting/fmcsa-vetting-engine';

const VettingSchema = z.object({
  tenantId: z.string().min(1).default('01916362-7901-7080-867c-9b8895092a01'),
  carrierCode: z.string().min(1),
  carrierScac: z.string().min(2).max(10),
  carrierName: z.string().min(1),
  dotNumber: z.string().min(1),
  mcNumber: z.string().min(1),
  autoLiabilityCoverageDollars: z.number().optional(),
  cargoInsuranceCoverageDollars: z.number().optional(),
  safetyRatingOverride: z.enum(['SATISFACTORY', 'CONDITIONAL', 'UNSATISFACTORY', 'NONE']).optional(),
  operatingAuthorityStatusOverride: z.enum(['ACTIVE', 'REVOKED', 'INACTIVE']).optional(),
  driverOosRatePercent: z.number().optional(),
  vehicleOosRatePercent: z.number().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = VettingSchema.parse(body);

    const evaluation = FmcsaCarrierVettingEngine.evaluateCarrier(parsed as VettingRequest);

    return NextResponse.json({
      success: true,
      vetting: evaluation,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  }
}
