import { describe, it, expect, beforeEach } from 'vitest';
import { ClaimsAlertEngine, ClaimsAlertInput } from '../src/lib/pod/claims-alert-engine';
import { dbClient } from '../src/db/client';

describe('Phase 4.3: Claims Alert Dispatcher Engine (ClaimsAlertEngine)', () => {
  const tenantId = '01916362-7901-7080-867c-9b8895092a01';
  const shipmentId = '01916362-7901-7080-867c-9b8895092e01';

  beforeEach(() => {
    dbClient.setTenantContext(tenantId);
  });

  it('calculates estimated liability claim based on declared value proportion', () => {
    const input: ClaimsAlertInput = {
      tenantId,
      shipmentId,
      referenceNumber: 'LTL-2026-8941',
      carrierName: 'SAIA LTL Freight',
      carrierScac: 'SAIA',
      consigneeName: 'Apex Distribution Hub',
      destCityState: 'Chicago, IL',
      severity: 'HIGH',
      detectedKeywords: ['Shortage', 'Damaged'],
      notationSnippets: ['1 pallet short, 1 pallet crushed'],
      receivedPieces: 3,
      expectedPieces: 4,
      declaredValueCents: 1000000, // $10,000.00
    };

    const claimCents = ClaimsAlertEngine.calculateEstimatedClaimCents(input, 1);
    // Shortage = 1/4 * 1000000 = $2,500 (250,000 cents)
    // Remaining cargo damaged (3 pallets = $7,500) * 50% = $3,750 (375,000 cents)
    // Total = 250000 + 375000 = 625000 cents ($6,250.00)
    expect(claimCents).toBe(625000);
  });

  it('dispatches high-priority incident alert, creates DB delivery_exceptions record, and formats HTML/Webhook payloads', async () => {
    const alertInput: ClaimsAlertInput = {
      tenantId,
      shipmentId,
      referenceNumber: 'LTL-2026-8941',
      carrierName: 'SAIA LTL Freight',
      carrierScac: 'SAIA',
      consigneeName: 'Apex Distribution Hub',
      destCityState: 'Chicago, IL',
      deliveryDate: '2026-09-01',
      severity: 'CRITICAL',
      detectedKeywords: ['Refused', 'Water Damage', 'Crushed'],
      notationSnippets: ['Consignee refused delivery. Pallets crushed and soaked with water.'],
      receivedPieces: 0,
      expectedPieces: 4,
      photoUrl: 'https://cdn.apexfreightos.com/pod/damaged_skid_01.jpg',
      declaredValueCents: 1200000, // $12,000.00
      claimsContactEmail: 'risk-management@shipper.com',
      claimsWebhookUrl: 'https://api.tms-shipper.com/webhooks/claims',
    };

    const result = await ClaimsAlertEngine.dispatchClaimsAlert(alertInput);

    expect(result.success).toBe(true);
    expect(result.exceptionId).toBeDefined();
    expect(result.severity).toBe('CRITICAL');
    expect(result.estimatedLiabilityClaimDollars).toBe('12000.00');

    // DB Record Check
    const dbRecord = dbClient.deliveryExceptions.get(result.exceptionId);
    expect(dbRecord).toBeDefined();
    expect(dbRecord?.tenantId).toBe(tenantId);
    expect(dbRecord?.shipmentId).toBe(shipmentId);
    expect(dbRecord?.severity).toBe('CRITICAL');
    expect(dbRecord?.keywordsDetected).toContain('Water Damage');
    expect(dbRecord?.reportedPiecesShort).toBe(4);
    expect(dbRecord?.claimAmountCents).toBe(1200000);

    // Email Payload Format Check
    expect(result.alertPayload.subject).toContain('[URGENT CLAIMS ALERT - CRITICAL]');
    expect(result.alertPayload.subject).toContain('LTL-2026-8941');
    expect(result.alertPayload.emailHtml).toContain('CRITICAL FREIGHT EXCEPTION');
    expect(result.alertPayload.emailHtml).toContain('Water Damage');
    expect(result.alertPayload.emailHtml).toContain('$12000.00 USD');
    expect(result.alertPayload.emailHtml).toContain('https://cdn.apexfreightos.com/pod/damaged_skid_01.jpg');

    // Webhook Payload Format Check
    expect(result.alertPayload.webhookPayload.eventType).toBe('FREIGHT_DELIVERY_EXCEPTION');
    expect(result.alertPayload.webhookPayload.claimEstimate.amountDollars).toBe('12000.00');
    expect(result.dispatchStatus.emailDispatched).toBe(true);
    expect(result.dispatchStatus.webhookDispatched).toBe(true);
    expect(result.dispatchStatus.dispatchedTo).toContain('risk-management@shipper.com');
  });
});
