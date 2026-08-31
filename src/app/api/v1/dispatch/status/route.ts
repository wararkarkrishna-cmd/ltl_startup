import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { DispatchBoardEngine } from '../../../../../lib/dispatch/dispatch-board-engine';
import { SHIPMENT_STATUSES } from '../../../../../db/schema';

const TransitionSchema = z.object({
  tenantId: z.string().min(1).default('01916362-7901-7080-867c-9b8895092a01'),
  shipmentId: z.string().min(1),
  newStatus: z.enum(SHIPMENT_STATUSES),
  userId: z.string().default('DISPATCHER_AGENT'),
});

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = TransitionSchema.parse(body);

    const updatedShipment = await DispatchBoardEngine.transitionStatus(
      parsed.tenantId,
      parsed.shipmentId,
      parsed.newStatus,
      parsed.userId
    );

    return NextResponse.json({
      success: true,
      shipment: updatedShipment,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  }
}
