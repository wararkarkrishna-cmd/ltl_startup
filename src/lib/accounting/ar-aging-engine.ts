import { z } from 'zod';
import { dbClient } from '../../db/client';
import { ArAgingBucket, CustomerInvoice } from '../../db/schema';

// ============================================================================
// CONSTANTS & SCHEMAS
// ============================================================================

export const BAD_DEBT_RISK_CATEGORIES = ['LOW', 'MODERATE', 'ELEVATED', 'CRITICAL'] as const;
export type BadDebtRiskCategory = (typeof BAD_DEBT_RISK_CATEGORIES)[number];

export interface ArInvoiceAgingItem {
  invoiceId: string;
  invoiceNumber: string;
  customerAccountId: string | null;
  shipperName: string;
  shipperEmail: string;
  totalAmountCents: number;
  invoiceDate: string;
  dueDate: string;
  daysPastDue: number;
  daysSinceIssued: number;
  bucket: ArAgingBucket;
  status: string;
}

export interface ArAgingBucketSummary {
  bucket: ArAgingBucket;
  label: string;
  invoiceCount: number;
  totalAmountCents: number;
  percentageOfTotalAr: number;
  invoices: ArInvoiceAgingItem[];
}

export interface CustomerAccountAgingSummary {
  accountId: string;
  accountName: string;
  contactEmail: string | null;
  contactPhone: string | null;
  creditLimitCents: number;
  totalOutstandingCents: number;
  currentAmountCents: number;
  overdueAmountCents: number;
  creditUtilizationPercent: number;
  maxDaysPastDue: number;
  badDebtRiskScore: number;
  riskCategory: BadDebtRiskCategory;
  isCreditHoldRecommended: boolean;
  openInvoiceCount: number;
  bucketBreakdown: Record<ArAgingBucket, number>; // total cents per bucket
}

export interface ArAgingSummary {
  tenantId: string;
  asOfDate: string; // YYYY-MM-DD
  totalOpenInvoices: number;

  // Portfolio-wide Financial Metrics
  totalArOutstandingCents: number;
  currentTotalCents: number;
  overdueTotalCents: number;
  overduePercentage: number;

  // Portfolio DSO & Risk Metrics
  weightedAverageDsoDays: number;
  weightedAverageDaysPastDue: number;
  badDebtRiskScore: number; // 0 to 100
  badDebtRiskCategory: BadDebtRiskCategory;

  // Aging Buckets Breakdown
  buckets: Record<ArAgingBucket, ArAgingBucketSummary>;

  // Customer Account Summaries
  customerAccounts: CustomerAccountAgingSummary[];

  analyzedAt: Date;
}

// ============================================================================
// AR AGING ENGINE IMPLEMENTATION
// ============================================================================

export class ArAgingEngine {
  /**
   * Helper: Parse YYYY-MM-DD string to UTC Date at midnight
   */
  public static parseDateUtc(dateStr: string): Date {
    const [year, month, day] = dateStr.split('-').map(Number);
    return new Date(Date.UTC(year, month - 1, day));
  }

  /**
   * Helper: Calculate integer difference in days between two YYYY-MM-DD dates (d1 - d2)
   */
  public static diffInDays(dateStr1: string, dateStr2: string): number {
    const d1 = this.parseDateUtc(dateStr1);
    const d2 = this.parseDateUtc(dateStr2);
    const diffMs = d1.getTime() - d2.getTime();
    return Math.floor(diffMs / (1000 * 60 * 60 * 24));
  }

  /**
   * Categorizes days past due into standard AR aging bucket:
   * - CURRENT:          daysPastDue <= 0
   * - PAST_DUE_1_30:    1 <= daysPastDue <= 30
   * - PAST_DUE_31_60:   31 <= daysPastDue <= 60
   * - PAST_DUE_61_90:   61 <= daysPastDue <= 90
   * - PAST_DUE_90_PLUS: daysPastDue > 90
   */
  public static getBucketForDaysPastDue(daysPastDue: number): ArAgingBucket {
    if (daysPastDue <= 0) {
      return 'CURRENT';
    }
    if (daysPastDue <= 30) {
      return 'PAST_DUE_1_30';
    }
    if (daysPastDue <= 60) {
      return 'PAST_DUE_31_60';
    }
    if (daysPastDue <= 90) {
      return 'PAST_DUE_61_90';
    }
    return 'PAST_DUE_90_PLUS';
  }

