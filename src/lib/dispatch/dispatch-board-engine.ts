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
   * Seed realistic practice shipments if the board is freshly loaded
   */
  public static async seedPracticeLoads(tenantId: string): Promise<void> {
    dbClient.setTenantContext(tenantId);
    
    const sampleShipments: Array<Parameters<typeof dbClient.insertShipment>[0] extends infer T ? Omit<T, 'id' | 'tenantId' | 'createdAt' | 'updatedAt'> : never> = [
      {
        referenceNumber: 'LTL-2026-TEST-0001',
        status: 'QUOTED',
        originName: 'ABC Manufacturing Co.',
        originAddress1: '123 Main St',
        originCity: 'Dallas',
        originState: 'TX',
        originZip: '75201',
        originCountry: 'US',
        destName: 'XYZ Retail Inc.',
        destAddress1: '4500 Oak Ave',
        destCity: 'Houston',
        destState: 'TX',
        destZip: '77001',
        destCountry: 'US',
        totalPallets: 4,
        totalWeightLbs: 1200,
        pickupDateReady: '2026-09-02',
      },
      {
        referenceNumber: 'LTL-2026-SAIA-4402',
        status: 'TENDERED',
        originName: 'Midwest Heavy Industrial',
        originAddress1: '100 Industrial Pkwy',
        originCity: 'Los Angeles',
        originState: 'CA',
        originZip: '90001',
        originCountry: 'US',
        destName: 'Apex Midwest Logistics Hub',
        destAddress1: '500 Logistics Way',
        destCity: 'Chicago',
        destState: 'IL',
        destZip: '60601',
        destCountry: 'US',
        totalPallets: 2,
        totalWeightLbs: 2400,
        pickupDateReady: '2026-09-01',
      },
      {
        referenceNumber: 'LTL-2026-ESTES-8812',
        status: 'PICKED_UP',
        originName: 'Titan Tool & Hardware Co.',
        originAddress1: '800 Manufacturing Blvd',
        originCity: 'Atlanta',
        originState: 'GA',
        originZip: '30301',
        originCountry: 'US',
        destName: 'Carolina Distribution Center',
        destAddress1: '1200 Commerce Dr',
        destCity: 'Charlotte',
        destState: 'NC',
        destZip: '28202',
        destCountry: 'US',
        totalPallets: 3,
        totalWeightLbs: 3400,
        pickupDateReady: '2026-09-01',
      },
      {
        referenceNumber: 'LTL-2026-XPO-9921',
        status: 'DISPATCHED',
        originName: 'Gulf Coast Industrial Parts',
        originAddress1: '700 Harbor Road',
        originCity: 'Houston',
        originState: 'TX',
        originZip: '77001',
        originCountry: 'US',
        destName: 'North Texas Freight Depot',
        destAddress1: '900 Freightway St',
        destCity: 'Dallas',
        destState: 'TX',
        destZip: '75201',
        destCountry: 'US',
        totalPallets: 5,
        totalWeightLbs: 4800,
        pickupDateReady: '2026-08-31',
      },
      {
        referenceNumber: 'LTL-2026-ABF-7731',
        status: 'IN_TRANSIT',
        originName: 'Apex Midwest Electronics',
        originAddress1: '400 Tech Park',
        originCity: 'Chicago',
        originState: 'IL',
        originZip: '60601',
        originCountry: 'US',
        destName: 'Empire Logistics Center',
        destAddress1: '100 Distribution Ave',
        destCity: 'New York',
        destState: 'NY',
        destZip: '10001',
        destCountry: 'US',
        totalPallets: 4,
        totalWeightLbs: 3600,
        pickupDateReady: '2026-08-30',
      },
      {
        referenceNumber: 'LTL-2026-RL-5520',
        status: 'DELIVERED',
        originName: 'Pacific Coast Supply Co.',
        originAddress1: '300 Pacific Ave',
        originCity: 'Ontario',
        originState: 'CA',
        originZip: '91761',
        originCountry: 'US',
        destName: 'Sierra Nevada Logistics',
        destAddress1: '600 Sierra Way',
        destCity: 'Reno',
        destState: 'NV',
        destZip: '89502',
        destCountry: 'US',
        totalPallets: 6,
        totalWeightLbs: 5800,
        pickupDateReady: '2026-08-29',
      },
    ];

    for (const data of sampleShipments) {
      await dbClient.insertShipment({
        tenantId,
        ...data,
      });
    }
  }

  /**
   * Get full Kanban Board State for a tenant
   */
  public static async getBoardState(tenantId: string): Promise<KanbanBoardState> {
    dbClient.setTenantContext(tenantId);

    // Auto-seed if database has no shipments for this tenant
    let hasTenantShipment = false;
    for (const s of dbClient.shipments.values()) {
      if (s.tenantId === tenantId) {
        hasTenantShipment = true;
        break;
      }
    }

    if (!hasTenantShipment) {
      await this.seedPracticeLoads(tenantId);
    }

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
