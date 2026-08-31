import { RateRequest, RateItem, CarrierQuoteResult } from '../rating/carrier-adapter.interface';
import { PlatformRatingEngine } from '../rating/platform-wholesale-engine';
import { MarginRulesEngine, PricingEvaluationContext } from '../pricing/margin-engine';
import { MarginRule } from '../../db/schema';

export interface SubShipmentLeg {
  subShipmentName: 'Sub-Shipment A' | 'Sub-Shipment B';
  items: RateItem[];
  totalPallets: number;
  totalWeightLbs: number;
  selectedCarrier: CarrierQuoteResult;
  carrierPriceCents: number; // Customer price after margin
}

export interface SplitOptimizationResult {
  isSplitFeasible: boolean;
  isRecommended: boolean; // True only if Net Benefit >= $75.00 and Transit Delta <= 1 day
  singleCarrierQuote: CarrierQuoteResult;
  singleCarrierCustomerPriceCents: number;
  subShipmentA?: SubShipmentLeg;
  subShipmentB?: SubShipmentLeg;
  combinedSplitCarrierCostCents: number;
  combinedSplitCustomerPriceCents: number;
  grossSavingsCents: number;
  grossSavingsPercent: number;
  operationalFrictionCents: number;
  frictionBreakdown: {
    extraPickupOverheadCents: number; // $45.00
    transitDeltaDaysPenaltyCents: number; // |TA - TB| * $25.00
    appointmentRiskFactorCents: number; // $20.00
  };
  netSplitBenefitCents: number; // Net Dollar Savings after operational friction buffer
  transitDeltaDays: number;
  plainLanguageHeadline: string;
  plainLanguageExplanation: string;
}

export class CombinatorialSplitOptimizer {
  public static readonly EXTRA_PICKUP_OVERHEAD_CENTS = 4500; // $45.00 dock labor / 2nd BOL
  public static readonly TRANSIT_DELTA_DAY_PENALTY_CENTS = 2500; // $25.00 per day delta
  public static readonly APPOINTMENT_RISK_CENTS = 2000; // $20.00 appointment risk
  public static readonly MINIMUM_NET_BENEFIT_THRESHOLD_CENTS = 7500; // $75.00 threshold
  public static readonly MAX_ALLOWED_TRANSIT_DELTA_DAYS = 1; // max 1 day delta

  /**
   * Partition an item array or multi-pallet item into all non-trivial bipartite splits (S_A, S_B)
   */
  public static generateBipartitePartitions(items: RateItem[]): Array<[RateItem[], RateItem[]]> {
    const totalUnits = items.reduce((sum, it) => sum + (it.quantity || 1), 0);
    if (totalUnits < 2) return [];

    const partitions: Array<[RateItem[], RateItem[]]> = [];

    // Single item with multiple handling units (e.g. 7 pallets)
    if (items.length === 1) {
      const item = items[0];
      const totalQty = item.quantity;
      const unitWeight = item.weightLbs;

      for (let qtyA = 1; qtyA <= Math.floor(totalQty / 2); qtyA++) {
        const qtyB = totalQty - qtyA;
        const subA: RateItem[] = [{ ...item, quantity: qtyA, weightLbs: unitWeight }];
        const subB: RateItem[] = [{ ...item, quantity: qtyB, weightLbs: unitWeight }];
        partitions.push([subA, subB]);
      }
      return partitions;
    }

    // Multiple distinct line items: evaluate binary partition mask
    const n = items.length;
    const maxMask = (1 << n) - 1;

    for (let mask = 1; mask <= Math.floor(maxMask / 2); mask++) {
      const subA: RateItem[] = [];
      const subB: RateItem[] = [];

      for (let i = 0; i < n; i++) {
        if ((mask & (1 << i)) !== 0) {
          subA.push(items[i]);
        } else {
          subB.push(items[i]);
        }
      }

      if (subA.length > 0 && subB.length > 0) {
        partitions.push([subA, subB]);
      }
    }

    return partitions;
  }

