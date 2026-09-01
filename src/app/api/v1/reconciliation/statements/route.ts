import { NextRequest, NextResponse } from 'next/server';
import { dbClient } from '@/db/client';
import { BankReconciliationEngine } from '@/lib/quickpay/bank-reconciliation-engine';

export async function GET(req: NextRequest) {
  try {
    const tenantId = req.nextUrl.searchParams.get('tenantId') || '01916362-7901-7080-867c-9b8895092a01';
    dbClient.setTenantContext(tenantId);

    const statements = await dbClient.getBankStatements(tenantId);

    return NextResponse.json({
      success: true,
      statements,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to list bank statements' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const statement = await BankReconciliationEngine.ingestStatement(body);

    return NextResponse.json({
      success: true,
      statement,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to ingest bank statement' },
      { status: 400 }
    );
  }
}
