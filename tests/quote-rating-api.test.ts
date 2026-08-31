import { describe, it, expect } from 'vitest';
import { POST as RatePost } from '../src/app/api/v1/quotes/rate/route';
import { GET as MarginsGet, POST as MarginsPost } from '../src/app/api/v1/quotes/margins/route';
import { NextRequest } from 'next/server';

describe('Phase 2 Quoting & Rating API Endpoints', () => {
  const tenantId = '01916362-7901-7080-867c-9b8895092a01';

  it('POST /api/v1/quotes/margins successfully creates dynamic margin rule', async () => {
    const req = new NextRequest('http://localhost:3000/api/v1/quotes/margins', {
      method: 'POST',
      body: JSON.stringify({
        tenantId,
        name: 'Midwest Corridor 17.5%',
        ruleType: 'LANE',
        priority: 2,
        originState: 'IL',
        destState: 'OH',
        marginPercentage: 17.5,
        flatMarkupCents: 500, // $5.00
        minimumGrossProfitFloorCents: 7500,
        isActive: true,
      }),
    });

    const res = await MarginsPost(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.rule.name).toBe('Midwest Corridor 17.5%');
    expect(json.rule.marginPercentage).toBe(17.5);
  });

  it('GET /api/v1/quotes/margins retrieves all active margin rules sorted by priority', async () => {
    const req = new NextRequest(`http://localhost:3000/api/v1/quotes/margins?tenantId=${tenantId}`);
    const res = await MarginsGet(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(Array.isArray(json.rules)).toBe(true);
    expect(json.rules.length).toBeGreaterThanOrEqual(1);
  });

  it('POST /api/v1/quotes/rate generates ranked carrier quotes with wholesale and direct options', async () => {
    const req = new NextRequest('http://localhost:3000/api/v1/quotes/rate', {
      method: 'POST',
      body: JSON.stringify({
        tenantId,
        originZip: '60601', // Chicago IL
        originCity: 'Chicago',
        originState: 'IL',
        destZip: '43215', // Columbus OH
        destCity: 'Columbus',
        destState: 'OH',
        pickupDate: '2026-09-01',
        items: [
          {
            lengthIn: 48,
            widthIn: 40,
            heightIn: 48,
            weightLbs: 1500,
            quantity: 2,
            nmfcClass: '70',
          },
        ],
        accessorials: ['LIFTGATE_DELIVERY'],
      }),
    });

    const res = await RatePost(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.totalQuotesGenerated).toBe(10); // 5 Direct + 5 Wholesale
    expect(json.executionTimeMs).toBeGreaterThanOrEqual(0);
    expect(json.bestPriceQuote).toBeDefined();
    expect(json.fastestQuote).toBeDefined();
    expect(json.quotes[0].quotedCustomerPriceCents).toBeGreaterThan(
      json.quotes[0].totalCarrierCostCents
    );
    expect(json.quotes[0].pricing.appliedMarginPercent).toBe(17.5); // Matched IL -> OH Lane rule!
    expect(json.quotes[0].pricing.matchedRuleType).toBe('LANE');
  });

  it('returns 400 when rate request payload has invalid or missing postal codes', async () => {
    const req = new NextRequest('http://localhost:3000/api/v1/quotes/rate', {
      method: 'POST',
      body: JSON.stringify({
        tenantId,
        originZip: '12', // Invalid zip
        destZip: '60601',
        items: [],
      }),
    });

    const res = await RatePost(req);
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.success).toBe(false);
  });
});
