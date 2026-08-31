import { z } from 'zod';
import { dbClient } from '../../db/client';
import { CommissionRecord, CommissionStatus, SalesRep } from '../../db/schema';
import { GrossMarginEngine } from './gross-margin-engine';

// ============================================================================
// CONSTANTS & SCHEMAS
// ============================================================================

export const DEFAULT_MONTHLY_PROFIT_QUOTA_CENTS = 1000000; // $10,000.00 standard quota

/**
 * Standard 3-Tier Commission Schedule
 * - Tier 1: Margin < 10.0%       -> 5.0% commission on GP
 * - Tier 2: Margin 10.0% - 15.0% -> 8.0% commission on GP
 * - Tier 3: Margin > 15.0%       -> 12.0% commission on GP
 */
export interface CommissionTier {
  tierId: string;
  name: string;
  minMarginPercent: number;
  maxMarginPercent: number | null; // null for unbounded top tier
  commissionPercent: number;
}

export const DEFAULT_COMMISSION_TIERS: CommissionTier[] = [
  {
    tierId: 'TIER_1_LOW_MARGIN',
    name: 'Tier 1 (Sub-10% Margin)',
    minMarginPercent: 0,
    maxMarginPercent: 10.0,
    commissionPercent: 5.0,
  },
  {
    tierId: 'TIER_2_STANDARD_MARGIN',
    name: 'Tier 2 (10% - 15% Margin)',
    minMarginPercent: 10.0,
    maxMarginPercent: 15.0,
    commissionPercent: 8.0,
  },
  {
    tierId: 'TIER_3_HIGH_MARGIN',
    name: 'Tier 3 (Above 15% Margin)',
    minMarginPercent: 15.0,
    maxMarginPercent: null,
    commissionPercent: 12.0,
  },
];

/**
 * Sales Rep Quota Progress Summary
 */
export interface SalesQuotaProgress {
  salesRepId: string;
  repName: string;
  targetMonth: string; // YYYY-MM
  monthlyProfitQuotaCents: number;
  realizedGrossProfitCents: number;
  totalCommissionEarnedCents: number;
  quotaPercentAchieved: number;
  isQuotaMet: boolean;
  remainingToQuotaCents: number;
  shipmentCount: number;
}

/**
 * Commission Calculation Input Schema
 */
export const CalculateCommissionParamsSchema = z.object({
  tenantId: z.string().min(1),
  shipmentId: z.string().min(1),
  invoiceId: z.string().optional().nullable(),
  salesRepId: z.string().min(1),
  customerInvoicedCents: z.number().int().nonnegative(),
  carrierSettlementCents: z.number().int().nonnegative(),
  customTiers: z
    .array(
      z.object({
        tierId: z.string(),
        name: z.string(),
        minMarginPercent: z.number(),
        maxMarginPercent: z.number().nullable(),
        commissionPercent: z.number().nonnegative(),
      })
    )
    .optional(),
  enableQuotaAccelerator: z.boolean().optional().default(false),
  quotaAcceleratorBonusPercent: z.number().nonnegative().optional().default(2.0), // +2% bonus after quota
  asOfDate: z.string().optional(), // YYYY-MM-DD
  persist: z.boolean().optional().default(true),
  notes: z.string().optional().nullable(),
});
export type CalculateCommissionParams = z.input<typeof CalculateCommissionParamsSchema>;

/**
 * Commission Calculation Output Result
 */
export interface CommissionCalculationResult {
  record: CommissionRecord;
  salesRep: SalesRep | null;
  matchedTier: CommissionTier;
  baseCommissionPercent: number;
  acceleratorBonusPercent: number;
  appliedCommissionPercent: number;
  realizedGrossProfitCents: number;
  realizedMarginPercent: number;
  commissionEarnedCents: number;
  isUnprofitable: boolean;
  quotaProgress: SalesQuotaProgress;
}

/**
 * Rep Commission Statement for a Period
 */
export interface RepCommissionStatement {
  tenantId: string;
  salesRepId: string;
  repName: string;
  periodMonth: string;
  totalInvoicedCents: number;
  totalCarrierSettlementCents: number;
  totalGrossProfitCents: number;
  totalCommissionEarnedCents: number;
  averageMarginPercent: number;
  quotaSummary: SalesQuotaProgress;
  commissionRecords: CommissionRecord[];
}

// ============================================================================
// COMMISSION CALCULATOR ENGINE IMPLEMENTATION
// ============================================================================

export class CommissionCalculator {
  /**
   * Helper: Match realized margin percentage to the appropriate commission tier
   */
  public static matchCommissionTier(
    realizedMarginPercent: number,
    tiers: CommissionTier[] = DEFAULT_COMMISSION_TIERS
  ): CommissionTier {
    // If negative margin, return lowest tier with 0 or fallback
    if (realizedMarginPercent <= 0) {
      return (
        tiers[0] || {
          tierId: 'TIER_UNPROFITABLE',
          name: 'Unprofitable / Zero Tier',
          minMarginPercent: 0,
          maxMarginPercent: 0,
          commissionPercent: 0,
        }
      );
    }

    // Evaluate tiers in order
    for (const tier of tiers) {
      const minOk = realizedMarginPercent >= tier.minMarginPercent;
      const maxOk = tier.maxMarginPercent === null || realizedMarginPercent <= tier.maxMarginPercent;
      if (minOk && maxOk) {
        return tier;
      }
    }

    // Default fallback to highest tier if margin exceeds highest upper bound
    return tiers[tiers.length - 1];
  }

