import { NextRequest } from 'next/server';
import { z } from 'zod';
import { dbClient } from '../../../../../db/client';
import { PlatformRatingEngine } from '../../../../../lib/rating/platform-wholesale-engine';
import { MarginRulesEngine, PricingEvaluationContext } from '../../../../../lib/pricing/margin-engine';
import { RateRequest, RateItem, CarrierQuoteResult } from '../../../../../lib/rating/carrier-adapter.interface';
import { CombinatorialSplitOptimizer } from '../../../../../lib/optimization/split-optimizer';
import { VolumeLtlEngine } from '../../../../../lib/classification/volume-ltl-engine';
import { XpoRatingAdapter } from '../../../../../lib/rating/adapters/xpo-adapter';
import { EstesRatingAdapter } from '../../../../../lib/rating/adapters/estes-adapter';
import { SaiaRatingAdapter } from '../../../../../lib/rating/adapters/saia-adapter';
import { AbfRatingAdapter } from '../../../../../lib/rating/adapters/abf-adapter';
import { RlRatingAdapter } from '../../../../../lib/rating/adapters/rl-adapter';
import { CarrierCircuitBreaker } from '../../../../../lib/resilience/circuit-breaker';

const StreamRequestSchema = z.object({
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
    const parsed = StreamRequestSchema.parse(body);

    const tenantId = parsed.tenantId;
    dbClient.setTenantContext(tenantId);

    const activeRules = await dbClient.getActiveMarginRules(tenantId);
    const totalWeightLbs = parsed.items.reduce(
      (sum, it) => sum + (it.weightLbs || 500) * (it.quantity || 1),
      0
    );

    const pricingCtx: PricingEvaluationContext = {
      tenantId,
      customerId: parsed.customerId,
      originState: parsed.originState,
      destState: parsed.destState,
      totalWeightLbs,
    };

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

    // Prepare SSE Stream
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const sendEvent = (event: string, data: any) => {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        };

        try {
          // 1. Evaluate Volume LTL instantly
          const volumeLtl = VolumeLtlEngine.evaluateShipment(parsed.items);
          sendEvent('VOLUME_LTL', volumeLtl);

          // 2. Setup parallel individual carrier tasks
          const adapters = [
            { adapter: new XpoRatingAdapter(), accountType: 'DIRECT_BYOC' as const },
            { adapter: new XpoRatingAdapter(), accountType: 'PLATFORM_WHOLESALE' as const },
            { adapter: new EstesRatingAdapter(), accountType: 'DIRECT_BYOC' as const },
            { adapter: new EstesRatingAdapter(), accountType: 'PLATFORM_WHOLESALE' as const },
            { adapter: new SaiaRatingAdapter(), accountType: 'DIRECT_BYOC' as const },
            { adapter: new SaiaRatingAdapter(), accountType: 'PLATFORM_WHOLESALE' as const },
            { adapter: new AbfRatingAdapter(), accountType: 'DIRECT_BYOC' as const },
            { adapter: new AbfRatingAdapter(), accountType: 'PLATFORM_WHOLESALE' as const },
            { adapter: new RlRatingAdapter(), accountType: 'DIRECT_BYOC' as const },
            { adapter: new RlRatingAdapter(), accountType: 'PLATFORM_WHOLESALE' as const },
          ];

          const carrierPromises = adapters.map(async ({ adapter, accountType }) => {
            const breaker =
              PlatformRatingEngine.getCircuitBreaker(adapter.carrierCode) ||
              new CarrierCircuitBreaker(adapter.carrierCode, { timeoutMs: 3500 });

            try {
              const rawQuote: CarrierQuoteResult = await breaker.execute(() =>
                adapter.rate({ ...rateRequest, accountType })
              );

              const pricing = MarginRulesEngine.calculatePricing(rawQuote, pricingCtx, activeRules);

              const savedQuote = await dbClient.insertQuote({
                tenantId,
                shipmentId: parsed.shipmentId || null,
                carrierCode: rawQuote.carrierCode,
                carrierName: rawQuote.carrierName,
                carrierScac: rawQuote.carrierScac,
                accountType: rawQuote.accountType,
                sourceTag: rawQuote.sourceTag,
                quoteNumber: rawQuote.quoteNumber,
                linehaulCostCents: rawQuote.linehaulCostCents,
                fuelSurchargeCents: rawQuote.fuelSurchargeCents,
                accessorialCostCents: rawQuote.accessorialCostCents,
                totalCarrierCostCents: rawQuote.totalCostCents,
                appliedMarginPercent: pricing.appliedMarginPercent,
                appliedMarginCents: pricing.appliedMarginAmountCents,
                quotedCustomerPriceCents: pricing.quotedCustomerPriceCents,
                grossProfitCents: pricing.grossProfitCents,
                grossMarginPercent: pricing.grossMarginPercent,
                transitDays: rawQuote.transitDays,
                isGuaranteed: rawQuote.isGuaranteed,
                isSelected: false,
                accessorialFees: rawQuote.accessorialBreakdown,
                rawCarrierResponse: rawQuote.rawResponse || null,
                expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
              });

              // Stream progressive carrier quote to UI immediately
              sendEvent('QUOTE_RECEIVED', {
                ...savedQuote,
                pricing,
              });

              return savedQuote;
            } catch (err: any) {
              sendEvent('CARRIER_TIMEOUT', {
                carrierCode: adapter.carrierCode,
                accountType,
                error: err.message,
              });
              return null;
            }
          });

          // 3. Asynchronously compute Combinatorial Split Optimization in parallel
          const splitPromise = CombinatorialSplitOptimizer.optimizeShipment(
            rateRequest,
            activeRules
          ).then((splitRes) => {
            sendEvent('SPLIT_OPTIMIZATION', splitRes);
          });

          await Promise.allSettled([...carrierPromises, splitPromise]);

          sendEvent('COMPLETE', { status: 'FINISHED' });
        } catch (streamErr: any) {
          sendEvent('ERROR', { error: streamErr.message });
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
      },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
