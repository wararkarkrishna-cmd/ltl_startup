import { z } from 'zod';
import { dbClient } from '../../db/client';
import {
  DiscrepancyType,
  DISCREPANCY_TYPES,
  CarrierInvoice,
  CarrierDispute,
  DiscrepancyRecord,
} from '../../db/schema';

// ============================================================================
// SCHEMAS & TYPES FOR CARRIER BILLING SCORECARD
// ============================================================================

export const CategoryDiscrepancyMetricSchema = z.object({
  category: z.string(),
  frequency: z.number().int().nonnegative(),
  count: z.number().int().nonnegative(),
  totalOverchargeCents: z.number().int().nonnegative(),
  recoveredCents: z.number().int().nonnegative(),
  winRatePercent: z.number().min(0).max(100),
});
export type CategoryDiscrepancyMetric = z.infer<typeof CategoryDiscrepancyMetricSchema>;

export const CarrierBillingScorecardSchema = z.object({
  tenantId: z.string().uuid(),
  carrierScac: z.string(),
  carrierName: z.string(),
  carrierCode: z.string().optional(),
  timeframeDays: z.number().int().nonnegative(),
  periodStart: z.date(),
  periodEnd: z.date(),
  totalInvoicesBilled: z.number().int().nonnegative(),
  cleanInvoicesCount: z.number().int().nonnegative(),
  disputedInvoicesCount: z.number().int().nonnegative(),
  cleanInvoiceRatePercent: z.number().min(0).max(100),
  totalInvoicedAmountCents: z.number().int().nonnegative(),
  totalOverchargeAttemptedCents: z.number().int().nonnegative(),
  totalCreditsRecoveredCents: z.number().int().nonnegative(),
  disputeWinRatePercent: z.number().min(0).max(100),
  categoryBreakdown: z.record(CategoryDiscrepancyMetricSchema),
  averageResolutionDays: z.number().nonnegative(),
  billingReliabilityScore: z.number().min(0).max(100),
  recommendedRatingPenaltyBps: z.number().int().nonnegative(),
  evaluatedAt: z.date(),
});
export type CarrierBillingScorecard = z.infer<typeof CarrierBillingScorecardSchema>;

// ============================================================================
// CARRIER BILLING ACCURACY & RELIABILITY SCORING ENGINE (PHASE 5.8)
// ============================================================================

export class CarrierScorecardEngine {
  /**
   * Primary target discrepancy categories tracked for carrier billing accuracy
   */
  public static readonly TRACKED_CATEGORIES: DiscrepancyType[] = [
    'UNAUTHORIZED_REWEIGH',
    'RECLASSIFICATION_DISPUTE',
    'BOGUS_ACCESSORIAL',
    'FUEL_INDEX_MISMATCH',
    'DUPLICATE_BILLING',
    'INCORRECT_RATE_BASE',
    'OTHER',
  ];

