import { describe, it, expect, beforeEach } from 'vitest';
import { DoubleEntryLedgerEngine } from '../src/lib/quickpay/double-entry-ledger-engine';
import { dbClient } from '../src/db/client';
import { generateUuidV7 } from '../src/lib/uuidv7';

describe('Phase 6.4 & 6.5: Double-Entry Financial Ledger & Working Capital Reconciliation', () => {
  const tenantId = '01916362-7901-7080-867c-9b8895092a01';

  beforeEach(() => {
    dbClient.setTenantContext(tenantId);
    dbClient.ledgerEntries.clear();
  });

  it('posts balanced double-entry records for a QuickPay Payout transaction', async () => {
    const transactionId = generateUuidV7();
    const result = await DoubleEntryLedgerEngine.postQuickPayPayout({
      tenantId,
      transactionId,
      shipmentId: generateUuidV7(),
      carrierScac: 'SAIA',
      carrierName: 'SAIA LTL Freight',
      grossAmountCents: 80000, // $800.00
      feeAmountCents: 2000,    // $20.00 (Revenue)
      netPayoutCents: 78000,   // $780.00 (Cash Out)
    });

    expect(result.isBalanced).toBe(true);
    expect(result.entries.length).toBe(3);

    // 1. CARRIER_PAYABLE Debit ($800.00)
    const payableDebit = result.entries.find(
      (e) => e.accountType === 'CARRIER_PAYABLE' && e.entryType === 'DEBIT'
    );
    expect(payableDebit).toBeDefined();
    expect(payableDebit?.amountCents).toBe(80000);

    // 2. CASH_ESCROW Credit ($780.00)
    const cashCredit = result.entries.find(
      (e) => e.accountType === 'CASH_ESCROW' && e.entryType === 'CREDIT'
    );
    expect(cashCredit).toBeDefined();
    expect(cashCredit?.amountCents).toBe(78000);

    // 3. QUICKPAY_REVENUE Credit ($20.00)
    const revenueCredit = result.entries.find(
      (e) => e.accountType === 'QUICKPAY_REVENUE' && e.entryType === 'CREDIT'
    );
    expect(revenueCredit).toBeDefined();
    expect(revenueCredit?.amountCents).toBe(2000);
  });

  it('maintains strict Trial Balance invariant (Debits == Credits) across multiple transactions', async () => {
    // Transaction 1: QuickPay Payout ($1,200.00 load @ 2.5% fee = $30 fee, $1,170 net)
    await DoubleEntryLedgerEngine.postQuickPayPayout({
      tenantId,
      transactionId: generateUuidV7(),
      shipmentId: generateUuidV7(),
      carrierScac: 'CNWY',
      carrierName: 'XPO Logistics',
      grossAmountCents: 120000,
      feeAmountCents: 3000,
      netPayoutCents: 117000,
    });

    // Transaction 2: Shipper Collection ($1,400.00 customer invoice paid)
    await DoubleEntryLedgerEngine.postShipperCollection({
      tenantId,
      transactionId: generateUuidV7(),
      shipmentId: generateUuidV7(),
      shipperName: 'Acme Industrial Corp',
      totalCollectedCents: 140000,
    });

    const trialBalance = await DoubleEntryLedgerEngine.calculateTrialBalance(tenantId);

    expect(trialBalance.isBalanced).toBe(true);
    expect(trialBalance.discrepancyCents).toBe(0);
    expect(trialBalance.totalDebitsCents).toBe(trialBalance.totalCreditsCents);
    expect(trialBalance.totalDebitsCents).toBe(260000); // 120000 + 140000
  });
});