  /**
   * Execute Combinatorial Multi-Carrier Split Optimization Algorithm
   */
  public static async optimizeShipment(
    request: Omit<RateRequest, 'accountType'>,
    activeRules: MarginRule[] = []
  ): Promise<SplitOptimizationResult> {
    // 1. Rate Single Carrier Base Shipment
    const singleRating = await PlatformRatingEngine.rateShipmentHybrid(request);
    if (singleRating.quotes.length === 0) {
      throw new Error('Unable to rate shipment: No carrier quotes returned');
    }

    const bestSingleCarrierQuote = singleRating.quotes[0]; // Cheapest single carrier
    const totalWeight = request.items.reduce((s, it) => s + (it.weightLbs || 500) * (it.quantity || 1), 0);
    const pricingCtx: PricingEvaluationContext = {
      tenantId: request.tenantId,
      originState: request.originState,
      destState: request.destState,
      totalWeightLbs: totalWeight,
    };
    const singlePriced = MarginRulesEngine.calculatePricing(bestSingleCarrierQuote, pricingCtx, activeRules);

    const partitions = this.generateBipartitePartitions(request.items);
    if (partitions.length === 0) {
      return {
        isSplitFeasible: false,
        isRecommended: false,
        singleCarrierQuote: bestSingleCarrierQuote,
        singleCarrierCustomerPriceCents: singlePriced.quotedCustomerPriceCents,
        combinedSplitCarrierCostCents: bestSingleCarrierQuote.totalCostCents,
        combinedSplitCustomerPriceCents: singlePriced.quotedCustomerPriceCents,
        grossSavingsCents: 0,
        grossSavingsPercent: 0,
        operationalFrictionCents: 0,
        frictionBreakdown: {
          extraPickupOverheadCents: 0,
          transitDeltaDaysPenaltyCents: 0,
          appointmentRiskFactorCents: 0,
        },
        netSplitBenefitCents: 0,
        transitDeltaDays: 0,
        plainLanguageHeadline: 'Single Carrier Optimal',
        plainLanguageExplanation: 'Shipment has insufficient piece count or cannot be partitioned efficiently.',
      };
    }

    let optimalSplit: {
      subAItems: RateItem[];
      subBItems: RateItem[];
      quoteA: CarrierQuoteResult;
      quoteB: CarrierQuoteResult;
      priceA: number;
      priceB: number;
      combinedCost: number;
      combinedPrice: number;
      netBenefit: number;
      grossSavings: number;
      frictionPenalty: number;
      frictionBreakdown: {
        extraPickupOverheadCents: number;
        transitDeltaDaysPenaltyCents: number;
        appointmentRiskFactorCents: number;
      };
      transitDelta: number;
    } | null = null;

    // 2. Evaluate all bipartite partitions
    for (const [subAItems, subBItems] of partitions) {
      const [resA, resB] = await Promise.all([
        PlatformRatingEngine.rateShipmentHybrid({ ...request, items: subAItems }),
        PlatformRatingEngine.rateShipmentHybrid({ ...request, items: subBItems }),
      ]);

      if (resA.quotes.length === 0 || resB.quotes.length === 0) continue;

      const bestQuoteA = resA.quotes[0];
      const bestQuoteB = resB.quotes[0];

      const wA = subAItems.reduce((s, it) => s + (it.weightLbs || 500) * (it.quantity || 1), 0);
      const wB = subBItems.reduce((s, it) => s + (it.weightLbs || 500) * (it.quantity || 1), 0);

      const priceA = MarginRulesEngine.calculatePricing(bestQuoteA, { ...pricingCtx, totalWeightLbs: wA }, activeRules);
      const priceB = MarginRulesEngine.calculatePricing(bestQuoteB, { ...pricingCtx, totalWeightLbs: wB }, activeRules);

      const combinedCost = bestQuoteA.totalCostCents + bestQuoteB.totalCostCents;
      const combinedPrice = priceA.quotedCustomerPriceCents + priceB.quotedCustomerPriceCents;

      // 3. Operational Friction & Risk Scoring
      const transitDelta = Math.abs(bestQuoteA.transitDays - bestQuoteB.transitDays);
      const hasAppt = request.accessorials.some((a) => a.includes('APPOINTMENT'));

      const extraPickupCents = this.EXTRA_PICKUP_OVERHEAD_CENTS;
      const transitDeltaCents = transitDelta * this.TRANSIT_DELTA_DAY_PENALTY_CENTS;
      const apptRiskCents = hasAppt ? this.APPOINTMENT_RISK_CENTS : 0;
      const frictionPenalty = extraPickupCents + transitDeltaCents + apptRiskCents;

      const grossSavings = singlePriced.quotedCustomerPriceCents - combinedPrice;
      const netBenefit = grossSavings - frictionPenalty;

      if (!optimalSplit || netBenefit > optimalSplit.netBenefit) {
        optimalSplit = {
          subAItems,
          subBItems,
          quoteA: bestQuoteA,
          quoteB: bestQuoteB,
          priceA: priceA.quotedCustomerPriceCents,
          priceB: priceB.quotedCustomerPriceCents,
          combinedCost,
          combinedPrice,
          netBenefit,
          grossSavings,
          frictionPenalty,
          frictionBreakdown: {
            extraPickupOverheadCents: extraPickupCents,
            transitDeltaDaysPenaltyCents: transitDeltaCents,
            appointmentRiskFactorCents: apptRiskCents,
          },
          transitDelta,
        };
      }
    }

    if (!optimalSplit) {
      throw new Error('Split optimization evaluation failed to produce candidates');
    }

    const isRecommended =
      optimalSplit.netBenefit >= this.MINIMUM_NET_BENEFIT_THRESHOLD_CENTS &&
      optimalSplit.transitDelta <= this.MAX_ALLOWED_TRANSIT_DELTA_DAYS;

    const palletsA = optimalSplit.subAItems.reduce((s, it) => s + (it.quantity || 1), 0);
    const palletsB = optimalSplit.subBItems.reduce((s, it) => s + (it.quantity || 1), 0);

    const priceADollars = (optimalSplit.priceA / 100).toFixed(0);
    const priceBDollars = (optimalSplit.priceB / 100).toFixed(0);
    const netSavingsDollars = Math.max(0, Math.round(optimalSplit.netBenefit / 100));
    const grossSavingsPercent =
      singlePriced.quotedCustomerPriceCents > 0
        ? parseFloat(((optimalSplit.grossSavings / singlePriced.quotedCustomerPriceCents) * 100).toFixed(1))
        : 0;

    const headline = isRecommended
      ? `Split & Save $${netSavingsDollars}: Ship ${palletsA} plts via ${optimalSplit.quoteA.carrierName} ($${priceADollars}) + ${palletsB} plts via ${optimalSplit.quoteB.carrierName} ($${priceBDollars})`
      : `Single Carrier Recommended (${bestSingleCarrierQuote.carrierName})`;

    const explanation = isRecommended
      ? `Partitioning ${palletsA + palletsB} pallets into two optimized carrier legs unlocks $${(optimalSplit.grossSavings / 100).toFixed(2)} in gross rate arbitrage. After accounting for $${(optimalSplit.frictionPenalty / 100).toFixed(2)} in warehouse dock buffer and schedule alignment, net verified savings is $${(optimalSplit.netBenefit / 100).toFixed(2)} (${grossSavingsPercent}% savings).`
      : `Split scenario evaluated but did not exceed the $75.00 net operational friction hurdle. Single carrier dispatch via ${bestSingleCarrierQuote.carrierName} remains the most cost-effective and reliable execution.`;

    return {
      isSplitFeasible: true,
      isRecommended,
      singleCarrierQuote: bestSingleCarrierQuote,
      singleCarrierCustomerPriceCents: singlePriced.quotedCustomerPriceCents,
      subShipmentA: {
        subShipmentName: 'Sub-Shipment A',
        items: optimalSplit.subAItems,
        totalPallets: palletsA,
        totalWeightLbs: optimalSplit.subAItems.reduce((s, it) => s + (it.weightLbs || 500) * (it.quantity || 1), 0),
        selectedCarrier: optimalSplit.quoteA,
        carrierPriceCents: optimalSplit.priceA,
      },
      subShipmentB: {
        subShipmentName: 'Sub-Shipment B',
        items: optimalSplit.subBItems,
        totalPallets: palletsB,
        totalWeightLbs: optimalSplit.subBItems.reduce((s, it) => s + (it.weightLbs || 500) * (it.quantity || 1), 0),
        selectedCarrier: optimalSplit.quoteB,
        carrierPriceCents: optimalSplit.priceB,
      },
      combinedSplitCarrierCostCents: optimalSplit.combinedCost,
      combinedSplitCustomerPriceCents: optimalSplit.combinedPrice,
      grossSavingsCents: optimalSplit.grossSavings,
      grossSavingsPercent,
      operationalFrictionCents: optimalSplit.frictionPenalty,
      frictionBreakdown: optimalSplit.frictionBreakdown,
      netSplitBenefitCents: optimalSplit.netBenefit,
      transitDeltaDays: optimalSplit.transitDelta,
      plainLanguageHeadline: headline,
      plainLanguageExplanation: explanation,
    };
  }
}
