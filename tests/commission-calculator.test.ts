import { describe, it, expect, beforeEach } from 'vitest';
import {
  CommissionCalculator,
  DEFAULT_COMMISSION_TIERS,
  CommissionTier,
} from '../src/lib/accounting/commission-calculator';
import { dbClient } from '../src/db/client';
import { generateUuidV7 } from '../src/lib/uuidv7';

describe('Phase 4.6: Dynamic Sales Rep Commission Engine (CommissionCalculator)', () => {
  const tenantId = '01916362-7901-7080-867c-9b8895092a01';
  let salesRepId: string;

  beforeEach(async () => {
    dbClient.setTenantContext(tenantId);

    // Clear previous records for clean test state
    dbClient.commissionRecords.clear();
    dbClient.salesReps.clear();

    // Seed test sales rep
    const rep = await dbClient.insertSalesRep({
      tenantId,
      name: 'Jordan Belfort (Senior Freight Broker)',
      email: 'jbelfort@apexfreightos.com',
      phone: '555-0144',
      defaultCommissionTierId: 'STANDARD_TIER',
      baseCommissionPercent: 10.0,
      monthlyProfitQuotaCents: 1000000, // $10,000.00 quota (1,000,000 cents)
      isActive: true,
    });
    salesRepId = rep.id;
  });

  describe('3-Tier Dynamic Commission Schedule', () => {
    it('Tier 1: applies 5% commission on gross profit when Realized Margin < 10%', async () => {
      // Invoiced: $1,000.00 (100000 cents), Settlement: $920.00 (92000 cents)
      // Realized GP: $80.00 (8000 cents), Margin: 8.0% (< 10%) -> Tier 1 (5% commission)
      // Commission: $80.00 * 5% = $4.00 (400 cents)
      const result = await CommissionCalculator.calculateCommission({
        tenantId,
        shipmentId: generateUuidV7(),
        salesRepId,
        customerInvoicedCents: 100000,
        carrierSettlementCents: 92000,
      });

      expect(result.realizedGrossProfitCents).toBe(8000);
      expect(result.realizedMarginPercent).toBe(8.0);
      expect(result.matchedTier.tierId).toBe('TIER_1_LOW_MARGIN');
      expect(result.appliedCommissionPercent).toBe(5.0);
      expect(result.commissionEarnedCents).toBe(400); // 8000 * 0.05 = 400 cents ($4.00)
      expect(result.isUnprofitable).toBe(false);

      // Verify persisted in DB
      const inDb = dbClient.commissionRecords.get(result.record.id);
      expect(inDb).toBeDefined();
      expect(inDb?.commissionEarnedCents).toBe(400);
      expect(inDb?.status).toBe('ACCRUED');
    });

    it('Tier 2: applies 8% commission on gross profit when Realized Margin is between 10% and 15%', async () => {
      // Invoiced: $2,000.00 (200000 cents), Settlement: $1,750.00 (175000 cents)
      // Realized GP: $250.00 (25000 cents), Margin: 12.5% (10%-15%) -> Tier 2 (8% commission)
      // Commission: $250.00 * 8% = $20.00 (2000 cents)
      const result = await CommissionCalculator.calculateCommission({
        tenantId,
        shipmentId: generateUuidV7(),
        salesRepId,
        customerInvoicedCents: 200000,
        carrierSettlementCents: 175000,
      });

      expect(result.realizedGrossProfitCents).toBe(25000);
      expect(result.realizedMarginPercent).toBe(12.5);
      expect(result.matchedTier.tierId).toBe('TIER_2_STANDARD_MARGIN');
      expect(result.appliedCommissionPercent).toBe(8.0);
      expect(result.commissionEarnedCents).toBe(2000); // 25000 * 0.08 = 2000 cents ($20.00)
    });

    it('Tier 3: applies 12% commission on gross profit when Realized Margin > 15%', async () => {
      // Invoiced: $3,000.00 (300000 cents), Settlement: $2,300.00 (230000 cents)
      // Realized GP: $700.00 (70000 cents), Margin: 23.33% (> 15%) -> Tier 3 (12% commission)
      // Commission: $700.00 * 12% = $84.00 (8400 cents)
      const result = await CommissionCalculator.calculateCommission({
        tenantId,
        shipmentId: generateUuidV7(),
        salesRepId,
        customerInvoicedCents: 300000,
        carrierSettlementCents: 230000,
      });

      expect(result.realizedGrossProfitCents).toBe(70000);
      expect(result.realizedMarginPercent).toBe(23.33);
      expect(result.matchedTier.tierId).toBe('TIER_3_HIGH_MARGIN');
      expect(result.appliedCommissionPercent).toBe(12.0);
      expect(result.commissionEarnedCents).toBe(8400); // 70000 * 0.12 = 8400 cents ($84.00)
    });

    it('yields zero commission on unprofitable or breakeven loads', async () => {
      const result = await CommissionCalculator.calculateCommission({
        tenantId,
        shipmentId: generateUuidV7(),
        salesRepId,
        customerInvoicedCents: 80000,
        carrierSettlementCents: 85000, // Loss of $50.00
      });

      expect(result.realizedGrossProfitCents).toBe(-5000);
      expect(result.isUnprofitable).toBe(true);
      expect(result.appliedCommissionPercent).toBe(0);
      expect(result.commissionEarnedCents).toBe(0);
      expect(result.record.notes).toContain('Zero commission');
    });
  });

  describe('Custom Tier Overrides per Sales Rep', () => {
    it('supports custom tier overrides', async () => {
      const customTiers: CommissionTier[] = [
        {
          tierId: 'CUSTOM_TIER_A',
          name: 'Custom Low Tier',
          minMarginPercent: 0,
          maxMarginPercent: 12.0,
          commissionPercent: 10.0, // Custom 10%
        },
        {
          tierId: 'CUSTOM_TIER_B',
          name: 'Custom High Tier',
          minMarginPercent: 12.0,
          maxMarginPercent: null,
          commissionPercent: 18.0, // Custom 18%
        },
      ];

      // Invoiced: $2,000, Settlement: $1,600 -> GP: $400 (20% margin) -> Custom Tier B (18%)
      const result = await CommissionCalculator.calculateCommission({
        tenantId,
        shipmentId: generateUuidV7(),
        salesRepId,
        customerInvoicedCents: 200000,
        carrierSettlementCents: 160000,
        customTiers,
      });

      expect(result.matchedTier.tierId).toBe('CUSTOM_TIER_B');
      expect(result.appliedCommissionPercent).toBe(18.0);
      expect(result.commissionEarnedCents).toBe(7200); // 40000 * 0.18 = 7200 cents ($72.00)
    });
  });

  describe('Monthly Profit Quota Tracking & Accelerator', () => {
    it('tracks monthly profit quota progress ($10,000 quota)', async () => {
      // Seed 2 historical commission records this month totaling $6,000 GP (600,000 cents)
      await dbClient.insertCommissionRecord({
        tenantId,
        shipmentId: generateUuidV7(),
        salesRepId,
        customerInvoicedCents: 1000000,
        carrierSettlementCents: 800000, // GP: $2,000.00
        realizedGrossProfitCents: 200000,
        realizedMarginPercent: 20.0,
        appliedCommissionPercent: 12.0,
        commissionEarnedCents: 24000,
        status: 'APPROVED',
      });

      await dbClient.insertCommissionRecord({
        tenantId,
        shipmentId: generateUuidV7(),
        salesRepId,
        customerInvoicedCents: 2000000,
        carrierSettlementCents: 1600000, // GP: $4,000.00
        realizedGrossProfitCents: 400000,
        realizedMarginPercent: 20.0,
        appliedCommissionPercent: 12.0,
        commissionEarnedCents: 48000,
        status: 'APPROVED',
      });

      const currentMonth = new Date().toISOString().slice(0, 7);
      const quota = await CommissionCalculator.getMonthlyQuotaProgress(tenantId, salesRepId, currentMonth);

      expect(quota.monthlyProfitQuotaCents).toBe(1000000); // $10,000
      expect(quota.realizedGrossProfitCents).toBe(600000); // $6,000
      expect(quota.quotaPercentAchieved).toBe(60.0);
      expect(quota.isQuotaMet).toBe(false);
      expect(quota.remainingToQuotaCents).toBe(400000); // $4,000 remaining
      expect(quota.shipmentCount).toBe(2);
    });

    it('triggers quota accelerator bonus (+2%) when monthly quota is exceeded', async () => {
      // Seed $11,000 GP to surpass $10,000 monthly quota
      await dbClient.insertCommissionRecord({
        tenantId,
        shipmentId: generateUuidV7(),
        salesRepId,
        customerInvoicedCents: 5000000,
        carrierSettlementCents: 3900000, // GP: $11,000.00 (1,100,000 cents)
        realizedGrossProfitCents: 1100000,
        realizedMarginPercent: 22.0,
        appliedCommissionPercent: 12.0,
        commissionEarnedCents: 132000,
        status: 'APPROVED',
      });

      // Now calculate commission for a new shipment with quota accelerator enabled
      // Invoiced: $2,000, Settlement: $1,600 -> GP: $400 (20% margin -> Base Tier 3 = 12%)
      // With quota met, accelerator adds +2% bonus = 14% commission!
      const result = await CommissionCalculator.calculateCommission({
        tenantId,
        shipmentId: generateUuidV7(),
        salesRepId,
        customerInvoicedCents: 200000,
        carrierSettlementCents: 160000,
        enableQuotaAccelerator: true,
        quotaAcceleratorBonusPercent: 2.0,
      });

      expect(result.baseCommissionPercent).toBe(12.0);
      expect(result.acceleratorBonusPercent).toBe(2.0);
      expect(result.appliedCommissionPercent).toBe(14.0);
      // Commission: $400 (40000 cents) * 14% = 5600 cents ($56.00)
      expect(result.commissionEarnedCents).toBe(5600);
      expect(result.quotaProgress.isQuotaMet).toBe(true);
    });
  });

  describe('Commission Statement & Status Updates', () => {
    it('generates a full rep commission statement and allows status transition to PAID', async () => {
      const calcResult = await CommissionCalculator.calculateCommission({
        tenantId,
        shipmentId: generateUuidV7(),
        salesRepId,
        customerInvoicedCents: 100000,
        carrierSettlementCents: 80000,
      });

      const statement = await CommissionCalculator.getRepCommissionStatement(tenantId, salesRepId);
      expect(statement.repName).toContain('Jordan Belfort');
      expect(statement.totalInvoicedCents).toBe(100000);
      expect(statement.totalGrossProfitCents).toBe(20000);
      expect(statement.commissionRecords.length).toBe(1);

      // Update status to PAID
      const paidRecord = await CommissionCalculator.updateCommissionStatus(
        tenantId,
        calcResult.record.id,
        'PAID',
        'Direct deposit batch #88902'
      );

      expect(paidRecord.status).toBe('PAID');
      expect(paidRecord.paidAt).toBeDefined();
      expect(paidRecord.notes).toContain('batch #88902');
    });
  });
});
