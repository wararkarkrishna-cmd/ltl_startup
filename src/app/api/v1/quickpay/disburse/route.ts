import { NextRequest, NextResponse } from 'next/server';
import { dbClient } from '../../../../../db/client';
import { EmbeddedBankingEngine } from '../../../../../lib/quickpay/embedded-banking-engine';
import { DoubleEntryLedgerEngine } from '../../../../../lib/quickpay/double-entry-ledger-engine';
import { QuickPayFeeEngine } from '../../../../../lib/quickpay/quickpay-fee-engine';
import { generateUuidV7 } from '../../../../../lib/uuidv7';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const tenantId = body.tenantId || '01916362-7901-7080-867c-9b8895092a01';
    dbClient.setTenantContext(tenantId);

    const grossAmountCents = body.grossAmountCents || 80000;
    const selectedTier = body.selectedTier || 'INSTANT_SAME_DAY';
    const feeCalc = QuickPayFeeEngine.calculateSingleTier(grossAmountCents, selectedTier, body.customFeePercentOverride);

    const isInstant = selectedTier === 'INSTANT_SAME_DAY';
    const payoutRail = body.payoutRail || (isInstant ? 'INSTANT_RTP' : selectedTier === 'NEXT_DAY_ACH' ? 'SAME_DAY_ACH' : 'STANDARD_ACH');

    const payoutId = generateUuidV7();
    const ledgerTxId = generateUuidV7();

    // 1. Banking Disbursement
    const bankingRes = await EmbeddedBankingEngine.executePayout({
      tenantId,
      shipmentId: body.shipmentId || generateUuidV7(),
      carrierAccountId: body.carrierAccountId || null,
      carrierScac: body.carrierScac || 'SAIA',
      carrierName: body.carrierName || 'SAIA LTL Freight',
      amountCents: feeCalc.netPayoutCents,
      payoutRail,
      provider: body.provider || 'STRIPE_TREASURY',
      destinationRoutingNumber: body.destinationRoutingNumber || '021000021',
      destinationAccountNumber: body.destinationAccountNumber || '1234567890',
      bankName: body.bankName || 'JPMorgan Chase',
    });

    // 2. Double-Entry Ledger Posting
    const ledgerRes = await DoubleEntryLedgerEngine.postQuickPayPayout({
      tenantId,
      transactionId: ledgerTxId,
      shipmentId: body.shipmentId || generateUuidV7(),
      carrierScac: body.carrierScac || 'SAIA',
      carrierName: body.carrierName || 'SAIA LTL Freight',
      grossAmountCents,
      feeAmountCents: feeCalc.feeAmountCents,
      netPayoutCents: feeCalc.netPayoutCents,
    });

    // 3. Save Carrier Payout Record
    const savedPayout = await dbClient.insertCarrierPayout({
      id: payoutId,
      tenantId,
      shipmentId: body.shipmentId || generateUuidV7(),
      carrierAccountId: body.carrierAccountId || null,
      carrierScac: body.carrierScac || 'SAIA',
      carrierName: body.carrierName || 'SAIA LTL Freight',
      carrierEmail: body.carrierEmail || 'billing@carrier.com',
      proNumber: body.proNumber || null,
      bolNumber: body.bolNumber || null,
      selectedTier,
      payoutRail,
      grossAmountCents,
      feePercentage: feeCalc.feePercent,
      feeAmountCents: feeCalc.feeAmountCents,
      netPayoutCents: feeCalc.netPayoutCents,
      currency: 'USD',
      bankingProvider: body.provider || 'STRIPE_TREASURY',
      externalDisbursementId: bankingRes.externalTransactionId,
      status: bankingRes.status,
      initiatedAt: new Date(),
      settledAt: bankingRes.status === 'SETTLED' ? new Date() : null,
      ledgerTransactionId: ledgerTxId,
    });

    return NextResponse.json({
      success: true,
      payout: savedPayout,
      banking: bankingRes,
      ledger: {
        isBalanced: ledgerRes.isBalanced,
        entriesCount: ledgerRes.entries.length,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to disburse payout' },
      { status: 500 }
    );
  }
}
