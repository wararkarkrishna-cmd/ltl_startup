import { Shipment, ShipmentStatus, DispatchBoardColumn } from '../../db/schema';
import { dbClient } from '../../db/client';
import { AuditEngine } from '../audit/audit-engine';

export interface DispatchCard {
  shipmentId: string;
  referenceNumber: string;
  status: ShipmentStatus;
  column: DispatchBoardColumn;
  originCity: string;
  originState: string;
  destCity: string;
  destState: string;
  totalPallets: number;
  totalWeightLbs: number;
  pickupDateReady: string;
  assignedCarrierCode?: string;
  assignedCarrierName?: string;
  assignedCarrierScac?: string;
  proNumber?: string;
  pickupNumber?: string;
  customerRateDollars?: number;
  isVolumeLtl: boolean;
  createdAt: Date;
}

export interface KanbanBoardState {
  columns: Record<
    DispatchBoardColumn,
    {
      column: DispatchBoardColumn;
      label: string;
      totalCount: number;
      totalWeightLbs: number;
      cards: DispatchCard[];
    }
  >;
  totalActiveShipments: number;
}

export class DispatchBoardEngine {
  // Allowed State Machine Transition Graph
  private static readonly ALLOWED_TRANSITIONS: Record<string, string[]> = {
    DRAFT: ['EXTRACTED', 'QUOTED', 'UNASSIGNED'],
    EXTRACTED: ['QUOTED', 'UNASSIGNED', 'DRAFT'],
    QUOTED: ['TENDERED', 'TENDER_SENT', 'UNASSIGNED'],
    UNASSIGNED: ['TENDER_SENT', 'TENDERED', 'DISPATCHED', 'EXCEPTION'],
    TENDER_SENT: ['TENDER_ACCEPTED', 'UNASSIGNED', 'EXCEPTION'],
    TENDERED: ['TENDER_ACCEPTED', 'DISPATCHED', 'UNASSIGNED'],
    TENDER_ACCEPTED: ['DISPATCHED', 'AT_PICKUP', 'EXCEPTION'],
    DISPATCHED: ['AT_PICKUP', 'PICKED_UP', 'IN_TRANSIT', 'EXCEPTION'],
    AT_PICKUP: ['PICKED_UP', 'IN_TRANSIT', 'EXCEPTION'],
    PICKED_UP: ['IN_TRANSIT', 'EXCEPTION'],
    IN_TRANSIT: ['OUT_FOR_DELIVERY', 'DELIVERED', 'EXCEPTION'],
    OUT_FOR_DELIVERY: ['DELIVERED', 'EXCEPTION'],
    DELIVERED: ['INVOICED', 'SETTLED', 'EXCEPTION'],
    INVOICED: ['SETTLED', 'DISPUTED'],
    SETTLED: [],
    EXCEPTION: ['UNASSIGNED', 'DISPATCHED', 'IN_TRANSIT', 'DELIVERED', 'DISPUTED'],
    DISPUTED: ['SETTLED', 'INVOICED'],
  };

  /**
   * Map system shipment status to canonical Kanban column
   */
  public static mapStatusToColumn(status: ShipmentStatus): DispatchBoardColumn {
    switch (status) {
      case 'DRAFT':
      case 'EXTRACTED':
      case 'QUOTED':
        return 'UNASSIGNED';
      case 'TENDERED':
        return 'TENDER_SENT';
      case 'DISPATCHED':
        return 'DISPATCHED';
      case 'PICKED_UP':
        return 'AT_PICKUP';
      case 'IN_TRANSIT':
        return 'IN_TRANSIT';
      case 'OUT_FOR_DELIVERY':
        return 'OUT_FOR_DELIVERY';
      case 'DELIVERED':
        return 'DELIVERED';
      case 'INVOICED':
        return 'INVOICED';
      case 'SETTLED':
        return 'SETTLED';
      case 'EXCEPTION':
      case 'DISPUTED':
      default:
        return 'UNASSIGNED';
    }
  }

  /**
   * Check if state transition is valid
   */
  public static isValidTransition(fromStatus: string, toStatus: string): boolean {
    if (fromStatus === toStatus) return true;
    const allowed = this.ALLOWED_TRANSITIONS[fromStatus] || [];
    return allowed.includes(toStatus);
  }

