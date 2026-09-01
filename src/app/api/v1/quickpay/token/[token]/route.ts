import { NextRequest, NextResponse } from 'next/server';
import { dbClient } from '@/db/client';
import { QuickPayFeeEngine } from '@/lib/quickpay/quickpay-fee-engine';

export async function GET(
  req: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    const token = params.token;
    const tokenRecord = await dbClient.getQuickPayToken(token);

    if (!tokenRecord) {
      return NextResponse.json(
        { success: false, error: 'QuickPay token not found or invalid' },
        { status: 404 }
      );
    }

    if (tokenRecord.isUsed) {
      return NextResponse.json(
        {
          success: false,
          error: 'This QuickPay payout has already been accepted and processed.',
          isUsed: true,
          usedAt: tokenRecord.usedAt,
        },
        { status: 410 }
      );
    }

    // Calculate live comparison tiers
    const calculation = QuickPayFeeEngine.calculateAllTiers({
      grossAmountCents: tokenRecord.grossAmountCents,
      selectedTier: tokenRecord.defaultTier,
    });

    return NextResponse.json({
      success: true,
      tokenRecord,
      calculation,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to retrieve QuickPay token' },
      { status: 500 }
    );
  }
}
