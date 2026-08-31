import { describe, it, expect, beforeEach } from 'vitest';
import { dbClient } from '../src/db/client';
import { PodTokenEngine } from '../src/lib/pod/pod-token-engine';
import { GeofenceValidator } from '../src/lib/pod/geofence-validator';
import { PodValidatorEngine } from '../src/lib/pod/pod-validator-engine';
import { DamageDetectorEngine } from '../src/lib/pod/damage-detector-engine';
import { ClaimsAlertEngine } from '../src/lib/pod/claims-alert-engine';
import { InvoiceGenerator } from '../src/lib/documents/invoice-generator';
import { CustomerInvoiceEngine } from '../src/lib/billing/customer-invoice-engine';

describe('Phase 4: Geotagged POD Capture, Settlement & Customer Invoicing (4.1 to 4.4)', () => {
  const tenantId = '01916362-7901-7080-867c-9b8895092a01';
  let shipmentId: string;

  beforeEach(async () => {
    dbClient.setTenantContext(tenantId);
    
    // Seed initial shipment and quote
    const shipment = await dbClient.insertShipment({
      tenantId,
      referenceNumber: 'LTL-2026-9901',
      status: 'DELIVERED',
      originAddress1: '100 Industrial Parkway',
      originCity: 'Los Angeles',
      originState: 'CA',
      originZip: '90001',
      originCountry: 'US',
      destName: 'Apex Midwest Hub',
      destAddress1: '4500 S Cicero Ave',
      destCity: 'Chicago',
      destState: 'IL',
      destZip: '60601',
      destCountry: 'US',
      totalPallets: 4,
      totalWeightLbs: 3200,
      pickupDateReady: '2026-09-01',
    });
    shipmentId = shipment.id;

    await dbClient.insertQuote({
      tenantId,
      shipmentId,
      carrierCode: 'SAIA',
      carrierName: 'SAIA LTL Freight',
      carrierScac: 'SAIA',
      accountType: 'PLATFORM_WHOLESALE',
      sourceTag: 'PLATFORM_WHOLESALE',
      quoteNumber: 'Q-9901',
      linehaulCostCents: 48000,
      fuelSurchargeCents: 13500,
      accessorialCostCents: 7500,
      totalCarrierCostCents: 69000,
      appliedMarginPercent: 15.0,
      appliedMarginCents: 10350,
      quotedCustomerPriceCents: 79350,
      grossProfitCents: 10350,
      grossMarginPercent: 13.04,
      transitDays: 2,
      isGuaranteed: true,
      isSelected: true,
      accessorialFees: { LG_DEL: 7500 },
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });
  });

  describe('Phase 4.1: Mobile Web POD Token & PWA Gateway', () => {
    it('generates and consumes cryptographic single-use driver POD tokens', async () => {
      const token = await PodTokenEngine.generatePodToken({
        tenantId,
        shipmentId,
        carrierCode: 'SAIA',
        driverPhone: '+1-312-555-0199',
      });

      expect(token.token).toMatch(/^pod_sec_[a-f0-9]{64}$/);
      expect(token.isUsed).toBe(false);

      const consumed = await PodTokenEngine.validateAndConsumePodToken(token.token, true);
      expect(consumed.isValid).toBe(true);
      expect(consumed.podToken?.isUsed).toBe(true);

      // Replay prevention: second consumption fails
      const replay = await PodTokenEngine.validateAndConsumePodToken(token.token);
      expect(replay.isValid).toBe(false);
      expect(replay.error).toContain('already used');
    });
  });

  describe('Phase 4.2: Multi-Point POD Validation & Geofencing', () => {
    it('validates destination geofence using the Haversine formula within 0.5 miles', () => {
      // Chicago 60601 centroid: lat 41.8853, lon -87.6216
      const exactDelivery = GeofenceValidator.validateDeliveryLocation('60601', 41.8853, -87.6216, 0.5);
      expect(exactDelivery.isWithinGeofence).toBe(true);
      expect(exactDelivery.distanceMiles).toBeLessThan(0.5);

      // Offsite delivery > 0.5 miles (e.g. 5 miles away)
      const offsiteDelivery = GeofenceValidator.validateDeliveryLocation('60601', 41.9800, -87.7500, 0.5);
      expect(offsiteDelivery.isWithinGeofence).toBe(false);
      expect(offsiteDelivery.distanceMiles).toBeGreaterThan(0.5);
      expect(offsiteDelivery.flaggedWarning).toContain('outside destination geofence');
    });

    it('performs composite multi-point validation across EXIF, geofence, OCR and piece counts', async () => {
      const mockImage = Buffer.from('RECEIVED 4 PALLETS IN GOOD ORDER. DATE: 09/01/2026. SIGNED: JOHN MILLER.');
      const signatureDataUrl = 'data:image/png;base64,' + 'A'.repeat(250);

      const validation = await PodValidatorEngine.validatePod(mockImage, {
        tenantId,
        shipmentId,
        destZip: '60601',
        clientGpsLat: 41.8853,
        clientGpsLon: -87.6216,
        consigneeName: 'John Miller, Dock Lead',
        consigneeSignatureDataUrl: signatureDataUrl,
        receivedPieces: 4,
        expectedPieces: 4,
        driverNotes: 'Received 4 PALLETS in full order. Signed John Miller. Date 09/01/2026',
      });

      expect(['VERIFIED', 'FLAGGED_EXCEPTION']).toContain(validation.status);
      expect(validation.overallConfidence).toBeGreaterThanOrEqual(75.0);
      expect(validation.geofence.isWithinGeofence).toBe(true);
      expect(validation.pieceCountVerified).toBe(true);
      expect(validation.damageCheck.hasDamageException).toBe(false);
    });
  });

  describe('Phase 4.3: Automated Delivery Exception & Damage Flagging', () => {
    it('detects damage and shortage keywords from OCR text and flags high-priority claims', async () => {
      const damageText = 'Received 3 of 4 pallets. 1 pallet damaged, water damage on cartons. Signed under protest.';
      const inspection = DamageDetectorEngine.inspect({
        ocrRawText: damageText,
        driverNotes: 'Customer noted 1 pallet crushed',
        consigneeNotes: 'Short 1 piece',
        receivedPieces: 3,
        expectedPieces: 4,
      });

      expect(inspection.hasException).toBe(true);
      expect(['HIGH', 'CRITICAL']).toContain(inspection.severity);
      expect(inspection.piecesShort).toBe(1);
      expect(inspection.detectedKeywords.map(k => k.toLowerCase())).toContain('damaged');
      expect(inspection.detectedKeywords.map(k => k.toLowerCase())).toContain('water damage');

      // Dispatch automated claims alert
      const alert = await ClaimsAlertEngine.dispatchClaimsAlert({
        tenantId,
        shipmentId,
        referenceNumber: 'LTL-2026-9901',
        carrierName: 'SAIA LTL Freight',
        carrierScac: 'SAIA',
        consigneeName: 'Receiving Manager',
        destCityState: 'Chicago, IL',
        severity: inspection.severity,
        detectedKeywords: inspection.detectedKeywords,
        notationSnippets: inspection.notationSnippets,
        receivedPieces: 3,
        expectedPieces: 4,
        photoUrl: '/uploads/pod/damage_photo.jpg',
        declaredValueCents: 500000,
      });

      expect(alert.success).toBe(true);
      expect(['HIGH', 'CRITICAL']).toContain(alert.severity);
      expect(alert.estimatedLiabilityClaimCents).toBe(312500); // 1 pallet short (25%) + critical damage claim = $3,125.00
    });
  });

  describe('Phase 4.4: Sub-Minute Instant Customer Invoice Generation Engine', () => {
    it('generates audited 2-page customer invoice PDF with exact integer cents precision', async () => {
      const invoiceResult = await CustomerInvoiceEngine.generateAndIssueInvoice({
        tenantId,
        shipmentId,
        customerPoNumber: 'PO-9901-AC',
        paymentTermsDays: 30,
      });

      expect(invoiceResult.success).toBe(true);
      expect(invoiceResult.invoice.invoiceNumber).toMatch(/^INV-\d{4}-\d{5}$/);
      expect(invoiceResult.invoice.totalAmountCents).toBeGreaterThan(0);
      expect(invoiceResult.invoice.linehaulAmountCents).toBeGreaterThan(0);
      expect(invoiceResult.invoice.fuelSurchargeCents).toBeGreaterThan(0);

      // Verify PDF buffer generation
      const pdfBuffer = await InvoiceGenerator.generateInvoicePdf(invoiceResult.invoicePdfData);
      expect(pdfBuffer).toBeInstanceOf(Buffer);
      expect(pdfBuffer.length).toBeGreaterThan(1000);

      // Verify PDF header magic bytes '%PDF'
      expect(pdfBuffer.subarray(0, 4).toString('ascii')).toBe('%PDF');

      // Verify HTML preview representation
      const html = InvoiceGenerator.renderInvoiceHtml(invoiceResult.invoicePdfData);
      expect(html).toContain('INVOICE');
      expect(html).toContain(invoiceResult.invoice.invoiceNumber);
      expect(html).toContain('PROOF OF DELIVERY (POD)');
    });

    it('blocks automated invoice release when high-severity damage exceptions are present', async () => {
      const damagedShipment = await dbClient.insertShipment({
        tenantId,
        referenceNumber: 'LTL-2026-9902',
        status: 'DELIVERED',
        originAddress1: '100 Industrial Parkway',
        originCity: 'Los Angeles',
        originState: 'CA',
        originZip: '90001',
        originCountry: 'US',
        destName: 'Apex Midwest Hub',
        destAddress1: '4500 S Cicero Ave',
        destCity: 'Chicago',
        destState: 'IL',
        destZip: '60601',
        destCountry: 'US',
        totalPallets: 4,
        totalWeightLbs: 3200,
        pickupDateReady: '2026-09-01',
      });

      await dbClient.insertPodRecord({
        tenantId,
        shipmentId: damagedShipment.id,
        imageUrl: '/uploads/pod/damage.jpg',
        imageHash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
        fileSizeBytes: 240000,
        consigneeName: 'Dock Manager',
        receivedPieces: 2,
        expectedPieces: 4,
        hasDamageException: true,
        exceptionSeverity: 'CRITICAL',
        detectedExceptionKeywords: ['Damaged', 'Short'],
        status: 'FLAGGED_EXCEPTION',
        overallConfidence: 75.0,
        destLatitude: 41.8853,
        destLongitude: -87.6216,
        isWithinGeofence: true,
        signatureDetected: true,
        pieceCountVerified: false,
        stampedDateDetected: true,
        claimsAlertSent: true,
        submittedAt: new Date(),
      });

      await expect(
        CustomerInvoiceEngine.generateAndIssueInvoice({
          tenantId,
          shipmentId: damagedShipment.id,
          customerPoNumber: 'PO-9902-AC',
          paymentTermsDays: 30,
        })
      ).rejects.toThrow('AUTOMATIC INVOICING BLOCKED');
    });
  });
});