  /**
   * Generates a comprehensive Carrier Billing Accuracy & Reliability Scorecard
   * for a specific carrier SCAC over a historical timeframe (default: 90 days).
   */
  public static async generateCarrierScorecard(
    tenantId: string,
    carrierScac: string,
    timeframeDays: number = 90
  ): Promise<CarrierBillingScorecard> {
    dbClient.setTenantContext(tenantId);

    const upperScac = (carrierScac || '').trim().toUpperCase();
    const now = new Date();
    const periodStart =
      timeframeDays > 0
        ? new Date(now.getTime() - timeframeDays * 24 * 60 * 60 * 1000)
        : new Date(0);
    const periodEnd = now;

    // 1. Fetch Invoices for tenant & carrier
    const allInvoices = await dbClient.getCarrierInvoices(tenantId);
    const carrierInvoices = allInvoices.filter((inv) => {
      const invScac = (inv.carrierScac || '').trim().toUpperCase();
      const invCode = (inv.carrierCode || '').trim().toUpperCase();
      const matchesCarrier = invScac === upperScac || invCode === upperScac;
      if (!matchesCarrier) return false;

      const invDate = inv.invoiceDate ? new Date(inv.invoiceDate) : new Date(inv.createdAt);
      return timeframeDays === 0 || invDate >= periodStart;
    });

    // 2. Fetch Disputes for tenant & carrier
    const allDisputes = await dbClient.getCarrierDisputes(tenantId);
    const carrierDisputes = allDisputes.filter((d) => {
      const dScac = (d.carrierScac || '').trim().toUpperCase();
      const matchesCarrier = dScac === upperScac;
      if (!matchesCarrier) return false;

      const dDate = d.createdAt ? new Date(d.createdAt) : new Date();
      return timeframeDays === 0 || dDate >= periodStart;
    });

    // 3. Fetch Discrepancy Records for tenant
    const allDiscrepancies = await dbClient.getDiscrepancyRecords(tenantId);
    const invoiceIdSet = new Set(carrierInvoices.map((i) => i.id));
    const carrierDiscrepancies = allDiscrepancies.filter(
      (disc) =>
        invoiceIdSet.has(disc.carrierInvoiceId) ||
        carrierDisputes.some((d) => d.discrepancyId === disc.id)
    );

    // 4. Compute Core Counts
    const totalInvoicesBilled = carrierInvoices.length;
    let cleanInvoicesCount = 0;
    let disputedInvoicesCount = 0;
    let totalInvoicedAmountCents = 0;

    for (const inv of carrierInvoices) {
      totalInvoicedAmountCents +=
        inv.invoicedTotalCents || inv.totalBilledCents || 0;

      if (inv.status === 'AUDITED_CLEAN') {
        cleanInvoicesCount++;
      } else if (
        inv.status === 'DISCREPANCY_FLAGGED' ||
        inv.status === 'DISPUTED' ||
        inv.status === 'SETTLED'
      ) {
        disputedInvoicesCount++;
      } else {
        // If invoice is received or not audited yet, check if discrepancies exist
        const hasDiscrepancy = carrierDiscrepancies.some((d) => d.carrierInvoiceId === inv.id);
        if (hasDiscrepancy) {
          disputedInvoicesCount++;
        } else {
          cleanInvoicesCount++;
        }
      }
    }

    // Clean Invoice Rate %
    const cleanInvoiceRatePercent =
      totalInvoicesBilled > 0
        ? Math.round(((cleanInvoicesCount / totalInvoicesBilled) * 100) * 10) / 10
        : 100.0;

    // 5. Total Overcharge Attempted & Total Credits Recovered
    let totalOverchargeAttemptedCents = 0;
    for (const disc of carrierDiscrepancies) {
      totalOverchargeAttemptedCents +=
        disc.disputableAmountCents ||
        disc.varianceCents ||
        disc.deltaTotalCents ||
        0;
    }

    // If discrepancies weren't recorded individually, derive from disputes
    if (totalOverchargeAttemptedCents === 0) {
      for (const d of carrierDisputes) {
        totalOverchargeAttemptedCents += d.disputedAmountCents || 0;
      }
    }

    let totalCreditsRecoveredCents = 0;
    for (const d of carrierDisputes) {
      totalCreditsRecoveredCents += d.recoveredAmountCents || 0;
    }

    // Dispute Win Rate %
    const disputeWinRatePercent =
      totalOverchargeAttemptedCents > 0
        ? Math.min(
            100,
            Math.round(
              ((totalCreditsRecoveredCents / totalOverchargeAttemptedCents) * 100) * 10
            ) / 10
          )
        : totalCreditsRecoveredCents > 0
        ? 100.0
        : 100.0;

    // 6. Category Breakdown Analysis
    const categoryBreakdown: Record<string, CategoryDiscrepancyMetric> = {};

    for (const cat of this.TRACKED_CATEGORIES) {
      categoryBreakdown[cat] = {
        category: cat,
        frequency: 0,
        count: 0,
        totalOverchargeCents: 0,
        recoveredCents: 0,
        winRatePercent: 0,
      };
    }

    // Accumulate from Discrepancies
    for (const disc of carrierDiscrepancies) {
      const cat = disc.discrepancyType || 'OTHER';
      if (!categoryBreakdown[cat]) {
        categoryBreakdown[cat] = {
          category: cat,
          frequency: 0,
          count: 0,
          totalOverchargeCents: 0,
          recoveredCents: 0,
          winRatePercent: 0,
        };
      }
      const overcharge =
        disc.disputableAmountCents || disc.varianceCents || disc.deltaTotalCents || 0;
      categoryBreakdown[cat].frequency++;
      categoryBreakdown[cat].count++;
      categoryBreakdown[cat].totalOverchargeCents += overcharge;
    }

    // Accumulate Recovered Credits per category from Disputes
    for (const d of carrierDisputes) {
      const cat = (d.disputeType as DiscrepancyType) || 'OTHER';
      if (categoryBreakdown[cat]) {
        categoryBreakdown[cat].recoveredCents += d.recoveredAmountCents || 0;
      }
    }

    // Compute Win Rate per category
    for (const cat of Object.keys(categoryBreakdown)) {
      const metric = categoryBreakdown[cat];
      if (metric.totalOverchargeCents > 0) {
        metric.winRatePercent = Math.min(
          100,
          Math.round(((metric.recoveredCents / metric.totalOverchargeCents) * 100) * 10) / 10
        );
      } else if (metric.recoveredCents > 0) {
        metric.winRatePercent = 100.0;
      }
    }

    // 7. Average Dispute Resolution Days
    let totalResolutionDays = 0;
    let resolvedDisputesCount = 0;

    for (const d of carrierDisputes) {
      if (d.submittedAt && d.resolvedAt) {
        const subDate = new Date(d.submittedAt);
        const resDate = new Date(d.resolvedAt);
        const days = Math.max(0, (resDate.getTime() - subDate.getTime()) / (1000 * 60 * 60 * 24));
        totalResolutionDays += days;
        resolvedDisputesCount++;
      }
    }

    const averageResolutionDays =
      resolvedDisputesCount > 0
        ? Math.round((totalResolutionDays / resolvedDisputesCount) * 10) / 10
        : 0;

    // 8. Billing Reliability Composite Score (0.0 to 100.0)
    // Formula:
    // - 50% weighted on Clean Invoice Rate
    // - 30% weighted on Low Average Overcharge Dollar Size
    // - 20% weighted on Dispute Resolution Velocity
    const billingReliabilityScore = this.calculateReliabilityScore({
      cleanInvoiceRatePercent,
      totalInvoicesBilled,
      totalOverchargeAttemptedCents,
      averageResolutionDays,
    });

    // 9. Recommended Rating Penalty Basis Points (Friction penalty during dispatch ranking)
    // E.g. Carrier with 40% re-bill error rate (60% clean) gets +150 bps friction penalty
    const recommendedRatingPenaltyBps = this.calculateRatingPenaltyBps({
      cleanInvoiceRatePercent,
      totalInvoicesBilled,
      totalOverchargeAttemptedCents,
    });

    // Resolve Carrier Display Name
    const carrierName =
      carrierInvoices[0]?.carrierName ||
      carrierDisputes[0]?.carrierName ||
      upperScac;

    const scorecard: CarrierBillingScorecard = {
      tenantId,
      carrierScac: upperScac,
      carrierName,
      carrierCode: carrierInvoices[0]?.carrierCode || upperScac,
      timeframeDays,
      periodStart,
      periodEnd,
      totalInvoicesBilled,
      cleanInvoicesCount,
      disputedInvoicesCount,
      cleanInvoiceRatePercent,
      totalInvoicedAmountCents,
      totalOverchargeAttemptedCents,
      totalCreditsRecoveredCents,
      disputeWinRatePercent,
      categoryBreakdown,
      averageResolutionDays,
      billingReliabilityScore,
      recommendedRatingPenaltyBps,
      evaluatedAt: now,
    };

    return CarrierBillingScorecardSchema.parse(scorecard);
  }

