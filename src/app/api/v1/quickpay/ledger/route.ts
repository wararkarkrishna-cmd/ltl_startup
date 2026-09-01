import { NextRequest, NextResponse } from 'next/server';
import { dbClient } from '../../../../../db/client';
import { DoubleEntryLedgerEngine } from '../../../../../lib/quickpay/double-entry-ledger-engine';

export async function GET(req: NextRequest) {
  try {
    const tenantId = req.nextUrl.searchParams.get('tenantId') || '01916362-7901-7080-867c-9b8895092a01';
    dbClient.setTenantContext(tenantId);

    const trialBalance = await DoubleEntryLedgerEngine.calculateTrialBalance(tenantId);
    const ledgerEntries = await dbClient.getLedgerEntriesByTenant(tenantId);

    return NextResponse.json({
      success: true,
      trialBalance,
      entriesCount: ledgerEntries.length,
      entries: ledgerEntries,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to retrieve financial ledger' },
      { status: 500 }
    );
  }
}
