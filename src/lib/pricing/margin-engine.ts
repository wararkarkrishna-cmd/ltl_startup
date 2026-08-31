import { MarginRule, Quote } from '../../db/schema';
import { CarrierQuoteResult } from '../rating/carrier-adapter.interface';

export interface PricingEvaluationContext {
  tenantId: string;
  customerId?: string | null;
  originState: string;
  destState: string;
  totalWeightLbs: number;
}

export interface CalculatedCustomerPricing {
  carrierCostCents: number;
  linehaulCostCents: number;
  fuelSurchargeCents: number;
  accessorialCostCents: number;
  appliedMarginPercent: number; // e.g. 15.0 for 15%
  appliedMarginAmountCents: number;
  flatMarkupCents: number;
  minimumProfitFloorCents: number;
  quotedCustomerPriceCents: number;
  grossProfitCents: number;
  grossMarginPercent: number; // Gross profit / Quoted price (e.g. 13.04%)
  matchedRuleId: string;
  matchedRuleType: 'CUSTOMER_CONTRACT' | 'LANE' | 'WEIGHT_TIER' | 'GLOBAL_DEFAULT';
  matchedRuleName: string;
  isProfitFloorApplied: boolean;
}

export class MarginRulesEngine {
  public static readonly DEFAULT_GLOBAL_MARGIN_PERCENT = 15.0; // 15%
  public static readonly DEFAULT_MINIMUM_GROSS_PROFIT_FLOOR_CENTS = 7500; // $75.00

  /**
   * Find the highest-precedence active margin rule for a given context:
   * 1. Customer-Specific Contract Rate (Priority 1)
   * 2. Lane-Specific Rules (Priority 2)
   * 3. Weight-Tier Rules (Priority 3)
   * 4. Global Default Margin (Priority 4)
   */
  public static selectApplicableRule(
    context: PricingEvaluationContext,
    activeRules: MarginRule[]
  ): MarginRule {
    // Rules should be pre-sorted by priority ascending (1 to 4)
    const sortedRules = [...activeRules].sort((a, b) => a.priority - b.priority);

    // 1. Customer Contract Rate Match
    if (context.customerId) {
      const customerRule = sortedRules.find(
        (r) => r.isActive && r.ruleType === 'CUSTOMER_CONTRACT' && r.customerId === context.customerId
      );
      if (customerRule) return customerRule;
    }

    // 2. Lane-Specific Match (Origin State -> Dest State)
    const laneRule = sortedRules.find(
      (r) =>
        r.isActive &&
        r.ruleType === 'LANE' &&
        r.originState?.toUpperCase() === context.originState.toUpperCase() &&
        r.destState?.toUpperCase() === context.destState.toUpperCase()
    );
    if (laneRule) return laneRule;

    // 3. Weight Tier Match
    const weightRule = sortedRules.find((r) => {
      if (!r.isActive || r.ruleType !== 'WEIGHT_TIER') return false;
      const min = r.minWeightLbs ?? 0;
      const max = r.maxWeightLbs ?? Infinity;
      return context.totalWeightLbs >= min && context.totalWeightLbs <= max;
    });
    if (weightRule) return weightRule;

    // 4. Global Account Baseline Margin Match
    const globalRule = sortedRules.find((r) => r.isActive && r.ruleType === 'GLOBAL_DEFAULT');
    if (globalRule) return globalRule;

    // Default Fallback Rule if no rules configured in DB
    return {
      id: 'default-fallback-margin-rule',
      tenantId: context.tenantId,
      name: 'Global Default Baseline Margin (15% / $75 Min)',
      ruleType: 'GLOBAL_DEFAULT',
      priority: 4,
      customerId: null,
      originState: null,
      destState: null,
      minWeightLbs: null,
      maxWeightLbs: null,
      marginPercentage: this.DEFAULT_GLOBAL_MARGIN_PERCENT,
      flatMarkupCents: 0,
      minimumGrossProfitFloorCents: this.DEFAULT_MINIMUM_GROSS_PROFIT_FLOOR_CENTS,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  /**
   * Apply Margin Rules to a Raw Carrier Cost
   * Formula: QuotedPrice = max(Cost * (1 + MarginPct) + FlatFee, Cost + MinimumProfitFloor)
   */
  public static calculatePricing(
    carrierQuote: CarrierQuoteResult,
    context: PricingEvaluationContext,
    activeRules: MarginRule[] = []
  ): CalculatedCustomerPricing {
    const rule = this.selectApplicableRule(context, activeRules);

    const cost = carrierQuote.totalCostCents;
    const marginPct = rule.marginPercentage / 100.0;
    const flatMarkup = rule.flatMarkupCents || 0;
    const floorCents = rule.minimumGrossProfitFloorCents ?? this.DEFAULT_MINIMUM_GROSS_PROFIT_FLOOR_CENTS;

    // Raw calculated markup
    const percentageMarkupCents = Math.round(cost * marginPct);
    const standardQuotedPrice = cost + percentageMarkupCents + flatMarkup;
    const floorQuotedPrice = cost + floorCents;

    const isProfitFloorApplied = standardQuotedPrice < floorQuotedPrice;
    const quotedCustomerPriceCents = Math.max(standardQuotedPrice, floorQuotedPrice);

    const grossProfitCents = quotedCustomerPriceCents - cost;
    const grossMarginPercent =
      quotedCustomerPriceCents > 0
        ? parseFloat(((grossProfitCents / quotedCustomerPriceCents) * 100).toFixed(2))
        : 0;

    return {
      carrierCostCents: cost,
      linehaulCostCents: carrierQuote.linehaulCostCents,
      fuelSurchargeCents: carrierQuote.fuelSurchargeCents,
      accessorialCostCents: carrierQuote.accessorialCostCents,
      appliedMarginPercent: rule.marginPercentage,
      appliedMarginAmountCents: grossProfitCents,
      flatMarkupCents: flatMarkup,
      minimumProfitFloorCents: floorCents,
      quotedCustomerPriceCents,
      grossProfitCents,
      grossMarginPercent,
      matchedRuleId: rule.id,
      matchedRuleType: rule.ruleType,
      matchedRuleName: rule.name,
      isProfitFloorApplied,
    };
  }

  /**
   * Price a list of Carrier Quotes into fully margin-applied Customer Quotes
   */
  public static priceCarrierQuotes(
    carrierQuotes: CarrierQuoteResult[],
    context: PricingEvaluationContext,
    activeRules: MarginRule[] = []
  ): Array<CarrierQuoteResult & { pricing: CalculatedCustomerPricing }> {
    return carrierQuotes.map((q) => {
      const pricing = this.calculatePricing(q, context, activeRules);
      return {
        ...q,
        pricing,
      };
    });
  }
}
