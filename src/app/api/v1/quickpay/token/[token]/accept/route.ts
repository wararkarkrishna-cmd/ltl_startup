import { NextRequest, NextResponse } from 'next/server';
import { dbClient } from '@/db/client';
import { QuickPayFeeEngine } from '@/lib/quickpay/quickpay-fee-engine';
import { QuickPayContractEngine } from '@/lib/quickpay/quickpay-contract-engine';
import { EmbeddedBankingEngine } from '@/lib/quickpay/embedded-banking-engine';
import { DoubleEntryLedgerEngine } from '@/lib/quickpay/double-entry-ledger-engine';
import { QUICKPAY_TIERS, QuickPayTier } from '@/db/schema';
import { generateUuidV7 } from '@/lib/uuidv7';

export async function POST(
  req: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    const token = params.token;
    const tokenRecord = await dbClient.getQuickPayToken(token);

    if (!tokenRecord) {
      return NextResponse.json(
        { success: false, error: 'Invalid or expired QuickPay token' },
        { status: 404 }
      );
    }

    if (tokenRecord.isUsed) {
      return NextResponse.json(
        { success: false, error: 'QuickPay payout has already been processed.' },
        { status: 409 }
      );
    }

    const body = await req.json();
    const selectedTier: QuickPayTier = body.selectedTier || tokenRecord.defaultTier;
    const signerName = body.signerName || 'Authorized Dispatcher';
    const signerTitle = body.signerTitle || 'Managing Agent';
    const signerEmail = body.signerEmail || tokenRecord.carrierEmail || 'billing@carrier.com';
    const clientIp = req.headers.get('x-forwarded-for') || '127.0.0.1';

    // 1. Calculate Fee & Net
    const feeCalc = QuickPayFeeEngine.calculateSingleTier(
      tokenRecord.grossAmountCents,
      selectedTier,
      body.customFeePercentOverride
    );

    // 2. Create Payout Entity
    dbClient.setTenantContext(tokenRecord.tenantId);
    const payoutId = generateUuidV7();
    const ledgerTxId = generateUuidV7();

    // 3. Generate E-SIGN Agreement
    const agreementResult = QuickPayContractEngine.createAgreement({
      tenantId: tokenRecord.tenantId,
      payoutId,
      shipmentId: tokenRecord.shipmentId,
      carrierScac: tokenRecord.carrierScac,
      carrierName: tokenRecord.carrierName,
      proNumber: tokenRecord.proNumber,
      bolNumber: tokenRecord.bolNumber,
      selectedTier,
      grossAmountCents: tokenRecord.grossAmountCents,
      discountFeeCents: feeCalc.feeAmountCents,
      netSettlementCents: feeCalc.netPayoutCents,
      signerName,
      signerTitle,
      signerEmail,
      signerIp: clientIp,
      signerUserAgent: req.headers.get('user-agent'),
      bankName: tokenRecord.bankName,
      routingNumberMasked: tokenRecord.routingNumberMasked,
      accountNumberMasked: tokenRecord.accountNumberMasked,
    });

    await dbClient.insertQuickPayAgreement(agreementResult.agreement);

    // 4. Dispatch Embedded Banking Payment
    const isInstant = selectedTier === 'INSTANT_SAME_DAY';
    const payoutRail = isInstant ? 'INSTANT_RTP' : selectedTier === 'NEXT_DAY_ACH' ? 'SAME_DAY_ACH' : 'STANDARD_ACH';

    const bankingResponse = await EmbeddedBankingEngine.executePayout({
      tenantId: tokenRecord.tenantId,
      shipmentId: tokenRecord.shipmentId,
      carrierScac: tokenRecord.carrierScac,
      carrierName: tokenRecord.carrierName,
      amountCents: feeCalc.netPayoutCents,
      payoutRail,
      provider: 'STRIPE_TREASURY',
      destinationRoutingNumber: '021000021',
      destinationAccountNumber: '1234567890',
      bankName: tokenRecord.bankName,
      statementDescriptor: `APEX QPAY ${tokenRecord.carrierScac}`,
    });

    // 5. Post Balanced Double-Entry Ledger
    const ledgerResult = await DoubleEntryLedgerEngine.postQuickPayPayout({
      tenantId: tokenRecord.tenantId,
      transactionId: ledgerTxId,
      shipmentId: tokenRecord.shipmentId,
      carrierScac: tokenRecord.carrierScac,
      carrierName: tokenRecord.carrierName,
      grossAmountCents: tokenRecord.grossAmountCents,
      feeAmountCents: feeCalc.feeAmountCents,
      netPayoutCents: feeCalc.netPayoutCents,
      currency: 'USD',
    });

    // 6. Save Carrier Payout Record
    const savedPayout = await dbClient.insertCarrierPayout({
      id: payoutId,
      tenantId: tokenRecord.tenantId,
      shipmentId: tokenRecord.shipmentId,
      carrierAccountId: tokenRecord.carrierAccountId,
      quickpayTokenId: tokenRecord.id,
      carrierScac: tokenRecord.carrierScac,
      carrierName: tokenRecord.carrierName,
      carrierEmail: signerEmail,
      proNumber: tokenRecord.proNumber,
      bolNumber: tokenRecord.bolNumber,
      selectedTier,
      payoutRail,
      grossAmountCents: tokenRecord.grossAmountCents,
      feePercentage: feeCalc.feePercent,
      feeAmountCents: feeCalc.feeAmountCents,
      netPayoutCents: feeCalc.netPayoutCents,
      currency: 'USD',
      bankingProvider: 'STRIPE_TREASURY',
      externalDisbursementId: bankingResponse.externalTransactionId,
      destinationBankName: tokenRecord.bankName,
      destinationRoutingMasked: tokenRecord.routingNumberMasked,
      destinationAccountMasked: tokenRecord.accountNumberMasked,
      status: bankingResponse.status,
      initiatedAt: new Date(),
      settledAt: bankingResponse.status === 'SETTLED' ? new Date() : null,
      ledgerTransactionId: ledgerTxId,
      agreementId: agreementResult.agreement.id,
    });

    // 7. Mark Token Used
    await dbClient.markQuickPayTokenUsed(token, clientIp);

    return NextResponse.json({
      success: true,
      message: 'QuickPay disbursement executed and balanced in financial ledger.',
      payout: savedPayout,
      agreement: agreementResult.agreement,
      banking: bankingResponse,
      ledger: {
        entriesCount: ledgerResult.entries.length,
        isBalanced: ledgerResult.isBalanced,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to accept and disburse QuickPay' },
      { status: 500 }
    );
  }
}