  /**
   * Generates scorecards for all active carriers with invoices or disputes in the tenant's network
   */
  public static async generateNetworkScorecards(
    tenantId: string,
    timeframeDays: number = 90
  ): Promise<CarrierBillingScorecard[]> {
    dbClient.setTenantContext(tenantId);

    const invoices = await dbClient.getCarrierInvoices(tenantId);
    const disputes = await dbClient.getCarrierDisputes(tenantId);

    const uniqueScacs = new Set<string>();
    for (const inv of invoices) {
      if (inv.carrierScac) uniqueScacs.add(inv.carrierScac.trim().toUpperCase());
    }
    for (const d of disputes) {
      if (d.carrierScac) uniqueScacs.add(d.carrierScac.trim().toUpperCase());
    }

    const scorecards: CarrierBillingScorecard[] = [];
    for (const scac of uniqueScacs) {
      const sc = await this.generateCarrierScorecard(tenantId, scac, timeframeDays);
      scorecards.push(sc);
    }

    // Sort by billingReliabilityScore descending (highest quality carriers first)
    return scorecards.sort((a, b) => b.billingReliabilityScore - a.billingReliabilityScore);
  }

  /**
   * Calculate Composite Billing Reliability Score (0.0 to 100.0)
   */
  public static calculateReliabilityScore(params: {
    cleanInvoiceRatePercent: number;
    totalInvoicesBilled: number;
    totalOverchargeAttemptedCents: number;
    averageResolutionDays: number;
  }): number {
    const {
      cleanInvoiceRatePercent,
      totalInvoicesBilled,
      totalOverchargeAttemptedCents,
      averageResolutionDays,
    } = params;

    // Component 1 (50%): Clean Invoice Rate
    const cleanScore = Math.min(100, Math.max(0, cleanInvoiceRatePercent));
    const cleanWeight = 0.5 * cleanScore;

    // Component 2 (30%): Low Average Overcharge Dollar Size
    // If avg overcharge per invoice is $0 -> 100 score. If $200 (20,000 cents) -> 0 score.
    const avgOverchargeCents =
      totalInvoicesBilled > 0
        ? totalOverchargeAttemptedCents / totalInvoicesBilled
        : 0;
    const overchargeScore = Math.max(0, Math.min(100, 100 - avgOverchargeCents / 200));
    const overchargeWeight = 0.3 * overchargeScore;

    // Component 3 (20%): Dispute Resolution Velocity
    // <= 5 days -> 92.5+, 14 days -> 79, 30 days -> 55, >= 66.7 days -> 0.
    const velocityScore =
      averageResolutionDays <= 0
        ? 100
        : Math.max(0, Math.min(100, 100 - averageResolutionDays * 1.5));
    const velocityWeight = 0.2 * velocityScore;

    const compositeScore = cleanWeight + overchargeWeight + velocityWeight;
    return Math.round(compositeScore * 10) / 10;
  }

