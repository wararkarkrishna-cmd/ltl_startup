import { z } from 'zod';
import { dbClient } from '../../db/client';

// ============================================================================
// CONSTANTS & SCHEMAS
// ============================================================================

export const MARGIN_HEALTH_LEVELS = [
  'EXCELLENT',    // > 20.0%
  'HEALTHY',      // 12.0% - 20.0%
  'ACCEPTABLE',   // 8.0% - 12.0%
  'MARGINAL',     // 0.0% - 8.0%
  'UNPROFITABLE', // < 0.0%
] as const;
export type MarginHealthClassification = (typeof MARGIN_HEALTH_LEVELS)[number];

export const DEFAULT_MINIMUM_PROFIT_FLOOR_CENTS = 5000; // $50.00 standard floor

/**
 * Multi-Leg Carrier Cost Item (for Split / Multi-Stop Shipments)
 */
export const CarrierSettlementLegSchema = z.object({
  legId: z.string().optional(),
  legSequence: z.number().int().positive().optional().default(1),
  carrierCode: z.string().optional(),
  carrierName: z.string().optional(),
  carrierScac: z.string().optional(),
  proNumber: z.string().optional().nullable(),
  linehaulCents: z.number().int().nonnegative(),
  fuelSurchargeCents: z.number().int().nonnegative().default(0),
  accessorialCostCents: z.number().int().nonnegative().default(0),
  totalCostCents: z.number().int().positive(),
  notes: z.string().optional().nullable(),
});
export type CarrierSettlementLeg = z.infer<typeof CarrierSettlementLegSchema>;

/**
 * Gross Margin Calculation Input Schema
 */
export const GrossProfitCalculationInputSchema = z.object({
  tenantId: z.string().min(1),
  shipmentId: z.string().min(1),
  customerInvoicedCents: z.number().int().nonnegative(),
  carrierSettlementCents: z.number().int().nonnegative().optional(),
  carrierLegs: z.array(CarrierSettlementLegSchema).optional(),
  quotedCustomerPriceCents: z.number().int().nonnegative().optional().nullable(),
  quotedCarrierCostCents: z.number().int().nonnegative().optional().nullable(),
  minimumProfitFloorCents: z.number().int().nonnegative().optional().default(DEFAULT_MINIMUM_PROFIT_FLOOR_CENTS),
  invoiceNumber: z.string().optional().nullable(),
  currency: z.enum(['USD', 'CAD']).default('USD'),
});
export type GrossProfitCalculationInput = z.input<typeof GrossProfitCalculationInputSchema>;

/**
 * Multi-Leg Cost Consolidation Summary
 */
export interface MultiLegConsolidationResult {
  legCount: number;
  totalCarrierSettlementCents: number;
  totalLinehaulCents: number;
  totalFuelSurchargeCents: number;
  totalAccessorialCostCents: number;
  legs: CarrierSettlementLeg[];
}

/**
 * Margin Leakage / Quoted vs Realized Variance Breakdown
 */
export interface MarginVarianceAnalysis {
  quotedCustomerPriceCents: number;
  quotedCarrierCostCents: number;
  quotedGrossProfitCents: number;
  quotedGrossMarginPercent: number;
  realizedGrossProfitCents: number;
  realizedGrossMarginPercent: number;
  profitVarianceCents: number;
  marginPercentDelta: number;
  hasProfitLeakage: boolean;
  leakageDescription: string;
}

/**
 * Realized Profitability Result Output
 */
export interface RealizedProfitabilityResult {
  tenantId: string;
  shipmentId: string;
  invoiceNumber?: string | null;
  currency: 'USD' | 'CAD';

  // Core Financials (Exact Integer Cents)
  customerInvoicedCents: number;
  carrierSettlementCents: number;
  realizedGrossProfitCents: number;
  realizedMarginPercent: number;

  // Margin Health & Floor Compliance
  healthClassification: MarginHealthClassification;
  minimumProfitFloorCents: number;
  isBelowProfitFloor: boolean;
  floorDeficitCents: number;

  // Multi-Leg Cost Details
  isMultiLeg: boolean;
  legConsolidation?: MultiLegConsolidationResult;

  // Variance & Leakage Analysis (if quoted data available)
  varianceAnalysis?: MarginVarianceAnalysis;

  calculatedAt: Date;
}

/**
 * Batch Margin Summary Across Multiple Shipments
 */
export interface BatchProfitabilitySummary {
  totalShipments: number;
  totalCustomerInvoicedCents: number;
  totalCarrierSettlementCents: number;
  totalRealizedGrossProfitCents: number;
  portfolioGrossMarginPercent: number;
  unprofitableShipmentsCount: number;
  belowFloorShipmentsCount: number;
  healthDistribution: Record<MarginHealthClassification, number>;
  shipments: RealizedProfitabilityResult[];
}

// ============================================================================
// GROSS MARGIN ENGINE IMPLEMENTATION
// ============================================================================

