import { NextRequest, NextResponse } from 'next/server';
import { CarrierFraudScoringEngine } from '../../../../../lib/quickpay/carrier-fraud-scoring-engine';
import { dbClient } from '../../../../../db/client';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const result = CarrierFraudScoringEngine.evaluateCarrier(body);

    // Save to database
    dbClient.setTenantContext(result.scoreRecord.tenantId);
    await dbClient.insertCarrierFraudScore(result.scoreRecord);

    return NextResponse.json({
      success: true,
      vetting: result,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to evaluate carrier fraud & safety risk',
      },
      { status: 400 }
    );
  }
}
