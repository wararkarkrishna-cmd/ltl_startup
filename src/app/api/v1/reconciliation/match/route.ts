import { NextRequest, NextResponse } from 'next/server';
import { BankReconciliationEngine } from '@/lib/quickpay/bank-reconciliation-engine';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const tenantId = body.tenantId || '01916362-7901-7080-867c-9b8895092a01';
    const statementId = body.statementId;

    if (!statementId) {
      return NextResponse.json(
        { success: false, error: 'statementId is required' },
        { status: 400 }
      );
    }

    const report = await BankReconciliationEngine.reconcileStatement(tenantId, statementId, {
      workingCapitalFacilityLimitCents: body.workingCapitalFacilityLimitCents,
      reconciledBy: body.reconciledBy,
    });

    return NextResponse.json({
      success: true,
      report,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to reconcile bank statement' },
      { status: 500 }
    );
  }
}
