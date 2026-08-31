import { describe, it, expect } from 'vitest';
import { NextRequest } from 'next/server';
import { POST as handleClassify } from '../src/app/api/classify/route';
import { POST as handleApprove } from '../src/app/api/shipments/[id]/approve/route';
import { generateUuidV7 } from '../src/lib/uuidv7';

describe('Phase 1.7: High-Velocity Review & Fast-Edit API Integration', () => {
  it('POST /api/classify calculates PCF, NMFC class, and linear feet for payload', async () => {
    const payload = {
      items: [
        { lengthIn: 48, widthIn: 40, heightIn: 48, weightLbs: 1200, quantity: 4 },
      ],
    };

    const req = new NextRequest('http://localhost:3000/api/classify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const res = await handleClassify(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.classification.totalPallets).toBe(4);
    expect(json.classification.totalWeightLbs).toBe(4800);
    expect(json.classification.totalLinearFeet).toBe(8.0);
    expect(json.classification.recommendedShipmentClass).toBe('65');
  });

  it('POST /api/shipments/[id]/approve records CDC audit log for user manual overrides', async () => {
    const shipmentId = generateUuidV7();
    const tenantId = 'tenant-apex-review-test';

    const originalExtractedJson = {
      totalWeightLbs: 4000,
      totalPallets: 4,
      accessorials: ['LG_DEL'],
    };

    // Broker changes weight to 4500 and adds RES_DEL
    const updatedRfq = {
      totalWeightLbs: 4500,
      totalPallets: 4,
      accessorials: ['LG_DEL', 'RES_DEL'],
    };

    const req = new NextRequest(`http://localhost:3000/api/shipments/${shipmentId}/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tenantId,
        userId: generateUuidV7(),
        updatedRfq,
        originalExtractedJson,
      }),
    });

    const res = await handleApprove(req, { params: { id: shipmentId } });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.status).toBe('QUOTED');
    expect(json.auditEventsRecorded).toBe(2);

    const recordedEvents = json.auditEntries;
    expect(recordedEvents.some((e: any) => e.fieldName === 'totalWeightLbs' && e.source === 'USER_OVERRIDE')).toBe(true);
    expect(recordedEvents.some((e: any) => e.fieldName === 'accessorials' && e.source === 'USER_OVERRIDE')).toBe(true);
  });
});