  /**
   * Human-friendly labels for AR aging buckets
   */
  public static getBucketLabel(bucket: ArAgingBucket): string {
    switch (bucket) {
      case 'CURRENT':
        return 'Current (Not Due)';
      case 'PAST_DUE_1_30':
        return '1 - 30 Days Past Due';
      case 'PAST_DUE_31_60':
        return '31 - 60 Days Past Due';
      case 'PAST_DUE_61_90':
        return '61 - 90 Days Past Due';
      case 'PAST_DUE_90_PLUS':
        return '90+ Days Past Due';
    }
  }

  /**
   * Computes Bad Debt Risk Score (0-100) using weighted bucket proportions:
   * Current: 0 weight
   * 1-30: 10 weight
   * 31-60: 35 weight
   * 61-90: 70 weight
   * 90+: 100 weight
   */
  public static computeBadDebtRiskScore(
    bucketCents: Record<ArAgingBucket, number>,
    totalArCents: number
  ): { score: number; category: BadDebtRiskCategory } {
    if (totalArCents <= 0) {
      return { score: 0, category: 'LOW' };
    }

    const current = bucketCents.CURRENT || 0;
    const p1_30 = bucketCents.PAST_DUE_1_30 || 0;
    const p31_60 = bucketCents.PAST_DUE_31_60 || 0;
    const p61_90 = bucketCents.PAST_DUE_61_90 || 0;
    const p90_plus = bucketCents.PAST_DUE_90_PLUS || 0;

    const weightedScore =
      (current * 0 + p1_30 * 10 + p31_60 * 35 + p61_90 * 70 + p90_plus * 100) / totalArCents;

    const score = Math.min(100, Math.max(0, Math.round(weightedScore * 10) / 10));

    let category: BadDebtRiskCategory = 'LOW';
    if (score > 70) {
      category = 'CRITICAL';
    } else if (score > 45) {
      category = 'ELEVATED';
    } else if (score > 20) {
      category = 'MODERATE';
    }

    return { score, category };
  }

