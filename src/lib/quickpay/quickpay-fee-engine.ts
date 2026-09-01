import { z } from 'zod';
import { QUICKPAY_TIERS, QuickPayTier, PayoutRail } from '../../db/schema';

export interface QuickPayTierConfig {
  tier: QuickPayTier;
  title: string;
  badge: string;
  defaultFeePercent: number;
  payoutRail: PayoutRail;
  turnaroundDescription: string;
  disclaimer: string;
  iconName: string;
}

export const QUICKPAY_TIER_CONFIGS: Record<QuickPayTier, QuickPayTierConfig> = {
  INSTANT_SAME_DAY: {
    tier: 'INSTANT_SAME_DAY',
    title: 'Instant Same-Day Payout',
    badge: 'FASTEST: < 2 HOURS',
    defaultFeePercent: 2.5,
    payoutRail: 'INSTANT_RTP',
    turnaroundDescription: 'Delivered within 2 hours (FedNow / Real-Time Payments / Debit)',
    disclaimer: 'Funds available in your bank account immediately upon 1-click confirmation.',
    iconName: 'Zap',
  },
  NEXT_DAY_ACH: {
    tier: 'NEXT_DAY_ACH',
    title: 'Next-Day Express ACH',
    badge: 'NEXT MORNING',
    defaultFeePercent: 2.0,
    payoutRail: 'SAME_DAY_ACH',
    turnaroundDescription: 'Settled next business morning by 9:00 AM EST',
    disclaimer: 'Electronic settlement direct to your primary operating account.',
    iconName: 'Clock',
  },
  STANDARD_NET_30: {
    tier: 'STANDARD_NET_30',
    title: 'Standard Net 30 Terms',
    badge: 'ZERO FEE: 30 DAYS',
    defaultFeePercent: 0.0,
    payoutRail: 'STANDARD_ACH',
    turnaroundDescription: 'Standard disbursement in 30 days',
    disclaimer: 'Disbursed according to standard 30-day brokerage payment schedule.',
    iconName: 'Calendar',
  },
};

export const QuickPayCalculationInputSchema = z.object({
  grossAmountCents: z.number().int().positive(),
  customFeePercentOverride: z.number().nonnegative().optional(),
  minimumFeeCents: z.number().int().nonnegative().default(1500), // $15.00 min floor for accelerated tiers
  selectedTier: z.enum(QUICKPAY_TIERS).default('INSTANT_SAME_DAY'),
});

export type QuickPayCalculationInput = z.input<typeof QuickPayCalculationInputSchema>;

export interface QuickPayTierOption {
  tier: QuickPayTier;
  title: string;
  badge: string;
  feePercentage: number;
  grossAmountCents: number;
  feeAmountCents: number;
  netPayoutCents: number;
  grossFormatted: string;
  feeFormatted: string;
  netFormatted: string;
  payoutRail: PayoutRail;
  turnaroundDescription: string;
  disclaimer: string;
  isPopular: boolean;
}

export interface QuickPayCalculationResult {
  grossAmountCents: number;
  selectedTier: QuickPayTier;
  appliedFeePercent: number;
  feeAmountCents: number;
  netPayoutCents: number;
  payoutRail: PayoutRail;
  plainLanguageDisclosure: string;
  tierOptions: QuickPayTierOption[];
}

export class QuickPayFeeEngine {
  /**
   * Formats integer cents to standard USD currency string ($XX.YY)
   */
  public static formatCents(cents: number): string {
    return `$${(cents / 100).toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }

  /**
   * Calculates fee and net payout for a specific tier with exact integer cents math
   */
  public static calculateSingleTier(
    grossAmountCents: number,
    tier: QuickPayTier,
    customFeePercent?: number,
    minimumFeeCents = 1500
  ): { feePercent: number; feeAmountCents: number; netPayoutCents: number } {
    const config = QUICKPAY_TIER_CONFIGS[tier];
    const feePercent = customFeePercent !== undefined ? customFeePercent : config.defaultFeePercent;

    if (feePercent === 0 || tier === 'STANDARD_NET_30') {
      return {
        feePercent: 0,
        feeAmountCents: 0,
        netPayoutCents: grossAmountCents,
      };
    }

    // Exact integer cents calculation with Math.round
    let feeAmountCents = Math.round((grossAmountCents * feePercent) / 100);

    // Apply minimum fee floor for accelerated options if applicable
    if (feeAmountCents > 0 && feeAmountCents < minimumFeeCents) {
      feeAmountCents = minimumFeeCents;
    }

    // Guard: Fee cannot exceed gross amount
    feeAmountCents = Math.min(grossAmountCents, feeAmountCents);
    const netPayoutCents = Math.max(0, grossAmountCents - feeAmountCents);

    return {
      feePercent,
      feeAmountCents,
      netPayoutCents,
    };
  }

  /**
   * Evaluates all 3 QuickPay tiers side-by-side with comparison cards
   */
  public static calculateAllTiers(input: QuickPayCalculationInput): QuickPayCalculationResult {
    const validated = QuickPayCalculationInputSchema.parse(input);
    const gross = validated.grossAmountCents;

    const tierOptions: QuickPayTierOption[] = (
      ['INSTANT_SAME_DAY', 'NEXT_DAY_ACH', 'STANDARD_NET_30'] as QuickPayTier[]
    ).map((tier) => {
      const config = QUICKPAY_TIER_CONFIGS[tier];
      const customOverride = tier === validated.selectedTier ? validated.customFeePercentOverride : undefined;
      const calc = this.calculateSingleTier(gross, tier, customOverride, validated.minimumFeeCents);

      return {
        tier,
        title: config.title,
        badge: config.badge,
        feePercentage: calc.feePercent,
        grossAmountCents: gross,
        feeAmountCents: calc.feeAmountCents,
        netPayoutCents: calc.netPayoutCents,
        grossFormatted: this.formatCents(gross),
        feeFormatted: this.formatCents(calc.feeAmountCents),
        netFormatted: this.formatCents(calc.netPayoutCents),
        payoutRail: config.payoutRail,
        turnaroundDescription: config.turnaroundDescription,
        disclaimer: config.disclaimer,
        isPopular: tier === 'INSTANT_SAME_DAY',
      };
    });

    const selectedOption =
      tierOptions.find((opt) => opt.tier === validated.selectedTier) || tierOptions[0];

    const plainLanguageDisclosure =
      selectedOption.feeAmountCents > 0
        ? `Get paid ${selectedOption.netFormatted} today (${selectedOption.feeFormatted} fee) instead of waiting 30 days for ${selectedOption.grossFormatted}.`
        : `Receive full ${selectedOption.grossFormatted} payment under standard Net 30 terms with zero fee.`;

    return {
      grossAmountCents: gross,
      selectedTier: validated.selectedTier,
      appliedFeePercent: selectedOption.feePercentage,
      feeAmountCents: selectedOption.feeAmountCents,
      netPayoutCents: selectedOption.netPayoutCents,
      payoutRail: selectedOption.payoutRail,
      plainLanguageDisclosure,
      tierOptions,
    };
  }
}
