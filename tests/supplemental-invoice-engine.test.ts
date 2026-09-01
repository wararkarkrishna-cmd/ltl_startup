import { describe, it, expect, beforeEach } from 'vitest';
import {
  SupplementalInvoiceEngine,
  SupplementalReason,
} from '../src/lib/billing/supplemental-invoice-engine';
import { dbClient } from '../src/db/client';
import { generateUuidV7 } from '../src/lib/uuidv7';

describe('Phase 5.6: Customer Supplemental Invoice Engine', () => {
  const testTenantId = '01916362-7901-7080-867c-9b8895092a01';

  beforeEach(() => {
    dbClient.setTenantContext(testTenantId);
  });

  // ==========================================================================
  // 1. PASS-THROUGH LEGITIMACY CLASSIFICATION TESTS
  // ==========================================================================
  describe('Variance Legitimacy Classification (classifyVarianceLegitimacy)', () => {
    it('classifies verified shipper weight understatement (>500 lbs with scale cert) as legitimate customer pass-through', () => {
      const result = SupplementalInvoiceEngine.classifyVarianceLegitimacy({
        varianceType: 'UNAUTHORIZED_REWEIGH',
        amountCents: 18000,
        weightVarianceLbs: 650,
        hasScaleCertificate: true,
        inspectionDocumentUrl: 'https://storage.apexfreightos.com/scale-tickets/xpo-scale-650.pdf',
      });

      expect(result.isLegitimatePassThrough).toBe(true);
      expect(result.classification).toBe('CUSTOMER_SUPPLEMENTAL');
      expect(result.reasonCategory).toBe('WEIGHT_CORRECTION');
      expect(result.recommendedAction).toBe('GENERATE_SUPPLEMENTAL_INVOICE');
      expect(result.explanation).toContain('origin shipper understated cargo weight by +650 lbs');
      expect(result.confidenceScore).toBeGreaterThanOrEqual(95.0);
    });

    it('classifies unverified weight adjustment without scale certificate as carrier overcharge dispute', () => {
      const result = SupplementalInvoiceEngine.classifyVarianceLegitimacy({
        varianceType: 'UNAUTHORIZED_REWEIGH',
        amountCents: 22000,
        weightVarianceLbs: 550,
        hasScaleCertificate: false,
      });

      expect(result.isLegitimatePassThrough).toBe(false);
      expect(result.classification).toBe('CARRIER_OVERCHARGE_DISPUTE');
      expect(result.reasonCategory).toBe('DISPUTABLE_OVERCHARGE');
      expect(result.recommendedAction).toBe('ROUTE_TO_CARRIER_DISPUTE');
      expect(result.explanation).toContain('without attaching certified terminal scale ticket');
    });

    it('classifies destination requested accessorial with signed POD notation as legitimate customer pass-through', () => {
      const result = SupplementalInvoiceEngine.classifyVarianceLegitimacy({
        varianceType: 'LG_DEL',
        amountCents: 7500,
        hasConsigneeNotation: true,
      });

      expect(result.isLegitimatePassThrough).toBe(true);
      expect(result.classification).toBe('CUSTOMER_SUPPLEMENTAL');
      expect(result.reasonCategory).toBe('SITE_ACCESSORIAL_REQUEST');
      expect(result.recommendedAction).toBe('GENERATE_SUPPLEMENTAL_INVOICE');
      expect(result.explanation).toContain('verified written notation requesting destination accessorial');
    });

    it('classifies unrequested accessorial at verified commercial dock as carrier overcharge dispute', () => {
      const result = SupplementalInvoiceEngine.classifyVarianceLegitimacy({
        varianceType: 'INS_DEL',
        amountCents: 9500,
        hasConsigneeNotation: false,
        podVerifiedCommercialDock: true,
      });

      expect(result.isLegitimatePassThrough).toBe(false);
      expect(result.classification).toBe('CARRIER_OVERCHARGE_DISPUTE');
      expect(result.reasonCategory).toBe('DISPUTABLE_OVERCHARGE');
      expect(result.recommendedAction).toBe('ROUTE_TO_CARRIER_DISPUTE');
      expect(result.explanation).toContain('commercial dock with bay doors');
    });

    it('classifies driver dock detention exceeding contractual free time as legitimate customer pass-through', () => {
      const result = SupplementalInvoiceEngine.classifyVarianceLegitimacy({
        varianceType: 'DETENTION',
        amountCents: 15000,
        detentionMinutesLogged: 195,
        freeTimeMinutes: 120,
      });

      expect(result.isLegitimatePassThrough).toBe(true);
      expect(result.classification).toBe('CUSTOMER_SUPPLEMENTAL');
      expect(result.reasonCategory).toBe('DETENTION_SURCHARGE');
      expect(result.recommendedAction).toBe('GENERATE_SUPPLEMENTAL_INVOICE');
      expect(result.explanation).toContain('exceeds contractual free time (120 min) by 75 minutes');
    });

    it('classifies consignee closed / scheduled redelivery as legitimate customer pass-through', () => {
      const result = SupplementalInvoiceEngine.classifyVarianceLegitimacy({
        varianceType: 'REDELIVERY',
        amountCents: 12500,
        isConsigneeClosed: true,
      });

      expect(result.isLegitimatePassThrough).toBe(true);
      expect(result.classification).toBe('CUSTOMER_SUPPLEMENTAL');
      expect(result.reasonCategory).toBe('REDELIVERY_FEE');
      expect(result.recommendedAction).toBe('GENERATE_SUPPLEMENTAL_INVOICE');
      expect(result.explanation).toContain('Consignee receiving dock was closed');
    });
  });

  // ==========================================================================
  // 2. MARGIN MARKUP ENGINE & PRICING ARITHMETIC TESTS
  // ==========================================================================
  describe('Margin Markup Engine (calculateSupplementalPricing)', () => {
    it('applies default 15.0% broker margin markup with integer cents precision', () => {
      // $100.00 passed fee (10,000 cents) -> 15% markup = $15.00 (1,500 cents) -> Customer total = $115.00 (11,500 cents)
      const pricing1 = SupplementalInvoiceEngine.calculateSupplementalPricing(10000);
      expect(pricing1.passedThroughCostCents).toBe(10000);
      expect(pricing1.markupPercent).toBe(15.0);
      expect(pricing1.markupAmountCents).toBe(1500);
      expect(pricing1.customerPriceCents).toBe(11500);

      // $75.00 passed fee (7,500 cents) -> 15% markup = 1,125 cents -> Customer total = 8,625 cents ($86.25)
      const pricing2 = SupplementalInvoiceEngine.calculateSupplementalPricing(7500);
      expect(pricing2.markupAmountCents).toBe(1125);
      expect(pricing2.customerPriceCents).toBe(8625);
    });

    it('applies custom configured broker margin markup percentage', () => {
      // 20% custom markup on $200.00 (20,000 cents) -> $40.00 markup (4,000 cents) -> Total $240.00 (24,000 cents)
      const pricingCustom = SupplementalInvoiceEngine.calculateSupplementalPricing(20000, 20.0);
      expect(pricingCustom.markupPercent).toBe(20.0);
      expect(pricingCustom.markupAmountCents).toBe(4000);
      expect(pricingCustom.customerPriceCents).toBe(24000);

      // 0% passthrough
      const pricingZero = SupplementalInvoiceEngine.calculateSupplementalPricing(5000, 0.0);
      expect(pricingZero.markupAmountCents).toBe(0);
      expect(pricingZero.customerPriceCents).toBe(5000);
    });
  });

  // ==========================================================================
  // 3. SEQUENTIAL SUPPLEMENTAL INVOICE NUMBER GENERATOR TESTS
  // ==========================================================================
  describe('Supplemental Invoice Number Generator', () => {
    it('generates sequential invoice numbers with -SUP1, -SUP2 suffixes', () => {
      const num1 = SupplementalInvoiceEngine.generateSupplementalInvoiceNumber('INV-2026-08842', 0);
      expect(num1).toBe('INV-2026-08842-SUP1');

      const num2 = SupplementalInvoiceEngine.generateSupplementalInvoiceNumber('INV-2026-08842', 1);
      expect(num2).toBe('INV-2026-08842-SUP2');

      const num3 = SupplementalInvoiceEngine.generateSupplementalInvoiceNumber('INV-2026-08842-SUP1', 1);
      expect(num3).toBe('INV-2026-08842-SUP2');
    });
  });

  // ==========================================================================
  // 4. SUPPLEMENTAL INVOICE GENERATION & DATABASE PERSISTENCE TESTS
  // ==========================================================================
  describe('generateSupplementalInvoice method', () => {
    it('generates and persists supplemental invoice linked to parent invoice with markup, HTML, and PDF buffer', async () => {
      // 1. Seed Shipment and Parent Customer Invoice
      const shipment = await dbClient.insertShipment({
        tenantId: testTenantId,
        referenceNumber: 'SHP-2026-SUPP-01',
        status: 'DELIVERED',
        originAddress1: '123 Main Street',
        originCity: 'Los Angeles',
        originState: 'CA',
        originZip: '90001',
        originCountry: 'US',
        destAddress1: '456 Market Street',
        destCity: 'Chicago',
        destState: 'IL',
        destZip: '60601',
        destCountry: 'US',
        totalPallets: 3,
        totalWeightLbs: 2400,
        pickupDateReady: '2026-08-15',
      });

      const parentInvoice = await dbClient.insertCustomerInvoice({
        tenantId: testTenantId,
        shipmentId: shipment.id,
        invoiceNumber: 'INV-2026-08842',
        customerPoNumber: 'PO-CLIENT-9842',
        shipperName: 'Industrial Parts Manufacturing Corp.',
        shipperEmail: 'ap@industrialparts.com',
        shipperAddress: '123 Main Street, Los Angeles, CA 90001',
        linehaulAmountCents: 95000,
        fuelSurchargeCents: 15000,
        accessorialAmountCents: 0,
        totalAmountCents: 110000,
        currency: 'USD',
        paymentTermsDays: 30,
        invoiceDate: '2026-08-20',
        dueDate: '2026-09-19',
        remitInstructions: {
          bankName: 'JPMorgan Chase Bank',
          routingNumber: '021000021',
          accountNumber: '984021984210',
          remitEmail: 'remit@apexfreightos.com',
          remitAddress: 'Apex Freight, Chicago IL',
        },
        status: 'ISSUED',
      });

      // 2. Execute generateSupplementalInvoice for WEIGHT_CORRECTION (+650 lbs)
      const result = await SupplementalInvoiceEngine.generateSupplementalInvoice({
        tenantId: testTenantId,
        originalInvoiceId: parentInvoice.id,
        reason: 'WEIGHT_CORRECTION',
        passedThroughCostCents: 18000, // $180.00 carrier reweigh charge
        markupPercent: 15.0,           // 15% markup = $27.00
        supportingEvidenceDescription: 'Certified carrier terminal scale weight certificate verified cargo weight at 3,050 lbs (+650 lbs variance vs 2,400 lbs declared on BOL). Scale Ticket #ST-99841.',
        inspectionDocumentUrl: 'https://storage.apexfreightos.com/scale-tickets/st-99841.pdf',
        customLineItemDescription: 'Origin Cargo Weight Understatement (+650 lbs confirmed on certified scale ticket)',
      });

      expect(result.success).toBe(true);
      expect(result.parentInvoice.id).toBe(parentInvoice.id);

      // Verify Pricing
      expect(result.pricing.passedThroughCostCents).toBe(18000);
      expect(result.pricing.markupPercent).toBe(15.0);
      expect(result.pricing.markupAmountCents).toBe(2700);
      expect(result.pricing.totalSupplementalCustomerPriceCents).toBe(20700); // $207.00

      // Verify Supplemental CustomerInvoice record
      const suppInv = result.supplementalInvoice;
      expect(suppInv.invoiceNumber).toBe('INV-2026-08842-SUP1');
      expect(suppInv.isSupplemental).toBe(true);
      expect(suppInv.parentInvoiceId).toBe(parentInvoice.id);
      expect(suppInv.supplementalReason).toBe('WEIGHT_CORRECTION');
      expect(suppInv.passedThroughCostCents).toBe(18000);
      expect(suppInv.markupPercent).toBe(15.0);
      expect(suppInv.markupAmountCents).toBe(2700);
      expect(suppInv.totalAmountCents).toBe(20700);
      expect(suppInv.status).toBe('ISSUED');
      expect(suppInv.supportingEvidenceDescription).toContain('Certified carrier terminal scale weight certificate');
      expect(suppInv.inspectionDocumentUrl).toBe('https://storage.apexfreightos.com/scale-tickets/st-99841.pdf');

      // Verify Database Linkage via getCustomerInvoicesByParentId
      const linkedList = await dbClient.getCustomerInvoicesByParentId(testTenantId, parentInvoice.id);
      expect(linkedList.length).toBe(1);
      expect(linkedList[0].id).toBe(suppInv.id);

      // Verify Second Supplemental gets sequential SUP2
      const result2 = await SupplementalInvoiceEngine.generateSupplementalInvoice({
        tenantId: testTenantId,
        originalInvoiceId: parentInvoice.id,
        reason: 'SITE_ACCESSORIAL_REQUEST',
        passedThroughCostCents: 7500, // $75.00 liftgate
        markupPercent: 15.0,
        supportingEvidenceDescription: 'Consignee signed delivery receipt with liftgate service notation.',
      });

      expect(result2.supplementalInvoice.invoiceNumber).toBe('INV-2026-08842-SUP2');
      expect(result2.pricing.passedThroughCostCents).toBe(7500);
      expect(result2.pricing.markupAmountCents).toBe(1125);
      expect(result2.pricing.totalSupplementalCustomerPriceCents).toBe(8625);

      const linkedList2 = await dbClient.getCustomerInvoicesByParentId(testTenantId, parentInvoice.id);
      expect(linkedList2.length).toBe(2);

      // Verify HTML output
      expect(result.htmlContent).toContain('APEX FREIGHT SOLUTIONS');
      expect(result.htmlContent).toContain('CUSTOMER SUPPLEMENTAL INVOICE');
      expect(result.htmlContent).toContain('INV-2026-08842-SUP1');
      expect(result.htmlContent).toContain('INV-2026-08842');
      expect(result.htmlContent).toContain('$180.00');
      expect(result.htmlContent).toContain('$27.00');
      expect(result.htmlContent).toContain('$207.00');
      expect(result.htmlContent).toContain('Certified Weight Adjustment & Reweigh Surcharge');

      // Verify PDF Buffer
      expect(result.pdfBuffer).toBeInstanceOf(Buffer);
      expect(result.pdfBuffer.length).toBeGreaterThan(1000);
      expect(result.pdfBuffer.subarray(0, 5).toString('ascii')).toBe('%PDF-');

      // Verify Email Dispatch Status
      expect(result.emailDispatchStatus.sent).toBe(true);
      expect(result.emailDispatchStatus.recipient).toBe('ap@industrialparts.com');
      expect(result.emailDispatchStatus.subject).toContain('INV-2026-08842-SUP1');
    });

    it('throws error when parent invoice is not found', async () => {
      await expect(
        SupplementalInvoiceEngine.generateSupplementalInvoice({
          tenantId: testTenantId,
          originalInvoiceId: generateUuidV7(),
          reason: 'REDELIVERY_FEE',
          passedThroughCostCents: 10000,
          supportingEvidenceDescription: 'Consignee closed',
        })
      ).rejects.toThrow(/Original customer invoice with ID .* not found/);
    });
  });
});
