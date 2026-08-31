import { describe, it, expect } from 'vitest';
import { MarginRulesEngine, PricingEvaluationContext } from '../src/lib/pricing/margin-engine';
import { MarginRule } from '../src/db/schema';
import { CarrierQuoteResult } from '../src/lib/rating/carrier-adapter.interface';

describe('Phase 2.4: Dynamic Broker Margin Rules Engine', () => {
  const tenantId = '01916362-7901-7080-867c-9b8895092a01';
  const customerA = '01916362-7901-7080-867c-9b8895092b01';

  const mockCarrierQuote: CarrierQuoteResult = {
    carrierCode: 'XPO',
    carrierName: 'XPO Logistics',
    carrierScac: 'CNWY',
    accountType: 'DIRECT_BYOC',
    sourceTag: '[DIRECT: XPO #123]',
    quoteNumber: 'XPO-1001',
    linehaulCostCents: 50000, // $500.00
    fuelSurchargeCents: 14500, // $145.00
    accessorialCostCents: 7500, // $75.00
    accessorialBreakdown: { LIFTGATE_DELIVERY: 7500 },
    totalCostCents: 72000, // $720.00
    transitDays: 3,
    isGuaranteed: false,
    timestamp: new Date().toISOString(),
  };

  const sampleRules: MarginRule[] = [
    // 1. Customer Contract Rule (12% margin) - Priority 1
    {
      id: 'rule-customer-1',
      tenantId,
      name: 'Key Account Customer A 12% Contract',
      ruleType: 'CUSTOMER_CONTRACT',
      priority: 1,
      customerId: customerA,
      originState: null,
      destState: null,
      minWeightLbs: null,
      maxWeightLbs: null,
      marginPercentage: 12.0,
      flatMarkupCents: 0,
      minimumGrossProfitFloorCents: 7500,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    // 2. Lane-Specific Rule (CA -> TX = 18%) - Priority 2
    {
      id: 'rule-lane-ca-tx',
      tenantId,
      name: 'CA to TX Outbound Lane 18%',
      ruleType: 'LANE',
      priority: 2,
      customerId: null,
      originState: 'CA',
      destState: 'TX',
      minWeightLbs: null,
      maxWeightLbs: null,
      marginPercentage: 18.0,
      flatMarkupCents: 1000, // +$10 flat fee
      minimumGrossProfitFloorCents: 7500,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    // 3. Weight-Tier Rule (Heavy load >= 5000 lbs = 10%) - Priority 3
    {
      id: 'rule-weight-heavy',
      tenantId,
      name: 'Heavy Volume Freight >= 5000 lbs 10%',
      ruleType: 'WEIGHT_TIER',
      priority: 3,
      customerId: null,
      originState: null,
      destState: null,
      minWeightLbs: 5000,
      maxWeightLbs: null,
      marginPercentage: 10.0,
      flatMarkupCents: 0,
      minimumGrossProfitFloorCents: 7500,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    // 4. Global Default (15%) - Priority 4
    {
      id: 'rule-global-default',
      tenantId,
      name: 'Global Default 15%',
      ruleType: 'GLOBAL_DEFAULT',
      priority: 4,
      customerId: null,
      originState: null,
      destState: null,
      minWeightLbs: null,
      maxWeightLbs: null,
      marginPercentage: 15.0,
      flatMarkupCents: 0,
      minimumGrossProfitFloorCents: 7500,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  it('evaluates rule hierarchy with strict priority: Customer Contract overrides Lane and Global', () => {
    const context: PricingEvaluationContext = {
      tenantId,
      customerId: customerA, // Matches Customer A
      originState: 'CA',
      destState: 'TX',       // Matches CA -> TX lane as well
      totalWeightLbs: 6000,  // Matches Heavy tier as well
    };

    const pricing = MarginRulesEngine.calculatePricing(mockCarrierQuote, context, sampleRules);

    // Customer contract (Priority 1) MUST win
    expect(pricing.matchedRuleType).toBe('CUSTOMER_CONTRACT');
    expect(pricing.appliedMarginPercent).toBe(12.0);
    // Cost = $720.00. 12% markup = $86.40 (8640 cents). Quoted price = $806.40 (80640 cents)
    expect(pricing.grossProfitCents).toBe(8640);
    expect(pricing.quotedCustomerPriceCents).toBe(72000 + 8640);
  });

  it('evaluates Lane-Specific rules when no customer contract exists', () => {
    const context: PricingEvaluationContext = {
      tenantId,
      customerId: null,
      originState: 'CA',
      destState: 'TX',
      totalWeightLbs: 2000,
    };

    const pricing = MarginRulesEngine.calculatePricing(mockCarrierQuote, context, sampleRules);

    expect(pricing.matchedRuleType).toBe('LANE');
    expect(pricing.appliedMarginPercent).toBe(18.0);
    // 18% of $720.00 = $129.60 + $10 flat fee = $139.60 (13960 cents)
    expect(pricing.grossProfitCents).toBe(13960);
    expect(pricing.quotedCustomerPriceCents).toBe(72000 + 13960);
  });

  it('evaluates Weight-Tier rules when neither customer contract nor lane matches', () => {
    const context: PricingEvaluationContext = {
      tenantId,
      customerId: null,
      originState: 'IL',
      destState: 'NY',
      totalWeightLbs: 5500, // Heavy tier
    };

    const pricing = MarginRulesEngine.calculatePricing(mockCarrierQuote, context, sampleRules);

    expect(pricing.matchedRuleType).toBe('WEIGHT_TIER');
    expect(pricing.appliedMarginPercent).toBe(10.0);
    // 10% of $720.00 = $72.00. But Minimum Profit Floor is $75.00!
    expect(pricing.isProfitFloorApplied).toBe(true);
    expect(pricing.grossProfitCents).toBe(7500); // Enforced $75 floor
    expect(pricing.quotedCustomerPriceCents).toBe(72000 + 7500);
  });

  it('falls back to Global Default margin when no specific rules match', () => {
    const context: PricingEvaluationContext = {
      tenantId,
      customerId: null,
      originState: 'OH',
      destState: 'FL',
      totalWeightLbs: 1500,
    };

    const pricing = MarginRulesEngine.calculatePricing(mockCarrierQuote, context, sampleRules);

    expect(pricing.matchedRuleType).toBe('GLOBAL_DEFAULT');
    expect(pricing.appliedMarginPercent).toBe(15.0);
    // 15% of $720.00 = $108.00 (10800 cents)
    expect(pricing.grossProfitCents).toBe(10800);
    expect(pricing.quotedCustomerPriceCents).toBe(72000 + 10800);
  });

  it('strictly enforces Minimum Gross Profit Floor ($75.00) on low-cost minimum charge shipments', () => {
    const lowCostQuote: CarrierQuoteResult = {
      ...mockCarrierQuote,
      totalCostCents: 15000, // $150.00 minimum charge load
    };

    const context: PricingEvaluationContext = {
      tenantId,
      customerId: null,
      originState: 'GA',
      destState: 'SC',
      totalWeightLbs: 300,
    };

    const pricing = MarginRulesEngine.calculatePricing(lowCostQuote, context, sampleRules);

    // 15% of $150.00 is only $22.50. Floor forces $75.00 gross profit
    expect(pricing.isProfitFloorApplied).toBe(true);
    expect(pricing.grossProfitCents).toBe(7500);
    expect(pricing.quotedCustomerPriceCents).toBe(15000 + 7500); // $225.00
  });
});
