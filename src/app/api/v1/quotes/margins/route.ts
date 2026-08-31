import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { dbClient } from '../../../../../db/client';
import { MARGIN_RULE_TYPES } from '../../../../../db/schema';

const MarginRuleInputSchema = z.object({
  tenantId: z.string().min(1).default('01916362-7901-7080-867c-9b8895092a01'),
  name: z.string().min(1).max(128),
  ruleType: z.enum(MARGIN_RULE_TYPES).default('GLOBAL_DEFAULT'),
  priority: z.number().int().min(1).max(4).default(4),
  customerId: z.string().optional().nullable(),
  originState: z.string().length(2).optional().nullable(),
  destState: z.string().length(2).optional().nullable(),
  minWeightLbs: z.number().nonnegative().optional().nullable(),
  maxWeightLbs: z.number().positive().optional().nullable(),
  marginPercentage: z.number().nonnegative().default(15.0),
  flatMarkupCents: z.number().int().nonnegative().default(0),
  minimumGrossProfitFloorCents: z.number().int().nonnegative().default(7500),
  isActive: z.boolean().default(true),
});

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const tenantId = searchParams.get('tenantId') || '01916362-7901-7080-867c-9b8895092a01';
    dbClient.setTenantContext(tenantId);

    const rules = await dbClient.getActiveMarginRules(tenantId);
    return NextResponse.json({
      success: true,
      rules,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 400 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = MarginRuleInputSchema.parse(body);

    dbClient.setTenantContext(parsed.tenantId);

    const rule = await dbClient.insertMarginRule({
      tenantId: parsed.tenantId,
      name: parsed.name,
      ruleType: parsed.ruleType,
      priority: parsed.priority,
      customerId: parsed.customerId || null,
      originState: parsed.originState || null,
      destState: parsed.destState || null,
      minWeightLbs: parsed.minWeightLbs ?? null,
      maxWeightLbs: parsed.maxWeightLbs ?? null,
      marginPercentage: parsed.marginPercentage,
      flatMarkupCents: parsed.flatMarkupCents,
      minimumGrossProfitFloorCents: parsed.minimumGrossProfitFloorCents,
      isActive: parsed.isActive,
    });

    return NextResponse.json({
      success: true,
      rule,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 400 }
    );
  }
}
