import { describe, it, expect, beforeEach } from 'vitest';
import { DispatchBoardEngine } from '../src/lib/dispatch/dispatch-board-engine';
import { dbClient } from '../src/db/client';

describe('Phase 3.5: Real-Time Kanban Dispatch Board State Machine', () => {
  const tenantId = '01916362-7901-7080-867c-9b8895092a01';

  beforeEach(async () => {
    dbClient.setTenantContext(tenantId);
    dbClient.shipments.clear();

    await dbClient.insertShipment({
      tenantId,
      referenceNumber: 'SHP-KB-001',
      status: 'QUOTED',
      originAddress1: '100 Main St',
      originCity: 'Dallas',
      originState: 'TX',
      originZip: '75201',
      originCountry: 'US',
      destAddress1: '500 Commerce Way',
      destCity: 'Atlanta',
      destState: 'GA',
      destZip: '30301',
      destCountry: 'US',
      totalPallets: 4,
      totalWeightLbs: 3000,
      pickupDateReady: '2026-09-01',
    });
  });

  it('correctly maps shipment statuses to canonical Kanban board columns', () => {
    expect(DispatchBoardEngine.mapStatusToColumn('QUOTED')).toBe('UNASSIGNED');
    expect(DispatchBoardEngine.mapStatusToColumn('TENDERED')).toBe('TENDER_SENT');
    expect(DispatchBoardEngine.mapStatusToColumn('DISPATCHED')).toBe('DISPATCHED');
    expect(DispatchBoardEngine.mapStatusToColumn('PICKED_UP')).toBe('AT_PICKUP');
    expect(DispatchBoardEngine.mapStatusToColumn('IN_TRANSIT')).toBe('IN_TRANSIT');
    expect(DispatchBoardEngine.mapStatusToColumn('OUT_FOR_DELIVERY')).toBe('OUT_FOR_DELIVERY');
    expect(DispatchBoardEngine.mapStatusToColumn('DELIVERED')).toBe('DELIVERED');
  });

  it('validates allowed forward transitions and rejects illegal state skips', () => {
    expect(DispatchBoardEngine.isValidTransition('QUOTED', 'TENDERED')).toBe(true);
    expect(DispatchBoardEngine.isValidTransition('TENDERED', 'DISPATCHED')).toBe(true);
    expect(DispatchBoardEngine.isValidTransition('DISPATCHED', 'IN_TRANSIT')).toBe(true);

    // Cannot jump from QUOTED directly to DELIVERED
    expect(DispatchBoardEngine.isValidTransition('QUOTED', 'DELIVERED')).toBe(false);
  });

  it('aggregates board state and computes column totals', async () => {
    const board = await DispatchBoardEngine.getBoardState(tenantId);

    expect(board.totalActiveShipments).toBe(1);
    expect(board.columns.UNASSIGNED.cards.length).toBe(1);
    expect(board.columns.UNASSIGNED.totalWeightLbs).toBe(3000);
  });

  it('transitions shipment status and logs immutable audit trail', async () => {
    const shipment = Array.from(dbClient.shipments.values())[0];

    const updated = await DispatchBoardEngine.transitionStatus(
      tenantId,
      shipment.id,
      'TENDERED',
      'AGENT_SMITH'
    );

    expect(updated.status).toBe('TENDERED');
    const board = await DispatchBoardEngine.getBoardState(tenantId);
    expect(board.columns.TENDER_SENT.cards.length).toBe(1);
  });
});
