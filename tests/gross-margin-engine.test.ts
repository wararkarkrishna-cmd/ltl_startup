import { describe, it, expect, beforeEach } from 'vitest';
import {
  GrossMarginEngine,
  CarrierSettlementLeg,
  GrossProfitCalculationInput,
} from '../src/lib/accounting/gross-margin-engine';
import { dbClient } from '../src/db/client';

describe('Phase 4.6: Broker Gross Margin Realization Engine (GrossMarginEngine)', () => {
  const tenantId = '01916362-7901-7080-867c-9b8895092a01';
  const shipmentId = '01916362-7901-7080-867c-shp000000001';

  beforeEach(() => {
    dbClient.setTenantContext(tenantId);
  });

  describe('Exact Integer Cents Profitability Formula', () => {
    it('computes exact realized gross profit and margin percentage with zero float drift', () => {
      // Invoiced: $1,250.00 (125000 cents), Carrier Settlement: $1,000.00 (100000 cents)
      // Realized GP: $250.00 (25000 cents), Margin: (25000 / 125000) * 100 = 20.00%
      const result = GrossMarginEngine.calculateGrossProfit({
        tenantId,
        shipmentId,
        customerInvoicedCents: 125000,
        carrierSettlementCents: 100000,
      });

      expect(result.customerInvoicedCents).toBe(125000);
      expect(result.carrierSettlementCents).toBe(100000);
      expect(result.realizedGrossProfitCents).toBe(25000);
      expect(result.realizedMarginPercent).toBe(20.0);
      expect(result.healthClassification).toBe('HEALTHY');
      expect(result.isBelowProfitFloor).toBe(false);
      expect(result.floorDeficitCents).toBe(0);
    });

    it('handles zero invoiced total and negative margins properly', () => {
      const unprofitableResult = GrossMarginEngine.calculateGrossProfit({
        tenantId,
        shipmentId,
        customerInvoicedCents: 80000, // $800.00
        carrierSettlementCents: 95000, // $950.00 (Loss of $150.00)
      });

      expect(unprofitableResult.realizedGrossProfitCents).toBe(-15000);
      expect(unprofitableResult.realizedMarginPercent).toBe(-18.75);
      expect(unprofitableResult.healthClassification).toBe('UNPROFITABLE');
      expect(unprofitableResult.isBelowProfitFloor).toBe(true);
      expect(unprofitableResult.floorDeficitCents).toBe(20000); // 5000 - (-15000) = 20000
    });
  });

  describe('Margin Health Classification', () => {
    it('correctly classifies all margin operational health tiers', () => {
      expect(GrossMarginEngine.classifyMarginHealth(25.5)).toBe('EXCELLENT');
      expect(GrossMarginEngine.classifyMarginHealth(20.01)).toBe('EXCELLENT');

      expect(GrossMarginEngine.classifyMarginHealth(20.0)).toBe('HEALTHY');
      expect(GrossMarginEngine.classifyMarginHealth(15.0)).toBe('HEALTHY');
      expect(GrossMarginEngine.classifyMarginHealth(12.0)).toBe('HEALTHY');

      expect(GrossMarginEngine.classifyMarginHealth(11.99)).toBe('ACCEPTABLE');
      expect(GrossMarginEngine.classifyMarginHealth(9.5)).toBe('ACCEPTABLE');
      expect(GrossMarginEngine.classifyMarginHealth(8.0)).toBe('ACCEPTABLE');

      expect(GrossMarginEngine.classifyMarginHealth(7.99)).toBe('MARGINAL');
      expect(GrossMarginEngine.classifyMarginHealth(4.0)).toBe('MARGINAL');
      expect(GrossMarginEngine.classifyMarginHealth(0.0)).toBe('MARGINAL');

      expect(GrossMarginEngine.classifyMarginHealth(-0.01)).toBe('UNPROFITABLE');
      expect(GrossMarginEngine.classifyMarginHealth(-15.0)).toBe('UNPROFITABLE');
    });
  });

  describe('Minimum Profit Floor ($50.00 / 5000 cents)', () => {
    it('flags shipments below standard $50.00 profit floor and calculates floor deficit', () => {
      const result = GrossMarginEngine.calculateGrossProfit({
        tenantId,
        shipmentId,
        customerInvoicedCents: 53500, // $535.00
        carrierSettlementCents: 50000, // $500.00 -> $35.00 GP (3500 cents)
        minimumProfitFloorCents: 5000,
      });

      expect(result.realizedGrossProfitCents).toBe(3500); // $35.00
      expect(result.isBelowProfitFloor).toBe(true);
      expect(result.floorDeficitCents).toBe(1500); // $15.00 short of floor
    });

    it('respects custom minimum profit floors', () => {
      const result = GrossMarginEngine.calculateGrossProfit({
        tenantId,
        shipmentId,
        customerInvoicedCents: 100000,
        carrierSettlementCents: 92000, // $80.00 GP (8000 cents)
        minimumProfitFloorCents: 10000, // $100.00 custom floor
      });

      expect(result.realizedGrossProfitCents).toBe(8000);
      expect(result.isBelowProfitFloor).toBe(true);
      expect(result.floorDeficitCents).toBe(2000);
    });
  });

  describe('Multi-Leg Cost Consolidation for Split Shipments', () => {
    it('consolidates multi-leg carrier settlement costs and computes profit against customer price', () => {
      const legs: CarrierSettlementLeg[] = [
        {
          legId: 'leg-1',
          legSequence: 1,
          carrierCode: 'XPO',
          carrierName: 'XPO Logistics',
          carrierScac: 'CNWY',
          linehaulCents: 35000,
          fuelSurchargeCents: 5000,
          accessorialCostCents: 2000,
          totalCostCents: 42000, // $420.00
          notes: 'Pickup 1: 4 Pallets (West Hub)',
        },
        {
          legId: 'leg-2',
          legSequence: 2,
          carrierCode: 'SAIA',
          carrierName: 'SAIA LTL Freight',
          carrierScac: 'SAIA',
          linehaulCents: 38000,
          fuelSurchargeCents: 5500,
          accessorialCostCents: 1500,
          totalCostCents: 45000, // $450.00
          notes: 'Pickup 2: 4 Pallets (East Hub)',
        },
      ];

      const result = GrossMarginEngine.calculateGrossProfit({
        tenantId,
        shipmentId,
        customerInvoicedCents: 120000, // $1,200.00 customer invoiced
        carrierLegs: legs,
      });

      expect(result.isMultiLeg).toBe(true);
      expect(result.legConsolidation).toBeDefined();
      expect(result.legConsolidation?.legCount).toBe(2);
      expect(result.legConsolidation?.totalCarrierSettlementCents).toBe(87000); // $420 + $450 = $870
      expect(result.legConsolidation?.totalLinehaulCents).toBe(73000);
      expect(result.legConsolidation?.totalFuelSurchargeCents).toBe(10500);
      expect(result.legConsolidation?.totalAccessorialCostCents).toBe(3500);

      // Total Carrier Settlement = 87000 cents ($870.00)
      expect(result.carrierSettlementCents).toBe(87000);
      // Realized GP = $1200 - $870 = $330 (33000 cents)
      expect(result.realizedGrossProfitCents).toBe(33000);
      // Realized Margin = (33000 / 120000) * 100 = 27.50%
      expect(result.realizedMarginPercent).toBe(27.5);
      expect(result.healthClassification).toBe('EXCELLENT');
    });
  });

  describe('Margin Variance & Leakage Analysis', () => {
    it('detects margin leakage when realized carrier settlement is higher than quoted cost', () => {
      const result = GrossMarginEngine.calculateGrossProfit({
        tenantId,
        shipmentId,
        quotedCustomerPriceCents: 100000, // $1,000.00 quoted
        quotedCarrierCostCents: 80000,    // $800.00 quoted cost -> $200 quoted GP (20%)
        customerInvoicedCents: 100000,    // $1,000.00 invoiced
        carrierSettlementCents: 87500,    // $875.00 actual settlement -> $125 realized GP (12.5%)
      });

      expect(result.varianceAnalysis).toBeDefined();
      const v = result.varianceAnalysis!;
      expect(v.quotedGrossProfitCents).toBe(20000);
      expect(v.quotedGrossMarginPercent).toBe(20.0);
      expect(v.realizedGrossProfitCents).toBe(12500);
      expect(v.realizedGrossMarginPercent).toBe(12.5);
      expect(v.profitVarianceCents).toBe(-7500); // -$75.00 leakage
      expect(v.marginPercentDelta).toBe(-7.5);
      expect(v.hasProfitLeakage).toBe(true);
      expect(v.leakageDescription).toContain('Margin Leakage Detected: -$75.00');
    });
  });

  describe('Batch Profitability Summary', () => {
    it('evaluates a batch of shipments and computes portfolio aggregate metrics', () => {
      const batch: GrossProfitCalculationInput[] = [
        {
          tenantId,
          shipmentId: 'shp-1',
          customerInvoicedCents: 100000,
          carrierSettlementCents: 75000, // $250 GP (25%) -> EXCELLENT
        },
        {
          tenantId,
          shipmentId: 'shp-2',
          customerInvoicedCents: 150000,
          carrierSettlementCents: 125000, // $250 GP (16.67%) -> HEALTHY
        },
        {
          tenantId,
          shipmentId: 'shp-3',
          customerInvoicedCents: 50000,
          carrierSettlementCents: 52000, // -$20 GP (-4%) -> UNPROFITABLE
        },
      ];

      const summary = GrossMarginEngine.calculateBatchProfitability(batch);

      expect(summary.totalShipments).toBe(3);
      expect(summary.totalCustomerInvoicedCents).toBe(300000);
      expect(summary.totalCarrierSettlementCents).toBe(252000);
      expect(summary.totalRealizedGrossProfitCents).toBe(48000); // $480.00
      expect(summary.portfolioGrossMarginPercent).toBe(16.0); // 48000 / 300000 = 16%
      expect(summary.unprofitableShipmentsCount).toBe(1);
      expect(summary.healthDistribution.EXCELLENT).toBe(1);
      expect(summary.healthDistribution.HEALTHY).toBe(1);
      expect(summary.healthDistribution.UNPROFITABLE).toBe(1);
    });
  });
});
