import { describe, it, expect } from 'vitest';
import {
  DispatchNotificationEngine,
  RateConfirmationData,
} from '../src/lib/dispatch/dispatch-notification-engine';
import { POST as NotifyPost } from '../src/app/api/v1/dispatch/notify/route';
import { NextRequest } from 'next/server';

describe('Phase 3.6: Carrier & Driver Tender Notification System', () => {
  const sampleRateData: RateConfirmationData = {
    rateConfirmationNumber: 'RC-2026-99482',
    loadReference: 'SHP-99201',
    date: '2026-09-01',
    carrierName: 'SAIA LTL Freight',
    carrierScac: 'SAIA',
    originName: 'Global Supply Facility',
    originAddress: '100 Industrial Pkwy',
    originCityStateZip: 'Los Angeles, CA 90001',
    pickupDate: '2026-09-01',
    pickupNumber: 'PU-SAIA-88210',
    destName: 'Midwest Distribution Depot',
    destAddress: '500 Logistics Way',
    destCityStateZip: 'Chicago, IL 60601',
    deliveryDateEst: '2026-09-03',
    totalPallets: 4,
    totalWeightLbs: 3200,
    commodityDescription: 'COMMERCIAL HEATING EQUIPMENT',
    linehaulAgreedCents: 50000,
    fuelAgreedCents: 14000,
    accessorialAgreedCents: 7500,
    totalAgreedCarrierRateCents: 71500,
    specialInstructions: 'Driver must check in at guard house.',
    ebolUrl: 'https://freight-os.com/ebol/BOL-2026-99201',
  };

  it('builds clear SMS and Email dispatch payloads for drivers and carrier desks', () => {
    const notifications = DispatchNotificationEngine.buildDispatchNotifications(
      sampleRateData,
      'dispatch@saia.com',
      '555-0199'
    );

    expect(notifications.smsMessage).toContain('DISPATCH ALERT: Load #SHP-99201');
    expect(notifications.smsMessage).toContain('$715.00');
    expect(notifications.smsMessage).toContain('PU-SAIA-88210');
    expect(notifications.smsMessage).toContain('https://freight-os.com/ebol/BOL-2026-99201');

    expect(notifications.emailSubject).toContain('DISPATCH ORDER & RATE CONFIRMATION');
    expect(notifications.emailBodyHtml).toContain('RC-2026-99482');
    expect(notifications.emailBodyHtml).toContain('View & Print Digital eBOL');
  });

  it('generates binary PDF Rate Confirmation document', async () => {
    const pdfBuffer = await DispatchNotificationEngine.generateRateConfirmationPdf(sampleRateData);

    expect(pdfBuffer).toBeDefined();
    expect(Buffer.isBuffer(pdfBuffer)).toBe(true);
    expect(pdfBuffer.length).toBeGreaterThan(1000);
    expect(pdfBuffer.slice(0, 4).toString('utf8')).toBe('%PDF');
  });

  it('handles notification dispatch via POST /api/v1/dispatch/notify', async () => {
    const req = new NextRequest('http://localhost:3000/api/v1/dispatch/notify', {
      method: 'POST',
      body: JSON.stringify({
        tenantId: '01916362-7901-7080-867c-9b8895092a01',
        recipientEmail: 'dispatch@saia.com',
        recipientPhone: '555-0199',
        rateConfirmationData: sampleRateData,
      }),
    });

    const res = await NotifyPost(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.pdfGenerated).toBe(true);
    expect(json.notifications.rateConfirmationNumber).toBe('RC-2026-99482');
  });
});
