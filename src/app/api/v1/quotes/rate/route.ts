import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { dbClient } from '../../../../../db/client';
import { PlatformRatingEngine } from '../../../../../lib/rating/platform-wholesale-engine';
import { MarginRulesEngine, PricingEvaluationContext } from '../../../../../lib/pricing/margin-engine';
import { RateRequest, RateItem } from '../../../../../lib/rating/carrier-adapter.interface';
import { generateUuidV7 } from '../../../../../lib/uuidv7';

const RateRequestSchema = z.object({
  tenantId: z.string().min(1).default('01916362-7901-7080-867c-9b8895092a01'),
  shipmentId: z.string().optional().nullable(),
  customerId: z.string().optional().nullable(),
  originZip: z.string().min(5).max(10),
  originCity: z.string().optional().default('Origin City'),
  originState: z.string().length(2).default('CA'),
  destZip: z.string().min(5).max(10),
  destCity: z.string().optional().default('Dest City'),
  destState: z.string().length(2).default('IL'),
  pickupDate: z.string().default(() => new Date().toISOString().split('T')[0]),
  items: z
    .array(
      z.object({
        lengthIn: z.number().positive().default(48),
        widthIn: z.number().positive().default(40),
        heightIn: z.number().positive().default(48),
        weightLbs: z.number().positive().default(500),
        quantity: z.number().int().min(1).default(1),
        nmfcClass: z.string().default('70'),
        isHazmat: z.boolean().default(false),
        isStackable: z.boolean().default(false),
      })
    )
    .min(1, 'At least 1 item is required'),
  accessorials: z.array(z.string()).default([]),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = RateRequestSchema.parse(body);

    const tenantId = parsed.tenantId;
    dbClient.setTenantContext(tenantId);

    // Retrieve active carrier credentials & margin rules from DB
    const activeCredentials = await dbClient.getActiveCarrierCredentials(tenantId);
    const activeMarginRules = await dbClient.getActiveMarginRules(tenantId);

    // Prepare rate request
    const rateRequest: Omit<RateRequest, 'accountType'> = {
      tenantId,
      shipmentId: parsed.shipmentId || undefined,
      originZip: parsed.originZip,
      originCity: parsed.originCity,
      originState: parsed.originState,
      destZip: parsed.destZip,
      destCity: parsed.destCity,
      destState: parsed.destState,
      pickupDate: parsed.pickupDate,
      items: parsed.items,
      accessorials: parsed.accessorials,
    };

    // Calculate total weight
    const totalWeightLbs = parsed.items.reduce(
      (sum, it) => sum + (it.weightLbs || 500) * (it.quantity || 1),
      0
    );

    // 1. Execute Multi-Carrier Rating (BYOC + Wholesale)
    const ratingResult = await PlatformRatingEngine.rateShipmentHybrid(
      rateRequest,
      activeCredentials
    );

    // 2. Apply Dynamic Broker Margin Rules
    const pricingContext: PricingEvaluationContext = {
      tenantId,
      customerId: parsed.customerId,
      originState: parsed.originState,
      destState: parsed.destState,
      totalWeightLbs,
    };

    const pricedQuotes = MarginRulesEngine.priceCarrierQuotes(
      ratingResult.quotes,
      pricingContext,
      activeMarginRules
    );

    // 3. Persist Quotes to Database
    const savedQuoteEntities = [];
    for (const pq of pricedQuotes) {
      const savedQuote = await dbClient.insertQuote({
        tenantId,
        shipmentId: parsed.shipmentId || null,
        carrierCode: pq.carrierCode,
        carrierName: pq.carrierName,
        carrierScac: pq.carrierScac,
        accountType: pq.accountType,
        sourceTag: pq.sourceTag,
        quoteNumber: pq.quoteNumber,
        linehaulCostCents: pq.linehaulCostCents,
        fuelSurchargeCents: pq.fuelSurchargeCents,
        accessorialCostCents: pq.accessorialCostCents,
        totalCarrierCostCents: pq.totalCostCents,
        appliedMarginPercent: pq.pricing.appliedMarginPercent,
        appliedMarginCents: pq.pricing.appliedMarginAmountCents,
        quotedCustomerPriceCents: pq.pricing.quotedCustomerPriceCents,
        grossProfitCents: pq.pricing.grossProfitCents,
        grossMarginPercent: pq.pricing.grossMarginPercent,
        transitDays: pq.transitDays,
        isGuaranteed: pq.isGuaranteed,
        isSelected: false,
        accessorialFees: pq.accessorialBreakdown,
        rawCarrierResponse: pq.rawResponse || null,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      });
      savedQuoteEntities.push({
        ...savedQuote,
        pricing: pq.pricing,
      });
    }

    // Identify highlight options
    const bestPrice = [...savedQuoteEntities].sort(
      (a, b) => a.quotedCustomerPriceCents - b.quotedCustomerPriceCents
    )[0];
    const fastest = [...savedQuoteEntities].sort((a, b) => a.transitDays - b.transitDays)[0];

    return NextResponse.json({
      success: true,
      totalQuotesGenerated: savedQuoteEntities.length,
      executionTimeMs: ratingResult.totalTimeMs,
      wholesaleSavingsDollars: parseFloat((ratingResult.wholesaleSavingsCents / 100).toFixed(2)),
      bestPriceQuote: bestPrice || null,
      fastestQuote: fastest || null,
      quotes: savedQuoteEntities,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Rating calculation failed',
      },
      { status: 400 }
    );
  }
}