  /**
   * Tracks monthly gross profit progress against the sales rep's monthly quota
   */
  public static async getMonthlyQuotaProgress(
    tenantId: string,
    salesRepId: string,
    asOfMonth?: string
  ): Promise<SalesQuotaProgress> {
    dbClient.setTenantContext(tenantId);

    const rep = await dbClient.getSalesRepById(salesRepId);
    const targetMonth = asOfMonth || new Date().toISOString().slice(0, 7); // 'YYYY-MM'
    const monthlyQuotaCents = rep?.monthlyProfitQuotaCents ?? DEFAULT_MONTHLY_PROFIT_QUOTA_CENTS;

    // Fetch existing commission records for this sales rep in the target month
    const allRepRecords = await dbClient.getCommissionRecordsByRep(tenantId, salesRepId);
    const monthRecords = allRepRecords.filter((rec) => {
      const recDate = rec.createdAt.toISOString().slice(0, 7);
      return recDate === targetMonth && rec.status !== 'CLAWED_BACK';
    });

    let realizedGrossProfitCents = 0;
    let totalCommissionEarnedCents = 0;

    for (const r of monthRecords) {
      realizedGrossProfitCents += r.realizedGrossProfitCents;
      totalCommissionEarnedCents += r.commissionEarnedCents;
    }

    const quotaPercentAchieved =
      monthlyQuotaCents > 0
        ? Math.round((realizedGrossProfitCents / monthlyQuotaCents) * 10000) / 100
        : 100.0;

    const isQuotaMet = realizedGrossProfitCents >= monthlyQuotaCents;
    const remainingToQuotaCents = Math.max(0, monthlyQuotaCents - realizedGrossProfitCents);

    return {
      salesRepId,
      repName: rep?.name || 'Broker Sales Rep',
      targetMonth,
      monthlyProfitQuotaCents: monthlyQuotaCents,
      realizedGrossProfitCents,
      totalCommissionEarnedCents,
      quotaPercentAchieved,
      isQuotaMet,
      remainingToQuotaCents,
      shipmentCount: monthRecords.length,
    };
  }