  /**
   * Calculate Recommended Routing Penalty Basis Points
   * (e.g. Carrier with 40% re-bill error rate gets +150 bps friction penalty)
   */
  public static calculateRatingPenaltyBps(params: {
    cleanInvoiceRatePercent: number;
    totalInvoicesBilled: number;
    totalOverchargeAttemptedCents: number;
  }): number {
    const { cleanInvoiceRatePercent, totalInvoicesBilled, totalOverchargeAttemptedCents } = params;

    // Error Rate = 100 - Clean Invoice Rate %
    const errorRatePercent = Math.max(0, 100 - cleanInvoiceRatePercent);

    // Base penalty: 40% error rate * 3.75 = 150 bps
    let penaltyBps = Math.round(errorRatePercent * 3.75);

    // Average overcharge severity modifier
    const avgOverchargeCents =
      totalInvoicesBilled > 0
        ? totalOverchargeAttemptedCents / totalInvoicesBilled
        : 0;

    if (avgOverchargeCents > 10000) {
      // High dollar overcharges (>$100 per bill) add +25 bps penalty
      penaltyBps += 25;
    } else if (avgOverchargeCents > 5000) {
      // Moderate dollar overcharges (>$50 per bill) add +10 bps penalty
      penaltyBps += 10;
    }

    // Cap penalty at 500 bps (5.00% rating friction)
    return Math.min(500, Math.max(0, penaltyBps));
  }
}

export const generateCarrierScorecard =
  CarrierScorecardEngine.generateCarrierScorecard.bind(CarrierScorecardEngine);
export const generateNetworkScorecards =
  CarrierScorecardEngine.generateNetworkScorecards.bind(CarrierScorecardEngine);

