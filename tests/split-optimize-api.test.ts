import { describe, it, expect } from 'vitest';
import { POST as SplitOptimizePost } from '../src/app/api/v1/quotes/split-optimize/route';
import { NextRequest } from 'next/server';

describe('Phase 2.9: Split Optimize & Volume LTL API (POST /api/v1/quotes/split-optimize)', () => {
  const tenantId = '01916362-7901-7080-867c-9b8895092a01';

  it('evaluates volume LTL criteria and combinatorial split optimization on multi-pallet load', async () => {
    const req = new NextRequest('http://localhost:3000/api/v1/quotes/split-optimize', {
      method: 'POST',
      body: JSON.stringify({
        tenantId,
        originZip: '90001',
        originCity: 'Los Angeles',
        originState: 'CA',
        destZip: '60601',
        destCity: 'Chicago',
        destState: 'IL',
        items: [
          {
            lengthIn: 48,
            widthIn: 40,
            heightIn: 48,
            weightLbs: 1200,
            quantity: 4,
            nmfcClass: '70',
          },
          {
            lengthIn: 48,
            widthIn: 40,
            heightIn: 60,
            weightLbs: 800,
            quantity: 3,
            nmfcClass: '85',
          },
        ],
        accessorials: ['LIFTGATE_DELIVERY'],
      }),
    });

    const res = await SplitOptimizePost(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);

    // Volume LTL verification (7 pallets, 7200 lbs >= 5000 lbs)
    expect(json.volumeLtl.isVolumeLtl).toBe(true);
    expect(json.volumeLtl.totalPallets).toBe(7);
    expect(json.volumeLtl.totalLinearFeet).toBe(16); // ceil(7/2)*4 = 16

    // Split Optimization verification
    expect(json.splitOptimization.isSplitFeasible).toBe(true);
    expect(json.splitOptimization.singleCarrierQuote).toBeDefined();
    expect(json.splitOptimization.subShipmentA).toBeDefined();
    expect(json.splitOptimization.subShipmentB).toBeDefined();
    expect(json.splitOptimization.plainLanguageHeadline).toBeDefined();
    expect(json.splitOptimization.plainLanguageExplanation).toBeDefined();
  });

  it('returns 400 when request items array is empty', async () => {
    const req = new NextRequest('http://localhost:3000/api/v1/quotes/split-optimize', {
      method: 'POST',
      body: JSON.stringify({
        tenantId,
        originZip: '90001',
        destZip: '60601',
        items: [],
      }),
    });

    const res = await SplitOptimizePost(req);
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.success).toBe(false);
  });
});