  /**
   * Calculates exact integer cents sales commission for a shipment / invoice,
   * applies dynamic tier logic, quota accelerators, and persists the record.
   */
  public static async calculateCommission(
    params: CalculateCommissionParams
  ): Promise<CommissionCalculationResult> {
    const validated = CalculateCommissionParamsSchema.parse(params);
    dbClient.setTenantContext(validated.tenantId);

    // 1. Calculate Realized Gross Profit & Margin % via GrossMarginEngine
    const profitResult = GrossMarginEngine.calculateGrossProfit({
      tenantId: validated.tenantId,
      shipmentId: validated.shipmentId,
      customerInvoicedCents: validated.customerInvoicedCents,
      carrierSettlementCents: validated.carrierSettlementCents,
    });

    const realizedGP = profitResult.realizedGrossProfitCents;
    const realizedMarginPercent = profitResult.realizedMarginPercent;
    const isUnprofitable = realizedGP <= 0;

    // 2. Fetch Sales Rep Profile
    const salesRep = await dbClient.getSalesRepById(validated.salesRepId);

    // 3. Determine Applicable Commission Tiers (Custom override vs Standard Default)
    const tiers = validated.customTiers || DEFAULT_COMMISSION_TIERS;
    const matchedTier = this.matchCommissionTier(realizedMarginPercent, tiers);

    let baseCommissionPercent = matchedTier.commissionPercent;

    // If rep has specific baseCommissionPercent and no custom tiers were passed,
    // we use tier logic but allow custom tiers override.
    let appliedCommissionPercent = isUnprofitable ? 0 : baseCommissionPercent;
    let acceleratorBonusPercent = 0;

    // 4. Evaluate Quota Progress & Accelerator
    const asOfMonth = validated.asOfDate ? validated.asOfDate.slice(0, 7) : new Date().toISOString().slice(0, 7);
    const quotaProgress = await this.getMonthlyQuotaProgress(validated.tenantId, validated.salesRepId, asOfMonth);

    if (validated.enableQuotaAccelerator && quotaProgress.isQuotaMet && !isUnprofitable) {
      acceleratorBonusPercent = validated.quotaAcceleratorBonusPercent;
      appliedCommissionPercent += acceleratorBonusPercent;
    }

    // 5. Compute Exact Commission in Integer Cents:
    // Commission = Realized GP * (Applied Commission % / 100)
    let commissionEarnedCents = 0;
    if (!isUnprofitable && appliedCommissionPercent > 0) {
      commissionEarnedCents = Math.round((realizedGP * appliedCommissionPercent) / 100);
    }

    // 6. Build Notes
    let notes = validated.notes || null;
    if (isUnprofitable) {
      notes = notes ? `${notes} | Zero commission: load is unprofitable/breakeven` : 'Zero commission: load is unprofitable/breakeven';
    } else if (acceleratorBonusPercent > 0) {
      notes = notes
        ? `${notes} | Includes +${acceleratorBonusPercent}% quota accelerator bonus`
        : `Includes +${acceleratorBonusPercent}% quota accelerator bonus (quota met)`;
    }

    // 7. Persist Commission Record to Database
    let record: CommissionRecord;
    if (validated.persist) {
      record = await dbClient.insertCommissionRecord({
        tenantId: validated.tenantId,
        shipmentId: validated.shipmentId,
        invoiceId: validated.invoiceId || null,
        salesRepId: validated.salesRepId,
        customerInvoicedCents: validated.customerInvoicedCents,
        carrierSettlementCents: validated.carrierSettlementCents,
        realizedGrossProfitCents: realizedGP,
        realizedMarginPercent,
        appliedCommissionPercent,
        commissionEarnedCents,
        status: 'ACCRUED',
        notes,
        paidAt: null,
      });
    } else {
      // Ephemeral mock record for previewing calculation
      record = {
        id: '00000000-0000-0000-0000-000000000000',
        tenantId: validated.tenantId,
        shipmentId: validated.shipmentId,
        invoiceId: validated.invoiceId || null,
        salesRepId: validated.salesRepId,
        customerInvoicedCents: validated.customerInvoicedCents,
        carrierSettlementCents: validated.carrierSettlementCents,
        realizedGrossProfitCents: realizedGP,
        realizedMarginPercent,
        appliedCommissionPercent,
        commissionEarnedCents,
        status: 'ACCRUED',
        notes,
        paidAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    }

    return {
      record,
      salesRep,
      matchedTier,
      baseCommissionPercent,
      acceleratorBonusPercent,
      appliedCommissionPercent,
      realizedGrossProfitCents: realizedGP,
      realizedMarginPercent,
      commissionEarnedCents,
      isUnprofitable,
      quotaProgress,
    };
  }

  /**
   * Generates a comprehensive monthly commission statement for a sales rep
   */
  public static async getRepCommissionStatement(
    tenantId: string,
    salesRepId: string,
    periodMonth?: string
  ): Promise<RepCommissionStatement> {
    dbClient.setTenantContext(tenantId);

    const rep = await dbClient.getSalesRepById(salesRepId);
    const month = periodMonth || new Date().toISOString().slice(0, 7);
    const quotaSummary = await this.getMonthlyQuotaProgress(tenantId, salesRepId, month);

    const allRepRecords = await dbClient.getCommissionRecordsByRep(tenantId, salesRepId);
    const monthRecords = allRepRecords.filter((rec) => {
      const recMonth = rec.createdAt.toISOString().slice(0, 7);
      return recMonth === month;
    });

    let totalInvoicedCents = 0;
    let totalCarrierSettlementCents = 0;
    let totalGrossProfitCents = 0;
    let totalCommissionEarnedCents = 0;

    for (const r of monthRecords) {
      totalInvoicedCents += r.customerInvoicedCents;
      totalCarrierSettlementCents += r.carrierSettlementCents;
      totalGrossProfitCents += r.realizedGrossProfitCents;
      totalCommissionEarnedCents += r.commissionEarnedCents;
    }

    let averageMarginPercent = 0;
    if (totalInvoicedCents > 0) {
      averageMarginPercent = Math.round((totalGrossProfitCents / totalInvoicedCents) * 10000) / 100;
    }

    return {
      tenantId,
      salesRepId,
      repName: rep?.name || 'Broker Sales Rep',
      periodMonth: month,
      totalInvoicedCents,
      totalCarrierSettlementCents,
      totalGrossProfitCents,
      totalCommissionEarnedCents,
      averageMarginPercent,
      quotaSummary,
      commissionRecords: monthRecords,
    };
  }

  /**
   * Updates commission status (e.g. APPROVED, PAID, CLAWED_BACK)
   */
  public static async updateCommissionStatus(
    tenantId: string,
    commissionId: string,
    status: CommissionStatus,
    notes?: string
  ): Promise<CommissionRecord> {
    dbClient.setTenantContext(tenantId);

    const record = dbClient.commissionRecords.get(commissionId);
    if (!record || record.tenantId !== tenantId) {
      throw new Error(`Commission record with ID ${commissionId} not found.`);
    }

    record.status = status;
    record.updatedAt = new Date();
    if (notes) {
      record.notes = record.notes ? `${record.notes} | ${notes}` : notes;
    }
    if (status === 'PAID') {
      record.paidAt = new Date();
    }

    dbClient.commissionRecords.set(commissionId, record);
    return record;
  }
}
