import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { dbClient } from '../../../../../db/client';
import { DispatchBoardEngine } from '../../../../../lib/dispatch/dispatch-board-engine';
import { SHIPMENT_STATUSES, ShipmentStatus } from '../../../../../db/schema';
import { AuditEngine } from '../../../../../lib/audit/audit-engine';

const TrackingWebhookSchema = z.object({
  tenantId: z.string().min(1).default('01916362-7901-7080-867c-9b8895092a01'),
  shipmentId: z.string().optional(),
  proNumber: z.string().optional(),
  carrierScac: z.string().min(2),
  statusCode: z.string(),
  statusDescription: z.string().optional(),
  locationCity: z.string().optional(),
  locationState: z.string().optional(),
  eventTimestamp: z.string().default(() => new Date().toISOString()),
  rawEdi214: z.string().optional(),
});

function mapEdi214ToStatus(code: string): ShipmentStatus {
  const upper = code.toUpperCase();
  switch (upper) {
    case 'AF':
    case 'CP':
    case 'X6':
    case 'IN_TRANSIT':
      return 'IN_TRANSIT';
    case 'OO':
    case 'OFD':
    case 'OUT_FOR_DELIVERY':
      return 'OUT_FOR_DELIVERY';
    case 'D1':
    case 'CD':
    case 'DELIVERED':
      return 'DELIVERED';
    case 'P1':
    case 'PICKED_UP':
    case 'AT_PICKUP':
      return 'PICKED_UP';
    case 'SD':
    case 'A9':
    case 'EXCEPTION':
      return 'EXCEPTION';
    default:
      return 'IN_TRANSIT';
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = TrackingWebhookSchema.parse(body);

    const tenantId = parsed.tenantId;
    dbClient.setTenantContext(tenantId);

    let targetShipment = parsed.shipmentId ? await dbClient.getShipmentById(parsed.shipmentId) : null;
    if (!targetShipment && parsed.proNumber) {
      for (const s of dbClient.shipments.values()) {
        if (s.tenantId === tenantId && (s as any).proNumber === parsed.proNumber) {
          targetShipment = s;
          break;
        }
      }
    }

    const nextStatus = mapEdi214ToStatus(parsed.statusCode);

    if (targetShipment) {
      const currentStatus = targetShipment.status;
      if (DispatchBoardEngine.isValidTransition(currentStatus, nextStatus)) {
        await DispatchBoardEngine.transitionStatus(
          tenantId,
          targetShipment.id,
          nextStatus,
          'CARRIER_WEBHOOK'
        );
      } else {
        await AuditEngine.recordEvent({
          tenantId,
          shipmentId: targetShipment.id,
          userId: 'CARRIER',
          fieldName: 'tracking_event',
          oldValue: currentStatus,
          newValue: nextStatus,
          source: 'CARRIER_EDI',
        });
      }
    }

    return NextResponse.json({
      success: true,
      carrierScac: parsed.carrierScac,
      proNumber: parsed.proNumber || null,
      mappedStatus: nextStatus,
      message: `Tracking status ${nextStatus} processed successfully`,
      receivedAt: new Date().toISOString(),
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  }
}
