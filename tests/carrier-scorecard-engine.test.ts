import { describe, it, expect, beforeEach } from 'vitest';
import { dbClient } from '../src/db/client';
import {
  CarrierScorecardEngine,
  generateCarrierScorecard,
  generateNetworkScorecards,
} from '../src/lib/audit';

describe('Phase 5.8: Carrier Billing Accuracy & Reliability Scoring Engine', () => {
  const tenantId = '01916362-7901-7080-867c-9b8895092a01';

  beforeEach(() => {
    dbClient.setTenantContext(tenantId);
    dbClient.carrierInvoices.clear();
    dbClient.carrierDisputes.clear();
    dbClient.discrepancyRecords.clear();
  });

  describe('1. Clean Invoice Rate & Core Metrics Calculation', () => {
    it('computes clean invoice rate and error rate accurately across 10 invoices (6 clean, 4 disputed = 60.0% clean)', async () => {
      // Seed 6 Clean Invoices for XPO
      for (let i = 1; i <= 6; i++) {
        await dbClient.insertCarrierInvoice({
          tenantId,
          carrierCode: 'XPO',
          carrierScac: 'XPOL',
          carrierName: 'XPO Logistics',
          carrierInvoiceNumber: `INV-CLEAN-${i}`,
          proNumber: `PRO-CLEAN-${i}`,
          invoicedLinehaulCents: 50000,
          invoicedFuelCents: 10000,
          invoicedTotalCents: 60000,
          sourceFormat: 'EDI_210',
          status: 'AUDITED_CLEAN',
        });
      }

      // Seed 4 Disputed Invoices for XPO
      for (let i = 1; i <= 4; i++) {
        const inv = await dbClient.insertCarrierInvoice({
          tenantId,
          carrierCode: 'XPO',
          carrierScac: 'XPOL',
          carrierName: 'XPO Logistics',
          carrierInvoiceNumber: `INV-DISP-${i}`,
          proNumber: `PRO-DISP-${i}`,
          invoicedLinehaulCents: 65000,
          invoicedFuelCents: 12000,
          invoicedAccessorialCents: 15000,
          invoicedTotalCents: 92000,
          sourceFormat: 'EDI_210',
          status: 'DISCREPANCY_FLAGGED',
        });

        const disc = await dbClient.insertDiscrepancyRecord({
          tenantId,
          carrierInvoiceId: inv.id,
          discrepancyType: i === 1 ? 'UNAUTHORIZED_REWEIGH' : i === 2 ? 'RECLASSIFICATION_DISPUTE' : i === 3 ? 'BOGUS_ACCESSORIAL' : 'FUEL_INDEX_MISMATCH',
          disputableAmountCents: 15000, // $150.00
          discrepancyDescription: `Discrepancy on invoice ${i}`,
        });

        await dbClient.insertCarrierDispute({
          tenantId,
          carrierInvoiceId: inv.id,
          discrepancyId: disc.id,
          disputeReferenceNumber: `DISP-XPO-00${i}`,
          carrierScac: 'XPOL',
          carrierProNumber: `PRO-DISP-${i}`,
          disputeType: disc.discrepancyType,
          disputedAmountCents: 15000,
          recoveredAmountCents: 15000,
          disputeStatus: 'CREDIT_ISSUED',
          submittedAt: new Date('2026-08-01T10:00:00Z'),
          resolvedAt: new Date('2026-08-06T10:00:00Z'), // 5 days
        });
      }

      const scorecard = await CarrierScorecardEngine.generateCarrierScorecard(
        tenantId,
        'XPOL',
        90
      );

      expect(scorecard.totalInvoicesBilled).toBe(10);
      expect(scorecard.cleanInvoicesCount).toBe(6);
      expect(scorecard.disputedInvoicesCount).toBe(4);
      expect(scorecard.cleanInvoiceRatePercent).toBe(60.0);
      expect(scorecard.totalOverchargeAttemptedCents).toBe(60000); // 4 * $150 = $600.00
      expect(scorecard.totalCreditsRecoveredCents).toBe(60000);
      expect(scorecard.disputeWinRatePercent).toBe(100.0);
    });
  });

  describe('2. Discrepancy Category Breakdown Analytics', () => {
    it('accurately stratifies frequency and dollar amounts for UNAUTHORIZED_REWEIGH, RECLASSIFICATION_DISPUTE, BOGUS_ACCESSORIAL, and FUEL_INDEX_MISMATCH', async () => {
      // Seed an invoice and 4 distinct category discrepancies
      const invoice = await dbClient.insertCarrierInvoice({
        tenantId,
        carrierCode: 'ODFL',
        carrierScac: 'ODFL',
        carrierName: 'Old Dominion Freight Line',
        carrierInvoiceNumber: 'INV-ODFL-CAT',
        proNumber: 'ODFL-CAT-01',
        invoicedLinehaulCents: 120000,
        invoicedTotalCents: 120000,
        sourceFormat: 'EDI_210',
      });

      // 1. UNAUTHORIZED_REWEIGH ($350.00 overcharge, $350.00 recovered)
      await dbClient.insertDiscrepancyRecord({
        tenantId,
        carrierInvoiceId: invoice.id,
        discrepancyType: 'UNAUTHORIZED_REWEIGH',
        disputableAmountCents: 35000,
        discrepancyDescription: 'Billed weight 800 lbs over BOL',
      });
      await dbClient.insertCarrierDispute({
        tenantId,
        carrierInvoiceId: invoice.id,
        disputeReferenceNumber: 'DISP-ODFL-RWG',
        carrierScac: 'ODFL',
        carrierProNumber: 'ODFL-CAT-01',
        disputeType: 'UNAUTHORIZED_REWEIGH',
        disputedAmountCents: 35000,
        recoveredAmountCents: 35000,
        disputeStatus: 'CREDIT_ISSUED',
      });

      // 2. RECLASSIFICATION_DISPUTE ($220.00 overcharge, $220.00 recovered)
      await dbClient.insertDiscrepancyRecord({
        tenantId,
        carrierInvoiceId: invoice.id,
        discrepancyType: 'RECLASSIFICATION_DISPUTE',
        disputableAmountCents: 22000,
        discrepancyDescription: 'Class bumped from 70 to 92.5',
      });
      await dbClient.insertCarrierDispute({
        tenantId,
        carrierInvoiceId: invoice.id,
        disputeReferenceNumber: 'DISP-ODFL-RCL',
        carrierScac: 'ODFL',
        carrierProNumber: 'ODFL-CAT-01',
        disputeType: 'RECLASSIFICATION_DISPUTE',
        disputedAmountCents: 22000,
        recoveredAmountCents: 22000,
        disputeStatus: 'CREDIT_ISSUED',
      });

      // 3. BOGUS_ACCESSORIAL ($150.00 overcharge, $150.00 recovered)
      await dbClient.insertDiscrepancyRecord({
        tenantId,
        carrierInvoiceId: invoice.id,
        discrepancyType: 'BOGUS_ACCESSORIAL',
        disputableAmountCents: 15000,
        discrepancyDescription: 'Unapproved liftgate delivery surcharge',
      });
      await dbClient.insertCarrierDispute({
        tenantId,
        carrierInvoiceId: invoice.id,
        disputeReferenceNumber: 'DISP-ODFL-ACC',
        carrierScac: 'ODFL',
        carrierProNumber: 'ODFL-CAT-01',
        disputeType: 'BOGUS_ACCESSORIAL',
        disputedAmountCents: 15000,
        recoveredAmountCents: 15000,
        disputeStatus: 'CREDIT_ISSUED',
      });

      // 4. FUEL_INDEX_MISMATCH ($85.00 overcharge, $85.00 recovered)
      await dbClient.insertDiscrepancyRecord({
        tenantId,
        carrierInvoiceId: invoice.id,
        discrepancyType: 'FUEL_INDEX_MISMATCH',
        disputableAmountCents: 8500,
        discrepancyDescription: 'Fuel percentage mismatched against DOE index',
      });
      await dbClient.insertCarrierDispute({
        tenantId,
        carrierInvoiceId: invoice.id,
        disputeReferenceNumber: 'DISP-ODFL-FUE',
        carrierScac: 'ODFL',
        carrierProNumber: 'ODFL-CAT-01',
        disputeType: 'FUEL_INDEX_MISMATCH',
        disputedAmountCents: 8500,
        recoveredAmountCents: 8500,
        disputeStatus: 'CREDIT_ISSUED',
      });

      const scorecard = await CarrierScorecardEngine.generateCarrierScorecard(
        tenantId,
        'ODFL',
        90
      );

      const bd = scorecard.categoryBreakdown;
      expect(bd['UNAUTHORIZED_REWEIGH'].count).toBe(1);
      expect(bd['UNAUTHORIZED_REWEIGH'].totalOverchargeCents).toBe(35000);
      expect(bd['UNAUTHORIZED_REWEIGH'].recoveredCents).toBe(35000);
      expect(bd['UNAUTHORIZED_REWEIGH'].winRatePercent).toBe(100.0);

      expect(bd['RECLASSIFICATION_DISPUTE'].count).toBe(1);
      expect(bd['RECLASSIFICATION_DISPUTE'].totalOverchargeCents).toBe(22000);

      expect(bd['BOGUS_ACCESSORIAL'].count).toBe(1);
      expect(bd['BOGUS_ACCESSORIAL'].totalOverchargeCents).toBe(15000);

      expect(bd['FUEL_INDEX_MISMATCH'].count).toBe(1);
      expect(bd['FUEL_INDEX_MISMATCH'].totalOverchargeCents).toBe(8500);
    });
  });

  describe('3. Dispute Resolution Velocity & Reliability Composite Scoring', () => {
    it('calculates average resolution days and weighted composite billing reliability score', async () => {
      const invoice = await dbClient.insertCarrierInvoice({
        tenantId,
        carrierCode: 'SAIA',
        carrierScac: 'SAIA',
        carrierName: 'Saia LTL Freight',
        carrierInvoiceNumber: 'INV-SAIA-01',
        proNumber: 'SAIA-01',
        invoicedLinehaulCents: 80000,
        invoicedTotalCents: 80000,
        sourceFormat: 'EDI_210',
        status: 'DISCREPANCY_FLAGGED',
      });

      // Dispute 1: 4 days to resolve
      await dbClient.insertCarrierDispute({
        tenantId,
        carrierInvoiceId: invoice.id,
        disputeReferenceNumber: 'DISP-SAIA-01',
        carrierScac: 'SAIA',
        carrierProNumber: 'SAIA-01',
        disputedAmountCents: 10000,
        recoveredAmountCents: 10000,
        disputeStatus: 'CREDIT_ISSUED',
        submittedAt: new Date('2026-08-01T00:00:00Z'),
        resolvedAt: new Date('2026-08-05T00:00:00Z'), // 4 days
      });

      // Dispute 2: 6 days to resolve
      await dbClient.insertCarrierDispute({
        tenantId,
        carrierInvoiceId: invoice.id,
        disputeReferenceNumber: 'DISP-SAIA-02',
        carrierScac: 'SAIA',
        carrierProNumber: 'SAIA-02',
        disputedAmountCents: 10000,
        recoveredAmountCents: 10000,
        disputeStatus: 'CREDIT_ISSUED',
        submittedAt: new Date('2026-08-10T00:00:00Z'),
        resolvedAt: new Date('2026-08-16T00:00:00Z'), // 6 days
      });

      const scorecard = await CarrierScorecardEngine.generateCarrierScorecard(
        tenantId,
        'SAIA',
        90
      );

      // Average resolution days: (4 + 6) / 2 = 5.0 days
      expect(scorecard.averageResolutionDays).toBe(5.0);
      expect(scorecard.billingReliabilityScore).toBeGreaterThanOrEqual(0);
      expect(scorecard.billingReliabilityScore).toBeLessThanOrEqual(100);
    });

    it('perfect 100% clean billing history results in a 100.0 reliability score', () => {
      const perfectScore = CarrierScorecardEngine.calculateReliabilityScore({
        cleanInvoiceRatePercent: 100.0,
        totalInvoicesBilled: 50,
        totalOverchargeAttemptedCents: 0,
        averageResolutionDays: 0,
      });

      expect(perfectScore).toBe(100.0);
    });
  });

  describe('4. Routing Rating Penalty Basis Points Calculation', () => {
    it('applies +150 bps routing penalty to a carrier with a 40% re-bill error rate', () => {
      // 40% error rate = 60% clean rate
      const penaltyBps = CarrierScorecardEngine.calculateRatingPenaltyBps({
        cleanInvoiceRatePercent: 60.0,
        totalInvoicesBilled: 20,
        totalOverchargeAttemptedCents: 40000,
      });

      // 40 * 3.75 = 150 bps
      expect(penaltyBps).toBe(150);
    });

    it('applies 0 bps penalty to a 100% clean carrier', () => {
      const penaltyBps = CarrierScorecardEngine.calculateRatingPenaltyBps({
        cleanInvoiceRatePercent: 100.0,
        totalInvoicesBilled: 30,
        totalOverchargeAttemptedCents: 0,
      });

      expect(penaltyBps).toBe(0);
    });
  });

  describe('5. Network-Wide Carrier Scorecards Generation', () => {
    it('generates ranked scorecards across all network carriers', async () => {
      // Carrier 1: ODFL (100% clean)
      await dbClient.insertCarrierInvoice({
        tenantId,
        carrierCode: 'ODFL',
        carrierScac: 'ODFL',
        carrierName: 'Old Dominion Freight Line',
        carrierInvoiceNumber: 'INV-NET-ODFL',
        proNumber: 'PRO-NET-ODFL',
        invoicedLinehaulCents: 75000,
        invoicedTotalCents: 75000,
        sourceFormat: 'EDI_210',
        status: 'AUDITED_CLEAN',
      });

      // Carrier 2: XPO (50% clean)
      await dbClient.insertCarrierInvoice({
        tenantId,
        carrierCode: 'XPO',
        carrierScac: 'XPOL',
        carrierName: 'XPO Logistics',
        carrierInvoiceNumber: 'INV-NET-XPO1',
        proNumber: 'PRO-NET-XPO1',
        invoicedLinehaulCents: 60000,
        invoicedTotalCents: 60000,
        sourceFormat: 'EDI_210',
        status: 'AUDITED_CLEAN',
      });
      await dbClient.insertCarrierInvoice({
        tenantId,
        carrierCode: 'XPO',
        carrierScac: 'XPOL',
        carrierName: 'XPO Logistics',
        carrierInvoiceNumber: 'INV-NET-XPO2',
        proNumber: 'PRO-NET-XPO2',
        invoicedLinehaulCents: 60000,
        invoicedTotalCents: 85000,
        sourceFormat: 'EDI_210',
        status: 'DISCREPANCY_FLAGGED',
      });

      const networkScorecards = await CarrierScorecardEngine.generateNetworkScorecards(
        tenantId,
        90
      );

      expect(networkScorecards.length).toBe(2);
      // Ranked with highest reliability carrier first (ODFL > XPOL)
      expect(networkScorecards[0].carrierScac).toBe('ODFL');
      expect(networkScorecards[0].cleanInvoiceRatePercent).toBe(100.0);
      expect(networkScorecards[1].carrierScac).toBe('XPOL');
      expect(networkScorecards[1].cleanInvoiceRatePercent).toBe(50.0);
    });
  });
});
