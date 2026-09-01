import { describe, it, expect, beforeEach } from 'vitest';
import { BankReconciliationEngine } from '../src/lib/quickpay/bank-reconciliation-engine';
import { DoubleEntryLedgerEngine } from '../src/lib/quickpay/double-entry-ledger-engine';
import { dbClient } from '../src/db/client';
import { generateUuidV7 } from '../src/lib/uuidv7';

describe('Phase 6.5: Double-Entry Float Ledger & Physical Bank Statement Reconciliation Engine', () => {
  const tenantId = '01916362-7901-7080-867c-9b8895092a01';

  beforeEach(() => {
    dbClient.setTenantContext(tenantId);
    dbClient.ledgerEntries.clear();
    dbClient.bankStatements.clear();
    dbClient.bankStatementLines.clear();
  });

  it('ingests and reconciles physical bank statement with 100% matched transactions and zero penny variance', async () => {
    // 1. Post 2 internal double-entry ledger transactions
    // Tx A: QuickPay Payout ($800 gross, $20 fee, $780 net disbursement)
    await DoubleEntryLedgerEngine.postQuickPayPayout({
      tenantId,
      transactionId: generateUuidV7(),
      shipmentId: generateUuidV7(),
      carrierScac: 'SAIA',
      carrierName: 'SAIA LTL Freight',
      grossAmountCents: 80000,
      feeAmountCents: 2000,
      netPayoutCents: 78000,
    });

    // Tx B: Shipper Remittance Collected ($1,200 customer invoice paid)
    await DoubleEntryLedgerEngine.postShipperCollection({
      tenantId,
      transactionId: generateUuidV7(),
      shipmentId: generateUuidV7(),
      shipperName: 'Acme Logistics Corp',
      totalCollectedCents: 120000,
    });

    // 2. Ingest Physical Bank Statement Feed (Opening: $10,000.00, Debits: $780.00, Credits: $1,200.00 -> Closing: $10,420.00)
    const statement = await BankReconciliationEngine.ingestStatement({
      tenantId,
      statementDate: '2026-09-01',
      bankName: 'JPMorgan Chase Operating Account',
      accountNumberMasked: '*****8821',
      openingBalanceCents: 1_000_000, // $10,000.00
      closingBalanceCents: 1_042_000, // $10,420.00
      feedFormat: 'PLAID_STREAM',
      lines: [
        {
          transactionDate: '2026-09-01',
          amountCents: 78000, // $780.00 Money Out (Debit)
          entryType: 'DEBIT',
          description: 'STRIPE TREASURY DISBURSEMENT - SAIA QPAY',
          bankReferenceNumber: 'TR_OUT_881920',
        },
        {
          transactionDate: '2026-09-01',
          amountCents: 120000, // $1,200.00 Money In (Credit)
          entryType: 'CREDIT',
          description: 'INCOMING ACH CUSTOMER REMITTANCE - ACME CORP',
          bankReferenceNumber: 'ACH_IN_991823',
        },
      ],
    });

    expect(statement.totalDebitsCents).toBe(78000);
    expect(statement.totalCreditsCents).toBe(120000);

    // 3. Reconcile Bank Statement
    const report = await BankReconciliationEngine.reconcileStatement(tenantId, statement.id);

    expect(report.isZeroDiscrepancy).toBe(true);
    expect(report.unreconciledVarianceCents).toBe(0);
    expect(report.matchedLinesCount).toBe(2);
    expect(report.unmatchedLinesCount).toBe(0);
    expect(report.reconciliationStatus).toBe('FULLY_RECONCILED');
    expect(report.floatMetrics.workingCapitalUtilizationPercent).toBeGreaterThanOrEqual(0);
  });

  it('detects and flags unreconciled penny variances when physical statement drifts from ledger', async () => {
    // Ingest mismatched statement
    const statement = await BankReconciliationEngine.ingestStatement({
      tenantId,
      statementDate: '2026-09-01',
      bankName: 'JPMorgan Chase Operating Account',
      accountNumberMasked: '*****8821',
      openingBalanceCents: 1_000_000,
      closingBalanceCents: 1_045_000, // Incorrect closing balance ($30.00 drift)
      lines: [
        {
          transactionDate: '2026-09-01',
          amountCents: 20000,
          entryType: 'CREDIT',
          description: 'UNKNOWN WIRE',
        },
      ],
    });

    const report = await BankReconciliationEngine.reconcileStatement(tenantId, statement.id);

    expect(report.isZeroDiscrepancy).toBe(false);
    expect(report.unreconciledVarianceCents).toBe(25000); // $250.00 variance
    expect(report.reconciliationStatus).toBe('DISCREPANCY_FLAGGED');
  });

  it('calculates real-time working capital float position and credit facility utilization', async () => {
    // Post QuickPay Payout creating $1,170.00 float advance
    await DoubleEntryLedgerEngine.postQuickPayPayout({
      tenantId,
      transactionId: generateUuidV7(),
      shipmentId: generateUuidV7(),
      carrierScac: 'ESTES',
      carrierName: 'Estes Express',
      grossAmountCents: 120000,
      feeAmountCents: 3000,
      netPayoutCents: 117000,
    });

    const ledgerEntries = await dbClient.getLedgerEntriesByTenant(tenantId);
    const floatMetrics = BankReconciliationEngine.calculateWorkingCapitalFloat(
      ledgerEntries,
      50_000_00, // $50,000.00 cleared cash
      100_000_00 // $100,000.00 credit facility limit
    );

    expect(floatMetrics.disbursedInTransitFloatCents).toBe(117000); // $1,170.00
    expect(floatMetrics.workingCapitalUtilizationPercent).toBe(1.17); // 1.17% of $100k
    expect(floatMetrics.netWorkingCapitalPositionCents).toBeGreaterThan(0);
  });
});