  /**
   * Get full Kanban Board State for a tenant
   */
  public static async getBoardState(tenantId: string): Promise<KanbanBoardState> {
    dbClient.setTenantContext(tenantId);

    const columns: Record<DispatchBoardColumn, any> = {
      UNASSIGNED: { column: 'UNASSIGNED', label: 'Unassigned / Quoted', totalCount: 0, totalWeightLbs: 0, cards: [] },
      TENDER_SENT: { column: 'TENDER_SENT', label: 'Tender Sent', totalCount: 0, totalWeightLbs: 0, cards: [] },
      TENDER_ACCEPTED: { column: 'TENDER_ACCEPTED', label: 'Tender Accepted', totalCount: 0, totalWeightLbs: 0, cards: [] },
      DISPATCHED: { column: 'DISPATCHED', label: 'Dispatched', totalCount: 0, totalWeightLbs: 0, cards: [] },
      AT_PICKUP: { column: 'AT_PICKUP', label: 'At Pickup / Loading', totalCount: 0, totalWeightLbs: 0, cards: [] },
      IN_TRANSIT: { column: 'IN_TRANSIT', label: 'In Transit', totalCount: 0, totalWeightLbs: 0, cards: [] },
      OUT_FOR_DELIVERY: { column: 'OUT_FOR_DELIVERY', label: 'Out for Delivery', totalCount: 0, totalWeightLbs: 0, cards: [] },
      DELIVERED: { column: 'DELIVERED', label: 'Delivered', totalCount: 0, totalWeightLbs: 0, cards: [] },
      INVOICED: { column: 'INVOICED', label: 'Invoiced', totalCount: 0, totalWeightLbs: 0, cards: [] },
      SETTLED: { column: 'SETTLED', label: 'Settled & Paid', totalCount: 0, totalWeightLbs: 0, cards: [] },
    };

    let totalActive = 0;

    for (const shipment of dbClient.shipments.values()) {
      if (shipment.tenantId !== tenantId) continue;

      const colKey = this.mapStatusToColumn(shipment.status);
      const card: DispatchCard = {
        shipmentId: shipment.id,
        referenceNumber: shipment.referenceNumber,
        status: shipment.status,
        column: colKey,
        originCity: shipment.originCity,
        originState: shipment.originState,
        destCity: shipment.destCity,
        destState: shipment.destState,
        totalPallets: shipment.totalPallets,
        totalWeightLbs: shipment.totalWeightLbs,
        pickupDateReady: shipment.pickupDateReady,
        isVolumeLtl: shipment.totalPallets >= 6 || shipment.totalWeightLbs > 5000,
        createdAt: shipment.createdAt,
      };

      if (columns[colKey]) {
        columns[colKey].cards.push(card);
        columns[colKey].totalCount++;
        columns[colKey].totalWeightLbs += shipment.totalWeightLbs;
        totalActive++;
      }
    }

    return {
      columns,
      totalActiveShipments: totalActive,
    };
  }

  /**
   * Update shipment dispatch status with state machine enforcement and audit logging
   */
  public static async transitionStatus(
    tenantId: string,
    shipmentId: string,
    newStatus: ShipmentStatus,
    userId: string = 'DISPATCHER_DESK'
  ): Promise<Shipment> {
    dbClient.setTenantContext(tenantId);
    const shipment = await dbClient.getShipmentById(shipmentId);
    if (!shipment) {
      throw new Error(`Shipment ${shipmentId} not found`);
    }

    const currentStatus = shipment.status;
    if (!this.isValidTransition(currentStatus, newStatus)) {
      throw new Error(
        `Invalid lifecycle transition: Cannot move shipment from ${currentStatus} to ${newStatus}`
      );
    }

    shipment.status = newStatus;
    shipment.updatedAt = new Date();
    dbClient.shipments.set(shipment.id, shipment);

    // Record immutable audit event
    await AuditEngine.recordEvent({
      tenantId,
      shipmentId,
      userId,
      fieldName: 'status',
      oldValue: currentStatus,
      newValue: newStatus,
      source: 'USER_OVERRIDE',
    });

    return shipment;
  }
}
