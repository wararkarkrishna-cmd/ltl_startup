import { describe, it, expect, beforeEach } from 'vitest';
import { dbClient } from '../src/db/client';
import { ReBillAuditEngine } from '../src/lib/audit/re-bill-audit-engine';
import { generateUuidV7 } from '../src/lib/uuidv7';

describe('Phase 5.2: Line-Item Delta Cross-Auditing Engine (ReBillAuditEngine)', () => {
  const tenantId = '01916362-7901-7080-867c-9b8895092a01';
  let shipmentId: string;
  let quoteId: string;

  beforeEach(async () => {
    dbClient.setTenantContext(tenantId);
    dbClient.carrierInvoices.clear();
    dbClient.discrepancyRecords.clear();
    dbClient.rateConfirmations.clear();

    // 1. Seed Shipment
    const shipment = await dbClient.insertShipment({
      tenantId,
      referenceNumber: 'SHP-AUDIT-2026-001',
      status: 'DELIVERED',
      originAddress1: '100 Industrial Parkway',
      originCity: 'Dallas',
      originState: 'TX',
      originZip: '75201',
      originCountry: 'US',
      destAddress1: '500 Commerce Way',
      destCity: 'Atlanta',
      destState: 'GA',
      destZip: '30301',
      destCountry: 'US',
      totalPallets: 4,
      totalWeightLbs: 3500,
      pickupDateReady: '2026-09-01',
    });
    shipmentId = shipment.id;

    // 2. Seed Shipment Items (NMFC Class 70)
    const item = {
      id: generateUuidV7(),
      shipmentId,
      tenantId,
      quantity: 4,
      packagingType: 'PALLET' as const,
      lengthIn: 48,
      widthIn: 40,
      heightIn: 48,
      weightLbs: 3500,
      pcfDensity: 11.8,
      nmfcClass: '70' as const,
      commodityDescription: 'Automotive Replacement Parts',
      isStackable: true,
      isHazmat: false,
      createdAt: new Date(),
    };
    dbClient.shipmentItems.set(item.id, item);

    // 3. Seed Quote: Linehaul $450.00, Fuel $120.00, Total $570.00
    const quote = await dbClient.insertQuote({
      tenantId,
      shipmentId,
      carrierCode: 'XPO',
      carrierName: 'XPO Logistics',
      carrierScac: 'XPO',
      quoteNumber: 'Q-XPO-984210',
      sourceTag: 'CONTRACT_CZARLITE_2020',
      linehaulCostCents: 45000,
      fuelSurchargeCents: 12000,
      accessorialCostCents: 0,
      totalCarrierCostCents: 57000,
      accountType: 'DIRECT_BYOC',
      isGuaranteed: false,
      appliedMarginPercent: 15.0,
      appliedMarginCents: 10059,
      quotedCustomerPriceCents: 67059,
      grossProfitCents: 10059,
      grossMarginPercent: 15.0,
      transitDays: 2,
      isSelected: true,
      accessorialFees: {},
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });
    quoteId = quote.id;
  });

  describe('Clean Match & Tolerance Threshold Rule ($5.00 / 500 cents)', () => {
    it('classifies exact match carrier invoice as AUDITED_CLEAN with zero deltas', async () => {
      const invoice = await dbClient.insertCarrierInvoice({
        tenantId,
        shipmentId,
        carrierScac: 'XPO',
        carrierName: 'XPO Logistics',
        proNumber: 'PRO-9928101',
        invoiceNumber: 'INV-XPO-001',
        totalBilledCents: 57000,
        billedLinehaulCents: 45000,
        billedFuelCents: 12000,
        billedAccessorialCents: 0,
        billedAccessorials: {},
        billedWeightLbs: 3500,
        billedClass: '70',
        invoiceDate: '2026-09-05',
        status: 'PENDING_AUDIT',
      });

      const auditResult = await ReBillAuditEngine.auditCarrierInvoice(tenantId, invoice.id);

      expect(auditResult.status).toBe('AUDITED_CLEAN');
      expect(auditResult.isWithinTolerance).toBe(true);
      expect(auditResult.hasUnapprovedAccessorials).toBe(false);
      expect(auditResult.invoicedTotalCents).toBe(57000);
      expect(auditResult.expectedTotalCents).toBe(57000);
      expect(auditResult.deltas.totalDeltaCents).toBe(0);
      expect(auditResult.deltas.linehaulDeltaCents).toBe(0);
      expect(auditResult.deltas.fuelDeltaCents).toBe(0);
      expect(auditResult.deltas.accessorialDeltaCents).toBe(0);
      expect(auditResult.deltas.weightDeltaLbs).toBe(0);
      expect(auditResult.discrepancyCount).toBe(0);

      // Verify invoice status was updated in DB
      const updatedInvoice = await dbClient.getCarrierInvoiceById(invoice.id);
      expect(updatedInvoice?.status).toBe('AUDITED_CLEAN');
    });

    it('classifies small rounding discrepancy ($2.50 / 250 cents) within $5.00 tolerance as AUDITED_CLEAN', async () => {
      const invoice = await dbClient.insertCarrierInvoice({
        tenantId,
        shipmentId,
        carrierScac: 'XPO',
        carrierName: 'XPO Logistics',
        proNumber: 'PRO-9928102',
        invoiceNumber: 'INV-XPO-002',
        totalBilledCents: 57250, // $572.50 ($2.50 over)
        billedLinehaulCents: 45000,
        billedFuelCents: 12250,  // Fuel rounded slightly
        billedAccessorialCents: 0,
        billedAccessorials: {},
        billedWeightLbs: 3500,
        billedClass: '70',
        invoiceDate: '2026-09-05',
        status: 'PENDING_AUDIT',
      });

      const auditResult = await ReBillAuditEngine.auditCarrierInvoice(tenantId, invoice.id, {
        toleranceCents: 500,
      });

      expect(auditResult.status).toBe('AUDITED_CLEAN');
      expect(auditResult.isWithinTolerance).toBe(true);
      expect(auditResult.deltas.totalDeltaCents).toBe(250);
      expect(auditResult.deltas.fuelDeltaCents).toBe(250);
    });

    it('flags invoice as DISCREPANCY_FLAGGED when total delta exceeds $5.00 tolerance threshold', async () => {
      const invoice = await dbClient.insertCarrierInvoice({
        tenantId,
        shipmentId,
        carrierScac: 'XPO',
        carrierName: 'XPO Logistics',
        proNumber: 'PRO-9928103',
        invoiceNumber: 'INV-XPO-003',
        totalBilledCents: 65000, // $650.00 ($80.00 overcharge)
        billedLinehaulCents: 51000, // $60.00 linehaul overcharge
        billedFuelCents: 14000,     // $20.00 fuel overcharge
        billedAccessorialCents: 0,
        billedAccessorials: {},
        billedWeightLbs: 3500,
        billedClass: '70',
        invoiceDate: '2026-09-05',
        status: 'PENDING_AUDIT',
      });

      const auditResult = await ReBillAuditEngine.auditCarrierInvoice(tenantId, invoice.id);

      expect(auditResult.status).toBe('DISCREPANCY_FLAGGED');
      expect(auditResult.isWithinTolerance).toBe(false);
      expect(auditResult.deltas.totalDeltaCents).toBe(8000); // $80.00
      expect(auditResult.deltas.linehaulDeltaCents).toBe(6000); // $60.00
      expect(auditResult.deltas.fuelDeltaCents).toBe(2000); // $20.00
      expect(auditResult.discrepancyCount).toBeGreaterThan(0);

      const updatedInvoice = await dbClient.getCarrierInvoiceById(invoice.id);
      expect(updatedInvoice?.status).toBe('DISCREPANCY_FLAGGED');
    });
  });

  describe('Accessorial Delta Reconciliation & Injected Surcharge Detection', () => {
    it('detects newly injected carrier accessorial (Liftgate Delivery $75.00) not on original rate confirmation', async () => {
      const invoice = await dbClient.insertCarrierInvoice({
        tenantId,
        shipmentId,
        carrierScac: 'XPO',
        carrierName: 'XPO Logistics',
        proNumber: 'PRO-9928104',
        invoiceNumber: 'INV-XPO-004',
        totalBilledCents: 64500, // $570.00 + $75.00 LG_DEL
        billedLinehaulCents: 45000,
        billedFuelCents: 12000,
        billedAccessorialCents: 7500,
        billedAccessorials: {
          LG_DEL: 7500,
        },
        billedWeightLbs: 3500,
        billedClass: '70',
        invoiceDate: '2026-09-05',
        status: 'PENDING_AUDIT',
      });

      const auditResult = await ReBillAuditEngine.auditCarrierInvoice(tenantId, invoice.id);

      expect(auditResult.status).toBe('DISCREPANCY_FLAGGED');
      expect(auditResult.hasUnapprovedAccessorials).toBe(true);
      expect(auditResult.deltas.accessorialDeltaCents).toBe(7500);

      const lgItem = auditResult.deltas.accessorials.find((a) => a.code === 'LG_DEL');
      expect(lgItem).toBeDefined();
      expect(lgItem?.isUnapproved).toBe(true);
      expect(lgItem?.billedCents).toBe(7500);
      expect(lgItem?.quotedCents).toBe(0);
      expect(lgItem?.deltaCents).toBe(7500);
    });

    it('matches contracted accessorial fees without discrepancy when pre-approved on quote', async () => {
      // Clear previous quote to test pre-approved accessorial
      dbClient.quotes.clear();

      // Seed quote with approved Liftgate Delivery ($75.00)
      await dbClient.insertQuote({
        tenantId,
        shipmentId,
        carrierCode: 'XPO',
        carrierName: 'XPO Logistics',
        carrierScac: 'XPO',
        quoteNumber: 'Q-XPO-984211',
        sourceTag: 'CONTRACT_CZARLITE_2020',
        linehaulCostCents: 45000,
        fuelSurchargeCents: 12000,
        accessorialCostCents: 7500,
        totalCarrierCostCents: 64500,
        accountType: 'DIRECT_BYOC',
        isGuaranteed: false,
        appliedMarginPercent: 15.0,
        appliedMarginCents: 11382,
        quotedCustomerPriceCents: 75882,
        grossProfitCents: 11382,
        grossMarginPercent: 15.0,
        transitDays: 2,
        isSelected: true,
        accessorialFees: {
          LG_DEL: 7500,
        },
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      });

      const invoice = await dbClient.insertCarrierInvoice({
        tenantId,
        shipmentId,
        carrierScac: 'XPO',
        carrierName: 'XPO Logistics',
        proNumber: 'PRO-9928105',
        invoiceNumber: 'INV-XPO-005',
        totalBilledCents: 64500,
        billedLinehaulCents: 45000,
        billedFuelCents: 12000,
        billedAccessorialCents: 7500,
        billedAccessorials: {
          LG_DEL: 7500,
        },
        billedWeightLbs: 3500,
        billedClass: '70',
        invoiceDate: '2026-09-05',
        status: 'PENDING_AUDIT',
      });

      const auditResult = await ReBillAuditEngine.auditCarrierInvoice(tenantId, invoice.id);

      expect(auditResult.status).toBe('AUDITED_CLEAN');
      expect(auditResult.hasUnapprovedAccessorials).toBe(false);
      expect(auditResult.deltas.accessorialDeltaCents).toBe(0);

      const lgItem = auditResult.deltas.accessorials.find((a) => a.code === 'LG_DEL');
      expect(lgItem?.isUnapproved).toBe(false);
      expect(lgItem?.deltaCents).toBe(0);
    });
  });

  describe('Weight Delta & NMFC Class Bump Detection', () => {
    it('detects unapproved reweigh (+600 lbs)', async () => {
      const invoice = await dbClient.insertCarrierInvoice({
        tenantId,
        shipmentId,
        carrierScac: 'XPO',
        carrierName: 'XPO Logistics',
        proNumber: 'PRO-9928106',
        invoiceNumber: 'INV-XPO-006',
        totalBilledCents: 62500, // Invoiced higher due to reweigh
        billedLinehaulCents: 50500,
        billedFuelCents: 12000,
        billedAccessorialCents: 0,
        billedAccessorials: {},
        billedWeightLbs: 4100, // 4,100 lbs vs 3,500 lbs quoted (+600 lbs)
        billedClass: '70',
        invoiceDate: '2026-09-05',
        status: 'PENDING_AUDIT',
      });

      const auditResult = await ReBillAuditEngine.auditCarrierInvoice(tenantId, invoice.id);

      expect(auditResult.status).toBe('DISCREPANCY_FLAGGED');
      expect(auditResult.deltas.weightDeltaLbs).toBe(600);
      expect(auditResult.deltas.linehaulDeltaCents).toBe(5500);
    });

    it('detects uncertified NMFC reclassification bump (Class 70 -> Class 92.5)', async () => {
      const invoice = await dbClient.insertCarrierInvoice({
        tenantId,
        shipmentId,
        carrierScac: 'XPO',
        carrierName: 'XPO Logistics',
        proNumber: 'PRO-9928107',
        invoiceNumber: 'INV-XPO-007',
        totalBilledCents: 64000,
        billedLinehaulCents: 52000,
        billedFuelCents: 12000,
        billedAccessorialCents: 0,
        billedAccessorials: {},
        billedWeightLbs: 3500,
        billedClass: '92.5', // Bumped from 70 to 92.5
        invoiceDate: '2026-09-05',
        status: 'PENDING_AUDIT',
      });

      const auditResult = await ReBillAuditEngine.auditCarrierInvoice(tenantId, invoice.id);

      expect(auditResult.status).toBe('DISCREPANCY_FLAGGED');
      expect(auditResult.deltas.classDelta?.isBumped).toBe(true);
      expect(auditResult.deltas.classDelta?.quotedClass).toBe('70');
      expect(auditResult.deltas.classDelta?.billedClass).toBe('92.5');
    });
  });

  describe('Contract Baseline Precedence: Rate Confirmation vs Quote', () => {
    it('prioritizes RateConfirmation contract over Quote when both are present', async () => {
      // Seed signed Rate Confirmation with specific renegotiated rates
      await dbClient.insertRateConfirmation({
        tenantId,
        shipmentId,
        rateConfirmationNumber: 'RC-2026-9901',
        carrierCode: 'XPO',
        carrierName: 'XPO Logistics Priority',
        carrierScac: 'XPO',
        agreedLinehaulCents: 43000, // Renegotiated $430.00
        agreedFuelCents: 11000,     // Renegotiated $110.00
        agreedAccessorialCents: 0,
        totalAgreedRateCents: 54000,// Total agreed $540.00
        pickupNumber: 'PU-99120',
        pickupDate: '2026-09-01',
        deliveryDateEst: '2026-09-03',
      });

      const invoice = await dbClient.insertCarrierInvoice({
        tenantId,
        shipmentId,
        carrierScac: 'XPO',
        carrierName: 'XPO Logistics',
        proNumber: 'PRO-9928108',
        invoiceNumber: 'INV-XPO-008',
        totalBilledCents: 54000,
        billedLinehaulCents: 43000,
        billedFuelCents: 11000,
        billedAccessorialCents: 0,
        billedAccessorials: {},
        billedWeightLbs: 3500,
        billedClass: '70',
        invoiceDate: '2026-09-05',
        status: 'PENDING_AUDIT',
      });

      const auditResult = await ReBillAuditEngine.auditCarrierInvoice(tenantId, invoice.id);

      expect(auditResult.contractBaseline.source).toBe('RATE_CONFIRMATION');
      expect(auditResult.expectedTotalCents).toBe(54000);
      expect(auditResult.status).toBe('AUDITED_CLEAN');
    });
  });

  describe('Batch Auditing Pipeline (auditBatch)', () => {
    it('processes batch of carrier invoices and produces aggregate summary', async () => {
      // 1. Clean invoice
      await dbClient.insertCarrierInvoice({
        tenantId,
        shipmentId,
        carrierScac: 'XPO',
        carrierName: 'XPO Logistics',
        proNumber: 'PRO-BATCH-001',
        invoiceNumber: 'INV-BATCH-001',
        totalBilledCents: 57000,
        billedLinehaulCents: 45000,
        billedFuelCents: 12000,
        billedAccessorialCents: 0,
        billedAccessorials: {},
        billedWeightLbs: 3500,
        billedClass: '70',
        invoiceDate: '2026-09-05',
        status: 'PENDING_AUDIT',
      });

      // 2. Discrepancy invoice (overcharge $50.00)
      await dbClient.insertCarrierInvoice({
        tenantId,
        shipmentId,
        carrierScac: 'XPO',
        carrierName: 'XPO Logistics',
        proNumber: 'PRO-BATCH-002',
        invoiceNumber: 'INV-BATCH-002',
        totalBilledCents: 62000,
        billedLinehaulCents: 50000,
        billedFuelCents: 12000,
        billedAccessorialCents: 0,
        billedAccessorials: {},
        billedWeightLbs: 3500,
        billedClass: '70',
        invoiceDate: '2026-09-05',
        status: 'PENDING_AUDIT',
      });

      const batchSummary = await ReBillAuditEngine.auditBatch(tenantId);

      expect(batchSummary.totalInvoicesProcessed).toBe(2);
      expect(batchSummary.auditedCleanCount).toBe(1);
      expect(batchSummary.discrepancyFlaggedCount).toBe(1);
      expect(batchSummary.totalDiscrepancyAmountCents).toBe(5000); // $50.00
      expect(batchSummary.results).toHaveLength(2);
    });
  });

  describe('Multi-Tenant Row-Level Security (RLS) Isolation', () => {
    it('prevents cross-tenant invoice auditing operations', async () => {
      const otherTenantId = '01916362-7901-7080-867c-9b8895092a99';
      
      const invoice = await dbClient.insertCarrierInvoice({
        tenantId,
        shipmentId,
        carrierScac: 'XPO',
        carrierName: 'XPO Logistics',
        proNumber: 'PRO-RLS-001',
        invoiceNumber: 'INV-RLS-001',
        totalBilledCents: 57000,
        billedLinehaulCents: 45000,
        billedFuelCents: 12000,
        billedAccessorialCents: 0,
        billedAccessorials: {},
        billedWeightLbs: 3500,
        billedClass: '70',
        invoiceDate: '2026-09-05',
        status: 'PENDING_AUDIT',
      });

      // Attempting to audit under otherTenantId should throw an error
      await expect(
        ReBillAuditEngine.auditCarrierInvoice(otherTenantId, invoice.id)
      ).rejects.toThrow();
    });
  });
});
