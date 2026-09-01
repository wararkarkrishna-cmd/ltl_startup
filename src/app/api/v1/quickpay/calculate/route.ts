import { NextRequest, NextResponse } from 'next/server';
import { QuickPayFeeEngine } from '../../../../../lib/quickpay/quickpay-fee-engine';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const result = QuickPayFeeEngine.calculateAllTiers(body);

    return NextResponse.json({
      success: true,
      calculation: result,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to calculate QuickPay fee matrix',
      },
      { status: 400 }
    );
  }
}