export class GrossMarginEngine {
  /**
   * Classifies margin health percentage into standard freight operational tiers:
   * - EXCELLENT:   > 20.0%
   * - HEALTHY:     12.0% - 20.0%
   * - ACCEPTABLE:  8.0% - 12.0%
   * - MARGINAL:    0.0% - 8.0%
   * - UNPROFITABLE: < 0.0%
   */
  public static classifyMarginHealth(marginPercent: number): MarginHealthClassification {
    if (marginPercent > 20.0) {
      return 'EXCELLENT';
    }
    if (marginPercent >= 12.0) {
      return 'HEALTHY';
    }
    if (marginPercent >= 8.0) {
      return 'ACCEPTABLE';
    }
    if (marginPercent >= 0.0) {
      return 'MARGINAL';
    }
    return 'UNPROFITABLE';
  }

  /**
   * Consolidates multi-leg settlement costs for split loads / multi-stop shipments
   * into exact integer sums.
   */
  public static consolidateMultiLegSettlement(legs: CarrierSettlementLeg[]): MultiLegConsolidationResult {
    let totalCarrierSettlementCents = 0;
    let totalLinehaulCents = 0;
    let totalFuelSurchargeCents = 0;
    let totalAccessorialCostCents = 0;

    for (const leg of legs) {
      totalCarrierSettlementCents += leg.totalCostCents;
      totalLinehaulCents += leg.linehaulCents;
      totalFuelSurchargeCents += leg.fuelSurchargeCents;
      totalAccessorialCostCents += leg.accessorialCostCents;
    }

    return {
      legCount: legs.length,
      totalCarrierSettlementCents,
      totalLinehaulCents,
      totalFuelSurchargeCents,
      totalAccessorialCostCents,
      legs,
    };
  }

  /**
   * Computes exact integer cents gross margin realization, profit floor compliance,
   * margin health classification, and optional quote-to-invoice variance analysis.
   */
  public static calculateGrossProfit(input: GrossProfitCalculationInput): RealizedProfitabilityResult {
    const validated = GrossProfitCalculationInputSchema.parse(input);

    // 1. Determine Carrier Settlement Cents (Multi-leg or single carrier settlement)
    let finalCarrierSettlementCents = validated.carrierSettlementCents ?? 0;
    let consolidationResult: MultiLegConsolidationResult | undefined;
    const isMultiLeg = Array.isArray(validated.carrierLegs) && validated.carrierLegs.length > 0;

    if (isMultiLeg && validated.carrierLegs) {
      consolidationResult = this.consolidateMultiLegSettlement(validated.carrierLegs);
      finalCarrierSettlementCents = consolidationResult.totalCarrierSettlementCents;
    }

    const customerInvoicedCents = validated.customerInvoicedCents;

    // 2. Exact Integer Cents Profit Formula:
    // Realized GP = Customer Invoiced Total - Carrier Expected Settlement
    const realizedGrossProfitCents = customerInvoicedCents - finalCarrierSettlementCents;

    // 3. Realized Margin %:
    // Margin % = (Realized GP / Customer Invoiced Total) * 100
    let realizedMarginPercent = 0;
    if (customerInvoicedCents > 0) {
      realizedMarginPercent = Math.round((realizedGrossProfitCents / customerInvoicedCents) * 10000) / 100;
    } else if (finalCarrierSettlementCents > 0) {
      realizedMarginPercent = -100.0;
    }

    // 4. Margin Health Classification
    const healthClassification = this.classifyMarginHealth(realizedMarginPercent);

    // 5. Minimum Profit Floor Validation ($50.00 / 5000 cents standard)
    const floorCents = validated.minimumProfitFloorCents ?? DEFAULT_MINIMUM_PROFIT_FLOOR_CENTS;
    const isBelowProfitFloor = realizedGrossProfitCents < floorCents;
    const floorDeficitCents = Math.max(0, floorCents - realizedGrossProfitCents);

    // 6. Variance & Leakage Analysis (if quoted amounts were provided)
    let varianceAnalysis: MarginVarianceAnalysis | undefined;
    if (
      typeof validated.quotedCustomerPriceCents === 'number' &&
      typeof validated.quotedCarrierCostCents === 'number'
    ) {
      const quotedCustomerPriceCents = validated.quotedCustomerPriceCents;
      const quotedCarrierCostCents = validated.quotedCarrierCostCents;
      const quotedGrossProfitCents = quotedCustomerPriceCents - quotedCarrierCostCents;
      let quotedGrossMarginPercent = 0;
      if (quotedCustomerPriceCents > 0) {
        quotedGrossMarginPercent = Math.round((quotedGrossProfitCents / quotedCustomerPriceCents) * 10000) / 100;
      }

      const realizedGrossMarginPercent = realizedMarginPercent;
      const profitVarianceCents = realizedGrossProfitCents - quotedGrossProfitCents;
      const marginPercentDelta = Math.round((realizedMarginPercent - quotedGrossMarginPercent) * 100) / 100;
      const hasProfitLeakage = profitVarianceCents < 0;

      let leakageDescription = 'Realized margin matches or exceeds original quote.';
      if (hasProfitLeakage) {
        const leakageDollars = (Math.abs(profitVarianceCents) / 100).toFixed(2);
        leakageDescription = `Margin Leakage Detected: -$${leakageDollars} (${marginPercentDelta}% margin drift vs quote).`;
      }

      varianceAnalysis = {
        quotedCustomerPriceCents,
        quotedCarrierCostCents,
        quotedGrossProfitCents,
        quotedGrossMarginPercent,
        realizedGrossProfitCents,
        realizedGrossMarginPercent,
        profitVarianceCents,
        marginPercentDelta,
        hasProfitLeakage,
        leakageDescription,
      };
    }

    return {
      tenantId: validated.tenantId,
      shipmentId: validated.shipmentId,
      invoiceNumber: validated.invoiceNumber,
      currency: validated.currency,
      customerInvoicedCents,
      carrierSettlementCents: finalCarrierSettlementCents,
      realizedGrossProfitCents,
      realizedMarginPercent,
      healthClassification,
      minimumProfitFloorCents: floorCents,
      isBelowProfitFloor,
      floorDeficitCents,
      isMultiLeg,
      legConsolidation: consolidationResult,
      varianceAnalysis,
      calculatedAt: new Date(),
    };
  }

