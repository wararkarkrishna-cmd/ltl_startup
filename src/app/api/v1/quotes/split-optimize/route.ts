import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { dbClient } from '../../../../../db/client';
import { CombinatorialSplitOptimizer } from '../../../../../lib/optimization/split-optimizer';
import { VolumeLtlEngine } from '../../../../../lib/classification/volume-ltl-engine';
import { RateRequest } from '../../../../../lib/rating/carrier-adapter.interface';

const SplitOptimizeRequestSchema = z.object({
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
    const parsed = SplitOptimizeRequestSchema.parse(body);

    const tenantId = parsed.tenantId;
    dbClient.setTenantContext(tenantId);

    const activeMarginRules = await dbClient.getActiveMarginRules(tenantId);

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

    // 1. Evaluate Volume LTL & Linear Foot Criteria
    const volumeLtlEval = VolumeLtlEngine.evaluateShipment(parsed.items);

    // 2. Execute Combinatorial Split Optimization Algorithm
    const splitResult = await CombinatorialSplitOptimizer.optimizeShipment(
      rateRequest,
      activeMarginRules
    );

    return NextResponse.json({
      success: true,
      volumeLtl: volumeLtlEval,
      splitOptimization: splitResult,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Split optimization failed',
      },
      { status: 400 }
    );
  }
}
