import { describe, it, expect } from 'vitest';
import { NextRequest } from 'next/server';
import { POST as handleIngest } from '../src/app/api/v1/rfq/ingest/route';

describe('Phase 1: Multi-Modal Ingestion API (POST /api/v1/rfq/ingest)', () => {
  it('ingests raw text payload, extracts ExtractedRFQ schema, and computes density', async () => {
    const rawText = `Quote Request:\nOrigin: 100 Main St, Los Angeles CA 90001\nDestination: 500 N Michigan Ave, Chicago IL 60601\nFreight: 2 Pallets 48x40x48 @ 1000 lbs each (Total: 2000 lbs)\nCommodity: Machinery Parts`;

    const req = new NextRequest('http://localhost:3000/api/v1/rfq/ingest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rawText }),
    });

    const res = await handleIngest(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.rfqId).toBeDefined();
    expect(json.shipmentId).toBeDefined();
    expect(json.sha256Hash).toHaveLength(64);

    // Schema Validation
    expect(json.extractedRfq.origin.zip).toBe('90001');
    expect(json.extractedRfq.destination.zip).toBe('60601');
    expect(json.extractedRfq.items).toHaveLength(1);
    expect(json.extractedRfq.items[0].handling_units).toBe(2);
    expect(json.extractedRfq.items[0].total_weight_lbs).toBe(2000);

    // Density Metrics
    expect(json.densityEvaluation.totalHandlingUnits).toBe(2);
    expect(json.densityEvaluation.totalWeightLbs).toBe(2000);
    expect(json.densityEvaluation.calculatedPcf).toBe(18.75);
    expect(json.densityEvaluation.recommendedShipmentClass).toBe(70);
    expect(json.densityEvaluation.linearFeet).toBe(4.0);

    // Confidence & Safety Lock
    expect(json.confidenceScores.overall).toBeGreaterThanOrEqual(0.95);
    expect(json.safetyLockActive).toBe(false);
  });

  it('activates safety lock when invalid postal code is provided', async () => {
    const rawText = `Origin: BadZIP 99 to Dest: 60601, 1 pallet 48x40x48 @ 500 lbs`;

    const req = new NextRequest('http://localhost:3000/api/v1/rfq/ingest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rawText }),
    });

    const res = await handleIngest(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.confidenceScores.origin_zip).toBeLessThan(0.8);
    expect(json.safetyLockActive).toBe(true);
  });
});