  /**
   * Fetches shipment and invoices from database to evaluate realized profitability
   */
  public static async evaluateShipmentProfitability(
    tenantId: string,
    shipmentId: string,
    customMinimumFloorCents?: number
  ): Promise<RealizedProfitabilityResult> {
    dbClient.setTenantContext(tenantId);

    const shipment = await dbClient.getShipmentById(shipmentId);
    if (!shipment) {
      throw new Error(`Shipment with ID ${shipmentId} not found.`);
    }

    // Retrieve Customer Invoice
    const invoice = await dbClient.getCustomerInvoiceByShipmentId(tenantId, shipmentId);
    const quotes = await dbClient.getQuotesByShipmentId(tenantId, shipmentId);
    const primaryQuote = quotes.find((q) => q.isSelected) || quotes[0];

    // Customer Invoiced Total
    const customerInvoicedCents = invoice?.totalAmountCents ?? primaryQuote?.quotedCustomerPriceCents ?? 0;

    // Carrier Settlement Cost
    const carrierSettlementCents = primaryQuote?.totalCarrierCostCents ?? 0;

    return this.calculateGrossProfit({
      tenantId,
      shipmentId,
      customerInvoicedCents,
      carrierSettlementCents,
      quotedCustomerPriceCents: primaryQuote?.quotedCustomerPriceCents,
      quotedCarrierCostCents: primaryQuote?.totalCarrierCostCents,
      minimumProfitFloorCents: customMinimumFloorCents ?? DEFAULT_MINIMUM_PROFIT_FLOOR_CENTS,
      invoiceNumber: invoice?.invoiceNumber ?? null,
    });
  }

  /**
   * Evaluates a batch of shipments and computes aggregate portfolio gross margin metrics
   */
  public static calculateBatchProfitability(
    shipments: GrossProfitCalculationInput[]
  ): BatchProfitabilitySummary {
    let totalCustomerInvoicedCents = 0;
    let totalCarrierSettlementCents = 0;
    let totalRealizedGrossProfitCents = 0;
    let unprofitableShipmentsCount = 0;
    let belowFloorShipmentsCount = 0;

    const healthDistribution: Record<MarginHealthClassification, number> = {
      EXCELLENT: 0,
      HEALTHY: 0,
      ACCEPTABLE: 0,
      MARGINAL: 0,
      UNPROFITABLE: 0,
    };

    const evaluatedResults: RealizedProfitabilityResult[] = [];

    for (const item of shipments) {
      const result = this.calculateGrossProfit(item);
      evaluatedResults.push(result);

      totalCustomerInvoicedCents += result.customerInvoicedCents;
      totalCarrierSettlementCents += result.carrierSettlementCents;
      totalRealizedGrossProfitCents += result.realizedGrossProfitCents;

      if (result.realizedGrossProfitCents < 0) {
        unprofitableShipmentsCount++;
      }
      if (result.isBelowProfitFloor) {
        belowFloorShipmentsCount++;
      }

      healthDistribution[result.healthClassification]++;
    }

    let portfolioGrossMarginPercent = 0;
    if (totalCustomerInvoicedCents > 0) {
      portfolioGrossMarginPercent =
        Math.round((totalRealizedGrossProfitCents / totalCustomerInvoicedCents) * 10000) / 100;
    }

    return {
      totalShipments: shipments.length,
      totalCustomerInvoicedCents,
      totalCarrierSettlementCents,
      totalRealizedGrossProfitCents,
      portfolioGrossMarginPercent,
      unprofitableShipmentsCount,
      belowFloorShipmentsCount,
      healthDistribution,
      shipments: evaluatedResults,
    };
  }
}
