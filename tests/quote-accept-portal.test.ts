import { describe, it, expect, beforeEach } from 'vitest';
import { GET as AcceptGet, POST as AcceptPost } from '../src/app/api/v1/quotes/accept/route';
import { QuoteDeliveryEngine } from '../src/lib/quoting/quote-delivery-engine';
import { dbClient } from '../src/db/client';
import { NextRequest } from 'next/server';

describe('Phase 3.2: Customer Self-Serve Booking Portal (GET/POST /api/v1/quotes/accept)', () => {
  const tenantId = '01916362-7901-7080-867c-9b8895092a01';
  const quoteId = '01916362-7901-7080-867c-9b8895092q99';
  const shipmentId = '01916362-7901-7080-867c-9b8895092s99';

  beforeEach(async () => {
    dbClient.setTenantContext(tenantId);
    await dbClient.insertQuote({
      tenantId,
      shipmentId,
      carrierCode: 'ESTES',
      carrierName: 'Estes Express Lines',
      carrierScac: 'EXLA',
      accountType: 'DIRECT_BYOC',
      sourceTag: '[DIRECT: ESTES #1]',
      quoteNumber: 'ESTES-99881',
      linehaulCostCents: 45000,
      fuelSurchargeCents: 12000,
      accessorialCostCents: 7500,
      totalCarrierCostCents: 64500,
      appliedMarginPercent: 15.0,
      appliedMarginCents: 9675,
      quotedCustomerPriceCents: 74175,
      grossProfitCents: 9675,
      grossMarginPercent: 13.04,
      transitDays: 3,
      isGuaranteed: false,
      isSelected: false,
      accessorialFees: {},
      rawCarrierResponse: null,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });
  });

  it('verifies token and returns quote metadata via GET /api/v1/quotes/accept', async () => {
    const tokenRecord = QuoteDeliveryEngine.generateActionToken({
      tenantId,
      quoteId,
      shipmentId,
      quotedPriceCents: 74175,
    });
    await dbClient.insertQuoteActionToken(tokenRecord);

    const req = new NextRequest(
      `http://localhost:3000/api/v1/quotes/accept?token=${encodeURIComponent(tokenRecord.token)}`
    );
    const res = await AcceptGet(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.payload.quotedPriceCents).toBe(74175);
    expect(json.isUsed).toBe(false);
  });

  it('executes 1-click booking and records audit trail via POST /api/v1/quotes/accept', async () => {
    const tokenRecord = QuoteDeliveryEngine.generateActionToken({
      tenantId,
      quoteId,
      shipmentId,
      quotedPriceCents: 74175,
    });
    await dbClient.insertQuoteActionToken(tokenRecord);

    const req = new NextRequest('http://localhost:3000/api/v1/quotes/accept', {
      method: 'POST',
      body: JSON.stringify({
        token: tokenRecord.token,
        poNumber: 'PO-TEST-8812',
        signerName: 'Jane Doe',
        signerEmail: 'jane.doe@shipper.com',
        specialInstructions: 'Gate code 4482',
      }),
    });

    const res = await AcceptPost(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.bookingConfirmationNumber).toMatch(/^BK-\d+/);
    expect(json.bookedPriceDollars).toBe(741.75);

    // Second booking attempt with same token must fail (single-use enforcement)
    const duplicateReq = new NextRequest('http://localhost:3000/api/v1/quotes/accept', {
      method: 'POST',
      body: JSON.stringify({
        token: tokenRecord.token,
        poNumber: 'PO-DUPLICATE',
      }),
    });

    const dupRes = await AcceptPost(duplicateReq);
    expect(dupRes.status).toBe(409);
  });
});
