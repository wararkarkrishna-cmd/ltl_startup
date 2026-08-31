import { describe, it, expect } from 'vitest';
import { CarrierTenderEngine } from '../src/lib/tender/carrier-tender-engine';
import { POST as SubmitPost } from '../src/app/api/v1/tender/submit/route';
import { POST as WebhookPost } from '../src/app/api/v1/tender/edi990-webhook/route';
import { NextRequest } from 'next/server';

describe('Phase 3.3: Electronic Carrier Tender Integration & ANSI X12 EDI 204/990', () => {
  const tenantId = '01916362-7901-7080-867c-9b8895092a01';
  const shipmentId = '01916362-7901-7080-867c-9b8895092s01';
  const quoteId = '01916362-7901-7080-867c-9b8895092q01';

  it('generates valid ANSI X12 EDI 204 Motor Carrier Load Tender payload', () => {
    const edi204 = CarrierTenderEngine.generateEdi204(
      {
        referenceNumber: 'SHP-99201',
        originCity: 'Dallas',
        originState: 'TX',
        originZip: '75201',
        destCity: 'Atlanta',
        destState: 'GA',
        destZip: '30301',
        totalWeightLbs: 3400,
        totalPallets: 4,
      },
      {},
      'CNWY',
      '2026-09-01'
    );

    expect(edi204).toContain('ST*204*0001~');
    expect(edi204).toContain('B2**CNWY*SHP-99201**PP~');
    expect(edi204).toContain('B2A*00*LT~');
    expect(edi204).toContain('N1*SH*SHIPPER DOCK FACILITY~');
    expect(edi204).toContain('N1*CN*CONSIGNEE RECEIVING DOCK~');
    expect(edi204).toContain('OID*SHP-99201***L*3400*LB***4*PLT~');
    expect(edi204).toContain('SE*16*0001~');
  });

  it('submits digital carrier tender via POST /api/v1/tender/submit', async () => {
    const req = new NextRequest('http://localhost:3000/api/v1/tender/submit', {
      method: 'POST',
      body: JSON.stringify({
        tenantId,
        shipmentId,
        quoteId,
        carrierCode: 'XPO',
        carrierScac: 'CNWY',
        carrierName: 'XPO Logistics',
        tenderMethod: 'EDI_204',
        pickupDate: '2026-09-01',
        specialInstructions: 'Dock appointment #9948',
      }),
    });

    const res = await SubmitPost(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.tender.tenderStatus).toBe('TENDER_ACCEPTED');
    expect(json.tender.proNumber).toMatch(/^CNWY\d+/);
    expect(json.tender.pickupConfirmationNumber).toMatch(/^PU-XPO-\d+/);
  });

  it('parses incoming EDI 990 (Tender Acceptance/Decline) webhook payloads', async () => {
    const sampleEdi990 = `
      ISA*00*          *00*          *02*CNWY           *ZZ*APEXFREIGHT    *260901*1200*U*00401*000000001*0*P*>~
      GS*GF*CNWY*APEXFREIGHT*20260901*1200*1*X*004010~
      ST*990*0001~
      B1*CNWY*SHP-99201*20260901*A~
      SE*4*0001~
      GE*1*1~
      IEA*1*000000001~
    `;

    const req = new NextRequest('http://localhost:3000/api/v1/tender/edi990-webhook', {
      method: 'POST',
      body: sampleEdi990,
    });

    const res = await WebhookPost(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.carrierScac).toBe('CNWY');
    expect(json.referenceNumber).toBe('SHP-99201');
    expect(json.actionCode).toBe('A');
    expect(json.isAccepted).toBe(true);
  });
});
