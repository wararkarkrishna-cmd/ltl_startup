import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { PortTransloadEngine, IngestContainerParams, DeconsolidationPlanLeg } from '../../../../../lib/transload/transload-engine';

const DeconsolidateSchema = z.object({
  tenantId: z.string().min(1).default('01916362-7901-7080-867c-9b8895092a01'),
  container: z.object({
    containerNumber: z.string().min(4),
    vesselName: z.string().min(1),
    portOfDischarge: z.string().min(2),
    steamshipLine: z.string().min(1),
    lastFreeDay: z.string(),
    sealNumber: z.string().min(1),
    stagingLane: z.string().min(1),
    totalCartons: z.number().int().positive(),
    totalPalletsDevanned: z.number().int().positive(),
    totalGrossWeightLbs: z.number().positive(),
  }),
  outboundLegs: z.array(
    z.object({
      destCity: z.string().min(1),
      destState: z.string().length(2),
      destZip: z.string().min(5),
      destAddress1: z.string().min(1),
      consigneeName: z.string().min(1),
      pallets: z.number().int().positive(),
      weightLbs: z.number().positive(),
      commodityDescription: z.string().min(1),
      assignedCarrierScac: z.string().min(2),
    })
  ).min(1),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = DeconsolidateSchema.parse(body);

    const container = await PortTransloadEngine.ingestContainer({
      tenantId: parsed.tenantId,
      ...parsed.container,
    });

    const manifest = await PortTransloadEngine.deconsolidateContainer(
      parsed.tenantId,
      container,
      parsed.outboundLegs
    );

    return NextResponse.json({
      success: true,
      manifest,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  }
}