  /**
   * Analyzes accounts receivable aging across the entire tenant portfolio as of a given date.
   */
  public static async analyzeArAging(
    tenantId: string,
    asOfDate?: string
  ): Promise<ArAgingSummary> {
    dbClient.setTenantContext(tenantId);

    const currentDateStr = asOfDate || new Date().toISOString().split('T')[0];

    // Fetch all customer invoices for this tenant
    const allInvoices = await dbClient.getCustomerInvoices(tenantId);

    // Filter open / unpaid invoices (status !== PAID and paidAt is null)
    const openInvoices = allInvoices.filter(
      (inv) => inv.status !== 'PAID' && !inv.paidAt
    );

    // Initialize buckets
    const bucketInvoices: Record<ArAgingBucket, ArInvoiceAgingItem[]> = {
      CURRENT: [],
      PAST_DUE_1_30: [],
      PAST_DUE_31_60: [],
      PAST_DUE_61_90: [],
      PAST_DUE_90_PLUS: [],
    };

    const bucketCents: Record<ArAgingBucket, number> = {
      CURRENT: 0,
      PAST_DUE_1_30: 0,
      PAST_DUE_31_60: 0,
      PAST_DUE_61_90: 0,
      PAST_DUE_90_PLUS: 0,
    };

    let totalArOutstandingCents = 0;
    let overdueTotalCents = 0;
    let cumulativeDsoWeightedDays = 0;
    let cumulativeOverdueWeightedDays = 0;

    // Grouping by Customer Account
    const accountMap = new Map<
      string,
      {
        accountName: string;
        contactEmail: string | null;
        contactPhone: string | null;
        creditLimitCents: number;
        invoices: ArInvoiceAgingItem[];
      }
    >();

    for (const inv of openInvoices) {
      const daysPastDue = this.diffInDays(currentDateStr, inv.dueDate);
      const daysSinceIssued = Math.max(0, this.diffInDays(currentDateStr, inv.invoiceDate));
      const bucket = this.getBucketForDaysPastDue(daysPastDue);

      const item: ArInvoiceAgingItem = {
        invoiceId: inv.id,
        invoiceNumber: inv.invoiceNumber,
        customerAccountId: inv.customerAccountId || null,
        shipperName: inv.shipperName,
        shipperEmail: inv.shipperEmail,
        totalAmountCents: inv.totalAmountCents,
        invoiceDate: inv.invoiceDate,
        dueDate: inv.dueDate,
        daysPastDue,
        daysSinceIssued,
        bucket,
        status: inv.status,
      };

      bucketInvoices[bucket].push(item);
      bucketCents[bucket] += inv.totalAmountCents;
      totalArOutstandingCents += inv.totalAmountCents;

      cumulativeDsoWeightedDays += inv.totalAmountCents * daysSinceIssued;

      if (daysPastDue > 0) {
        overdueTotalCents += inv.totalAmountCents;
        cumulativeOverdueWeightedDays += inv.totalAmountCents * daysPastDue;
      }

      // Group for customer accounts
      const accountKey = inv.customerAccountId || inv.shipperName;
      if (!accountMap.has(accountKey)) {
        let creditLimit = 1000000; // $10,000 default
        let contactEmail = inv.shipperEmail;
        let contactPhone: string | null = null;
        let accountName = inv.shipperName;

        if (inv.customerAccountId) {
          const acc = dbClient.accounts.get(inv.customerAccountId);
          if (acc) {
            creditLimit = acc.creditLimitCents;
            contactEmail = acc.contactEmail || contactEmail;
            contactPhone = acc.contactPhone || null;
            accountName = acc.name || accountName;
          }
        }

        accountMap.set(accountKey, {
          accountName,
          contactEmail,
          contactPhone,
          creditLimitCents: creditLimit,
          invoices: [],
        });
      }

      accountMap.get(accountKey)!.invoices.push(item);
    }

    // Portfolio Metrics Calculation
    const currentTotalCents = bucketCents.CURRENT;
    const overduePercentage =
      totalArOutstandingCents > 0
        ? Math.round((overdueTotalCents / totalArOutstandingCents) * 10000) / 100
        : 0;

    // Weighted Average DSO
    const weightedAverageDsoDays =
      totalArOutstandingCents > 0
        ? Math.round((cumulativeDsoWeightedDays / totalArOutstandingCents) * 10) / 10
        : 0;

    // Weighted Average Days Past Due
    const weightedAverageDaysPastDue =
      overdueTotalCents > 0
        ? Math.round((cumulativeOverdueWeightedDays / overdueTotalCents) * 10) / 10
        : 0;

    // Portfolio Bad Debt Risk Score
    const { score: badDebtRiskScore, category: badDebtRiskCategory } =
      this.computeBadDebtRiskScore(bucketCents, totalArOutstandingCents);

    // Build Buckets Structure
    const buckets: Record<ArAgingBucket, ArAgingBucketSummary> = {
      CURRENT: {
        bucket: 'CURRENT',
        label: this.getBucketLabel('CURRENT'),
        invoiceCount: bucketInvoices.CURRENT.length,
        totalAmountCents: bucketCents.CURRENT,
        percentageOfTotalAr:
          totalArOutstandingCents > 0
            ? Math.round((bucketCents.CURRENT / totalArOutstandingCents) * 10000) / 100
            : 0,
        invoices: bucketInvoices.CURRENT,
      },
      PAST_DUE_1_30: {
        bucket: 'PAST_DUE_1_30',
        label: this.getBucketLabel('PAST_DUE_1_30'),
        invoiceCount: bucketInvoices.PAST_DUE_1_30.length,
        totalAmountCents: bucketCents.PAST_DUE_1_30,
        percentageOfTotalAr:
          totalArOutstandingCents > 0
            ? Math.round((bucketCents.PAST_DUE_1_30 / totalArOutstandingCents) * 10000) / 100
            : 0,
        invoices: bucketInvoices.PAST_DUE_1_30,
      },
      PAST_DUE_31_60: {
        bucket: 'PAST_DUE_31_60',
        label: this.getBucketLabel('PAST_DUE_31_60'),
        invoiceCount: bucketInvoices.PAST_DUE_31_60.length,
        totalAmountCents: bucketCents.PAST_DUE_31_60,
        percentageOfTotalAr:
          totalArOutstandingCents > 0
            ? Math.round((bucketCents.PAST_DUE_31_60 / totalArOutstandingCents) * 10000) / 100
            : 0,
        invoices: bucketInvoices.PAST_DUE_31_60,
      },
      PAST_DUE_61_90: {
        bucket: 'PAST_DUE_61_90',
        label: this.getBucketLabel('PAST_DUE_61_90'),
        invoiceCount: bucketInvoices.PAST_DUE_61_90.length,
        totalAmountCents: bucketCents.PAST_DUE_61_90,
        percentageOfTotalAr:
          totalArOutstandingCents > 0
            ? Math.round((bucketCents.PAST_DUE_61_90 / totalArOutstandingCents) * 10000) / 100
            : 0,
        invoices: bucketInvoices.PAST_DUE_61_90,
      },
      PAST_DUE_90_PLUS: {
        bucket: 'PAST_DUE_90_PLUS',
        label: this.getBucketLabel('PAST_DUE_90_PLUS'),
        invoiceCount: bucketInvoices.PAST_DUE_90_PLUS.length,
        totalAmountCents: bucketCents.PAST_DUE_90_PLUS,
        percentageOfTotalAr:
          totalArOutstandingCents > 0
            ? Math.round((bucketCents.PAST_DUE_90_PLUS / totalArOutstandingCents) * 10000) / 100
            : 0,
        invoices: bucketInvoices.PAST_DUE_90_PLUS,
      },
    };

    // Build Customer Account Summaries
    const customerAccounts: CustomerAccountAgingSummary[] = [];

    for (const [accountKey, accData] of accountMap.entries()) {
      let accTotalCents = 0;
      let accCurrentCents = 0;
      let accOverdueCents = 0;
      let maxDaysPastDue = 0;

      const accBuckets: Record<ArAgingBucket, number> = {
        CURRENT: 0,
        PAST_DUE_1_30: 0,
        PAST_DUE_31_60: 0,
        PAST_DUE_61_90: 0,
        PAST_DUE_90_PLUS: 0,
      };

      for (const inv of accData.invoices) {
        accTotalCents += inv.totalAmountCents;
        accBuckets[inv.bucket] += inv.totalAmountCents;

        if (inv.daysPastDue > maxDaysPastDue) {
          maxDaysPastDue = inv.daysPastDue;
        }

        if (inv.bucket === 'CURRENT') {
          accCurrentCents += inv.totalAmountCents;
        } else {
          accOverdueCents += inv.totalAmountCents;
        }
      }

      const creditUtilPercent =
        accData.creditLimitCents > 0
          ? Math.round((accTotalCents / accData.creditLimitCents) * 10000) / 100
          : 100;

      const { score: accRiskScore, category: accRiskCategory } = this.computeBadDebtRiskScore(
        accBuckets,
        accTotalCents
      );

      // Recommend credit hold if 30+ days overdue or credit limit exceeded by >110%
      const isCreditHoldRecommended =
        maxDaysPastDue >= 30 || creditUtilPercent > 110 || accRiskScore >= 70;

      customerAccounts.push({
        accountId: accountKey,
        accountName: accData.accountName,
        contactEmail: accData.contactEmail,
        contactPhone: accData.contactPhone,
        creditLimitCents: accData.creditLimitCents,
        totalOutstandingCents: accTotalCents,
        currentAmountCents: accCurrentCents,
        overdueAmountCents: accOverdueCents,
        creditUtilizationPercent: creditUtilPercent,
        maxDaysPastDue,
        badDebtRiskScore: accRiskScore,
        riskCategory: accRiskCategory,
        isCreditHoldRecommended,
        openInvoiceCount: accData.invoices.length,
        bucketBreakdown: accBuckets,
      });
    }

    // Sort customer accounts by overdue amount descending
    customerAccounts.sort((a, b) => b.overdueAmountCents - a.overdueAmountCents);

    return {
      tenantId,
      asOfDate: currentDateStr,
      totalOpenInvoices: openInvoices.length,
      totalArOutstandingCents,
      currentTotalCents,
      overdueTotalCents,
      overduePercentage,
      weightedAverageDsoDays,
      weightedAverageDaysPastDue,
      badDebtRiskScore,
      badDebtRiskCategory,
      buckets,
      customerAccounts,
      analyzedAt: new Date(),
    };
  }

  /**
   * Analyzes AR aging specifically for an individual customer account
   */
  public static async analyzeAccountArAging(
    tenantId: string,
    accountId: string,
    asOfDate?: string
  ): Promise<CustomerAccountAgingSummary | null> {
    const portfolioSummary = await this.analyzeArAging(tenantId, asOfDate);
    const matchedAccount = portfolioSummary.customerAccounts.find(
      (acc) => acc.accountId === accountId
    );
    return matchedAccount || null;
  }
}
