import { describe, it, expect, beforeEach } from 'vitest';
import { dbClient } from '../src/db/client';
import {
  RecoveryBillingEngine,
  calculateContingencyFee,
  generateMonthlyRecoveryStatement,
} from '../src/lib/audit';

describe('Phase 5.7: Recovery Contingency Monetization Engine', () => {
  const tenantId = '01916362-7901-7080-867c-9b8895092a01';

  beforeEach(() => {
    dbClient.setTenantContext(tenantId);
    dbClient.carrierDisputes.clear();
    dbClient.carrierInvoices.clear();
    dbClient.ledgerEntries.clear();
  });

  describe('1. Contingency Fee Calculation (Revenue Driver #1)', () => {
    it('calculates standard 20.0% performance contingency fee and broker net retained amount correctly', () => {
      const recoveredCents = 840000; // $8,400.00
      const result = RecoveryBillingEngine.calculateContingencyFee(recoveredCents);

      expect(result.recoveredAmountCents).toBe(840000);
      expect(result.contingencyRatePercent).toBe(20.0);
      expect(result.contingencyFeeCents).toBe(168000); // $1,680.00
      expect(result.brokerNetRetainedCents).toBe(672000); // $6,720.00
      expect(result.contingencyFeeCents + result.brokerNetRetainedCents).toBe(recoveredCents);
    });

    it('calculates custom contingency rates (e.g. 15.0%, 25.0%, 10.0%)', () => {
      // 15% rate on $10,000.00
      const fee15 = RecoveryBillingEngine.calculateContingencyFee(1000000, 15.0);
      expect(fee15.contingencyFeeCents).toBe(150000); // $1,500.00
      expect(fee15.brokerNetRetainedCents).toBe(850000); // $8,500.00

      // 25% rate on $4,500.00
      const fee25 = RecoveryBillingEngine.calculateContingencyFee(450000, 25.0);
      expect(fee25.contingencyFeeCents).toBe(112500); // $1,125.00
      expect(fee25.brokerNetRetainedCents).toBe(337500); // $3,375.00
    });

    it('handles exact integer cents math and rounding accurately', () => {
      // $133.33 (13333 cents) at 20.0% = 2666.6 -> rounds to 2667 cents ($26.67)
      const res = RecoveryBillingEngine.calculateContingencyFee(13333, 20.0);
      expect(res.contingencyFeeCents).toBe(2667);
      expect(res.brokerNetRetainedCents).toBe(10666);
      expect(res.contingencyFeeCents + res.brokerNetRetainedCents).toBe(13333);
    });

    it('handles 0 recovered amount cleanly without errors', () => {
      const zero = RecoveryBillingEngine.calculateContingencyFee(0, 20.0);
      expect(zero.recoveredAmountCents).toBe(0);
      expect(zero.contingencyFeeCents).toBe(0);
      expect(zero.brokerNetRetainedCents).toBe(0);
    });
  });

  describe('2. Monthly Recovery Statement Compilation & Performance Reporting', () => {
    it('aggregates settled disputes for billing cycle 2026-09 and generates full financial statement', async () => {
      // 1. Seed Carrier Invoices and Settled Disputes totaling $8,400.00 recovered
      const invoice1 = await dbClient.insertCarrierInvoice({
        tenantId,
        carrierCode: 'XPO',
        carrierScac: 'XPOL',
        carrierName: 'XPO Logistics',
        carrierInvoiceNumber: 'INV-XPO-901',
        proNumber: 'XPO-901001',
        invoicedLinehaulCents: 150000,
        invoicedFuelCents: 30000,
        invoicedAccessorialCents: 45000,
        invoicedTotalCents: 225000,
        sourceFormat: 'EDI_210',
        status: 'SETTLED',
      });

      const invoice2 = await dbClient.insertCarrierInvoice({
        tenantId,
        carrierCode: 'ODFL',
        carrierScac: 'ODFL',
        carrierName: 'Old Dominion Freight Line',
        carrierInvoiceNumber: 'INV-ODFL-902',
        proNumber: 'ODFL-902002',
        invoicedLinehaulCents: 280000,
        invoicedFuelCents: 56000,
        invoicedAccessorialCents: 60000,
        invoicedTotalCents: 396000,
        sourceFormat: 'EDI_210',
        status: 'SETTLED',
      });

      const invoice3 = await dbClient.insertCarrierInvoice({
        tenantId,
        carrierCode: 'ESTES',
        carrierScac: 'EXLA',
        carrierName: 'Estes Express Lines',
        carrierInvoiceNumber: 'INV-EXLA-903',
        proNumber: 'EXLA-903003',
        invoicedLinehaulCents: 210000,
        invoicedFuelCents: 42000,
        invoicedAccessorialCents: 35000,
        invoicedTotalCents: 287000,
        sourceFormat: 'EDI_210',
        status: 'SETTLED',
      });

      // Dispute 1: XPO unauthorized reweigh ($2,500.00 recovered)
      await dbClient.insertCarrierDispute({
        tenantId,
        carrierInvoiceId: invoice1.id,
        disputeReferenceNumber: 'DISP-2026-XPO-001',
        carrierScac: 'XPOL',
        carrierName: 'XPO Logistics',
        carrierProNumber: 'XPO-901001',
        bolNumber: 'BOL-901',
        disputeType: 'UNAUTHORIZED_REWEIGH',
        disputedAmountCents: 250000, // $2,500.00
        disputeStatus: 'CREDIT_ISSUED',
        creditMemoNumber: 'CM-XPO-771',
        recoveredAmountCents: 250000,
        submittedAt: new Date('2026-09-02T10:00:00Z'),
        resolvedAt: new Date('2026-09-08T14:30:00Z'),
      });

      // Dispute 2: ODFL bogus accessorials + class bump ($3,900.00 recovered)
      await dbClient.insertCarrierDispute({
        tenantId,
        carrierInvoiceId: invoice2.id,
        disputeReferenceNumber: 'DISP-2026-ODFL-002',
        carrierScac: 'ODFL',
        carrierName: 'Old Dominion Freight Line',
        carrierProNumber: 'ODFL-902002',
        bolNumber: 'BOL-902',
        disputeType: 'BOGUS_ACCESSORIAL',
        disputedAmountCents: 390000, // $3,900.00
        disputeStatus: 'CREDIT_ISSUED',
        creditMemoNumber: 'CM-ODFL-882',
        recoveredAmountCents: 390000,
        submittedAt: new Date('2026-09-05T09:00:00Z'),
        resolvedAt: new Date('2026-09-12T16:00:00Z'),
      });

      // Dispute 3: Estes fuel index mismatch ($2,000.00 recovered)
      await dbClient.insertCarrierDispute({
        tenantId,
        carrierInvoiceId: invoice3.id,
        disputeReferenceNumber: 'DISP-2026-EXLA-003',
        carrierScac: 'EXLA',
        carrierName: 'Estes Express Lines',
        carrierProNumber: 'EXLA-903003',
        bolNumber: 'BOL-903',
        disputeType: 'FUEL_INDEX_MISMATCH',
        disputedAmountCents: 200000, // $2,000.00
        disputeStatus: 'CREDIT_ISSUED',
        creditMemoNumber: 'CM-EXLA-993',
        recoveredAmountCents: 200000,
        submittedAt: new Date('2026-09-10T11:00:00Z'),
        resolvedAt: new Date('2026-09-18T15:00:00Z'),
      });

      // 2. Generate Monthly Recovery Statement for Cycle '2026-09'
      const statement = await RecoveryBillingEngine.generateMonthlyRecoveryStatement(
        tenantId,
        '2026-09',
        20.0
      );

      // 3. Verify Financial Metrics
      // Total credits recovered: $2,500 + $3,900 + $2,000 = $8,400.00 (840,000 cents)
      expect(statement.totalCreditsRecoveredCents).toBe(840000);
      expect(statement.totalCarrierOverchargesDisputedCents).toBe(840000);
      expect(statement.recoverySuccessRatePercent).toBe(100.0);

      // Performance Fee (20%): $1,680.00 (168,000 cents)
      expect(statement.totalPerformanceFeeCents).toBe(168000);

      // Broker Net Retained (80%): $6,720.00 (672,000 cents)
      expect(statement.brokerNetRetainedCents).toBe(672000);
      expect(statement.totalDisputesSettled).toBe(3);
      expect(statement.lineItems.length).toBe(3);

      // 4. Verify Printable HTML Statement text format
      expect(statement.htmlStatement).toContain(
        'Apex Freight Dispute Engine recovered $8,400.00 in carrier overcharges this month. Performance fee (20%): $1,680.00.'
      );
      expect(statement.htmlStatement).toContain('CM-XPO-771');
      expect(statement.htmlStatement).toContain('CM-ODFL-882');
      expect(statement.htmlStatement).toContain('CM-EXLA-993');

      // 5. Verify PDF Buffer is generated
      expect(statement.pdfBuffer).toBeDefined();
      expect(statement.pdfBuffer instanceof Buffer).toBe(true);
      expect(statement.pdfBuffer!.length).toBeGreaterThan(500);
    });
  });

  describe('3. Double-Entry Financial Ledger Settlement Entries', () => {
    it('generates balanced double-entry ledger entries for dispute recovery realization', async () => {
      // Seed a settled dispute of $8,400.00
      const invoice = await dbClient.insertCarrierInvoice({
        tenantId,
        carrierCode: 'XPO',
        carrierScac: 'XPOL',
        carrierInvoiceNumber: 'INV-XPO-500',
        proNumber: 'XPO-500123',
        invoicedLinehaulCents: 840000,
        invoicedTotalCents: 840000,
        sourceFormat: 'EDI_210',
      });

      await dbClient.insertCarrierDispute({
        tenantId,
        carrierInvoiceId: invoice.id,
        disputeReferenceNumber: 'DISP-2026-XPO-500',
        carrierScac: 'XPOL',
        carrierProNumber: 'XPO-500123',
        disputeType: 'UNAUTHORIZED_REWEIGH',
        disputedAmountCents: 840000,
        disputeStatus: 'CREDIT_ISSUED',
        creditMemoNumber: 'CM-8400',
        recoveredAmountCents: 840000,
        resolvedAt: new Date('2026-09-20T12:00:00Z'),
      });

      const statement = await RecoveryBillingEngine.generateMonthlyRecoveryStatement(
        tenantId,
        '2026-09',
        20.0
      );

      // Verify 3 balanced ledger entries were generated
      expect(statement.ledgerEntries.length).toBe(3);

      const debitRecovery = statement.ledgerEntries.find(
        (e) => e.accountType === 'DISPUTE_RECOVERY' && e.entryType === 'DEBIT'
      );
      const creditPayable = statement.ledgerEntries.find(
        (e) => e.accountType === 'CARRIER_PAYABLE' && e.entryType === 'CREDIT'
      );
      const creditRevenue = statement.ledgerEntries.find(
        (e) => e.accountType === 'PLATFORM_REVENUE' && e.entryType === 'CREDIT'
      );

      expect(debitRecovery).toBeDefined();
      expect(debitRecovery!.amountCents).toBe(840000); // $8,400.00

      expect(creditPayable).toBeDefined();
      expect(creditPayable!.amountCents).toBe(672000); // $6,720.00

      expect(creditRevenue).toBeDefined();
      expect(creditRevenue!.amountCents).toBe(168000); // $1,680.00

      // Balanced Double-Entry Principle: Total Debits == Total Credits
      const totalDebits = statement.ledgerEntries
        .filter((e) => e.entryType === 'DEBIT')
        .reduce((sum, e) => sum + e.amountCents, 0);

      const totalCredits = statement.ledgerEntries
        .filter((e) => e.entryType === 'CREDIT')
        .reduce((sum, e) => sum + e.amountCents, 0);

      expect(totalDebits).toBe(840000);
      expect(totalCredits).toBe(840000);
      expect(totalDebits).toBe(totalCredits);

      // Verify entries are persisted in dbClient
      const dbEntries = await dbClient.getLedgerEntriesByTenant(tenantId);
      expect(dbEntries.length).toBe(3);
    });
  });
});
