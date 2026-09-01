import { describe, it, expect, beforeEach } from 'vitest';
import { dbClient } from '../src/db/client';
import { ReBillAuditEngine } from '../src/lib/audit/re-bill-audit-engine';
import { DiscrepancyClassifier } from '../src/lib/audit/discrepancy-classifier';
import { generateUuidV7 } from '../src/lib/uuidv7';

describe('Phase 5.3: Discrepancy Classification & Categorization Matrix (DiscrepancyClassifier)', () => {
  const tenantId = '01916362-7901-7080-867c-9b8895092a01';
  let shipmentId: string;
  let quoteId: string;

  beforeEach(async () => {
    dbClient.setTenantContext(tenantId);
    dbClient.carrierInvoices.clear();
    dbClient.discrepancyRecords.clear();
    dbClient.digitalBols.clear();
    dbClient.podRecords.clear();
    dbClient.rateConfirmations.clear();

    // 1. Seed Shipment
    const shipment = await dbClient.insertShipment({
      tenantId,
      referenceNumber: 'SHP-DISC-2026-001',
      status: 'DELIVERED',
      originAddress1: '1000 Industrial Blvd',
      originCity: 'Dallas',
      originState: 'TX',
      originZip: '75201',
      originCountry: 'US',
      destAddress1: '400 Warehouse Way',
      destCity: 'Chicago',
      destState: 'IL',
      destZip: '60601',
      destCountry: 'US',
      totalPallets: 4,
      totalWeightLbs: 3000,
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
      weightLbs: 3000,
      pcfDensity: 11.2,
      nmfcClass: '70' as const,
      commodityDescription: 'Industrial Machine Fasteners',
      isStackable: true,
      isHazmat: false,
      createdAt: new Date(),
    };
    dbClient.shipmentItems.set(item.id, item);

    // 3. Seed Digitally Signed eBOL
    await dbClient.insertDigitalBol({
      tenantId,
      shipmentId,
      bolNumber: 'BOL-2026-00981',
      masterBolNumber: 'MBOL-2026-00981',
      proNumber: 'PRO-XPO-77192',
      carrierCode: 'XPO',
      carrierScac: 'XPO',
      freightChargeTerm: 'PREPAID',
      emergencyContact: '1-800-424-9300',
      shipperSignature: 'DATA:SIGNATURE_CERTIFIED_ORIGIN_WEIGHT_3000LBS',
      barcodeData: 'BOL202600981',
      specialInstructions: 'Commercial Dock Delivery. Forklift on-site. Standard delivery hours.',
    });

    // 4. Seed Geotagged POD with consignee dock signature
    await dbClient.insertPodRecord({
      tenantId,
      shipmentId,
      imageUrl: 'https://s3.amazonaws.com/freight-pod-vault/pod-77192.jpg',
      imageHash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      fileSizeBytes: 2048500,
      consigneeName: 'Marcus Miller (Dock Manager)',
      consigneeSignatureDataUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...',
      receivedPieces: 4,
      expectedPieces: 4,
      gpsLatitude: 41.8781,
      gpsLongitude: -87.6298,
      destLatitude: 41.8780,
      destLongitude: -87.6295,
      geofenceDistanceMiles: 0.02,
      isWithinGeofence: true,
      signatureDetected: true,
      pieceCountVerified: true,
      status: 'VERIFIED',
      overallConfidence: 98.5,
    });

    // 5. Seed Quote: Linehaul $500.00, Fuel $130.00, Total $630.00
    const quote = await dbClient.insertQuote({
      tenantId,
      shipmentId,
      carrierCode: 'XPO',
      carrierName: 'XPO Logistics',
      carrierScac: 'XPO',
      accountType: 'DIRECT_BYOC',
      isGuaranteed: false,
      quoteNumber: 'Q-XPO-8812',
      sourceTag: 'CONTRACT_CZARLITE_2020',
      linehaulCostCents: 50000,
      fuelSurchargeCents: 13000,
      accessorialCostCents: 0,
      totalCarrierCostCents: 63000,
      appliedMarginPercent: 15.0,
      appliedMarginCents: 11118,
      quotedCustomerPriceCents: 74118,
      grossProfitCents: 11118,
      grossMarginPercent: 15.0,
      transitDays: 3,
      isSelected: true,
      accessorialFees: {},
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });
    quoteId = quote.id;
  });

  describe('Category 1: UNAUTHORIZED_REWEIGH Classification', () => {
    it('categorizes overcharge as UNAUTHORIZED_REWEIGH when billed weight exceeds quoted by >50 lbs without scale cert', async () => {
      const invoice = await dbClient.insertCarrierInvoice({
        tenantId,
        shipmentId,
        carrierScac: 'XPO',
        carrierName: 'XPO Logistics',
        proNumber: 'PRO-XPO-77192',
        invoiceNumber: 'INV-XPO-REWEIGH-01',
        totalBilledCents: 73000, // $100.00 overcharge
        billedLinehaulCents: 60000, // $100.00 linehaul increase
        billedFuelCents: 13000,
        billedAccessorialCents: 0,
        billedAccessorials: {},
        billedWeightLbs: 3600, // +600 lbs reweigh
        billedClass: '70',
        hasScaleCertificate: false,
        invoiceDate: '2026-09-06',
        status: 'PENDING_AUDIT',
      });

      const auditResult = await ReBillAuditEngine.auditCarrierInvoice(tenantId, invoice.id);
      const classification = await DiscrepancyClassifier.classifyDiscrepancy(auditResult);

      expect(classification.isDisputed).toBe(true);
      expect(classification.primaryDiscrepancyType).toBe('UNAUTHORIZED_REWEIGH');
      expect(classification.discrepancies).toHaveLength(1);

      const reweigh = classification.discrepancies[0];
      expect(reweigh.discrepancyType).toBe('UNAUTHORIZED_REWEIGH');
      expect(reweigh.disputableAmountCents).toBe(10000); // $100.00
      expect(reweigh.confidenceScore).toBeGreaterThanOrEqual(95.0); // High confidence due to eBOL signature & POD
      expect(reweigh.evidencePayload.hasScaleCertificate).toBe(false);
      expect(reweigh.evidencePayload.shipperEbolSigned).toBe(true);
      expect(reweigh.evidencePayload.weightDeltaLbs).toBe(600);
    });
  });

  describe('Category 2: RECLASSIFICATION_DISPUTE Classification', () => {
    it('categorizes overcharge as RECLASSIFICATION_DISPUTE when NMFC class is bumped without W&I inspection doc', async () => {
      const invoice = await dbClient.insertCarrierInvoice({
        tenantId,
        shipmentId,
        carrierScac: 'XPO',
        carrierName: 'XPO Logistics',
        proNumber: 'PRO-XPO-77192',
        invoiceNumber: 'INV-XPO-RECLASS-01',
        totalBilledCents: 78000, // $150.00 overcharge
        billedLinehaulCents: 65000,
        billedFuelCents: 13000,
        billedAccessorialCents: 0,
        billedAccessorials: {},
        billedWeightLbs: 3000,
        billedClass: '92.5', // Bumped from 70 to 92.5
        hasDensityInspectionDoc: false,
        invoiceDate: '2026-09-06',
        status: 'PENDING_AUDIT',
      });

      const auditResult = await ReBillAuditEngine.auditCarrierInvoice(tenantId, invoice.id);
      const classification = await DiscrepancyClassifier.classifyDiscrepancy(auditResult);

      expect(classification.isDisputed).toBe(true);
      expect(classification.primaryDiscrepancyType).toBe('RECLASSIFICATION_DISPUTE');

      const reclass = classification.discrepancies[0];
      expect(reclass.discrepancyType).toBe('RECLASSIFICATION_DISPUTE');
      expect(reclass.disputableAmountCents).toBe(15000); // $150.00
      expect(reclass.confidenceScore).toBeGreaterThanOrEqual(90.0);
      expect(reclass.evidencePayload.quotedClass).toBe('70');
      expect(reclass.evidencePayload.billedClass).toBe('92.5');
      expect(reclass.evidencePayload.hasDensityInspectionDoc).toBe(false);
    });
  });

  describe('Category 3: BOGUS_ACCESSORIAL Classification', () => {
    it('categorizes unauthorized Liftgate & Residential delivery charges as BOGUS_ACCESSORIAL backed by dock POD', async () => {
      const invoice = await dbClient.insertCarrierInvoice({
        tenantId,
        shipmentId,
        carrierScac: 'XPO',
        carrierName: 'XPO Logistics',
        proNumber: 'PRO-XPO-77192',
        invoiceNumber: 'INV-XPO-BOGUS-01',
        totalBilledCents: 76500, // $630.00 + $75.00 LG_DEL + $60.00 RES_DEL
        billedLinehaulCents: 50000,
        billedFuelCents: 13000,
        billedAccessorialCents: 13500,
        billedAccessorials: {
          LG_DEL: 7500,  // $75.00 Liftgate Delivery
          RES_DEL: 6000, // $60.00 Residential Delivery
        },
        billedWeightLbs: 3000,
        billedClass: '70',
        invoiceDate: '2026-09-06',
        status: 'PENDING_AUDIT',
      });

      const auditResult = await ReBillAuditEngine.auditCarrierInvoice(tenantId, invoice.id);
      const classification = await DiscrepancyClassifier.classifyDiscrepancy(auditResult);

      expect(classification.isDisputed).toBe(true);
      expect(classification.primaryDiscrepancyType).toBe('BOGUS_ACCESSORIAL');
      expect(classification.discrepancies).toHaveLength(2);

      const lgDiscrepancy = classification.discrepancies.find((d) =>
        d.title.includes('LG_DEL')
      );
      const resDiscrepancy = classification.discrepancies.find((d) =>
        d.title.includes('RES_DEL')
      );

      expect(lgDiscrepancy?.disputableAmountCents).toBe(7500);
      expect(resDiscrepancy?.disputableAmountCents).toBe(6000);
      expect(classification.totalDisputableAmountCents).toBe(13500); // $135.00 total
      expect(lgDiscrepancy?.evidencePayload.podWithinGeofence).toBe(true);
      expect(lgDiscrepancy?.confidenceScore).toBe(100.0); // Geotagged POD dock match
    });
  });

  describe('Category 4: FUEL_INDEX_MISMATCH Classification', () => {
    it('categorizes excess fuel charge as FUEL_INDEX_MISMATCH', async () => {
      const invoice = await dbClient.insertCarrierInvoice({
        tenantId,
        shipmentId,
        carrierScac: 'XPO',
        carrierName: 'XPO Logistics',
        proNumber: 'PRO-XPO-77192',
        invoiceNumber: 'INV-XPO-FUEL-01',
        totalBilledCents: 67500, // Fuel $175.00 vs $130.00 expected ($45.00 overcharge)
        billedLinehaulCents: 50000,
        billedFuelCents: 17500,
        billedAccessorialCents: 0,
        billedAccessorials: {},
        appliedFuelPercentage: 35.0, // Invoiced 35% vs contract 26%
        billedWeightLbs: 3000,
        billedClass: '70',
        invoiceDate: '2026-09-06',
        status: 'PENDING_AUDIT',
      });

      const auditResult = await ReBillAuditEngine.auditCarrierInvoice(tenantId, invoice.id);
      const classification = await DiscrepancyClassifier.classifyDiscrepancy(auditResult);

      expect(classification.isDisputed).toBe(true);
      expect(classification.primaryDiscrepancyType).toBe('FUEL_INDEX_MISMATCH');

      const fuelDisc = classification.discrepancies[0];
      expect(fuelDisc.discrepancyType).toBe('FUEL_INDEX_MISMATCH');
      expect(fuelDisc.disputableAmountCents).toBe(4500); // $45.00
      expect(fuelDisc.confidenceScore).toBe(95.0);
    });
  });

  describe('Category 5: DUPLICATE_BILLING Classification', () => {
    it('categorizes duplicate invoice for same PRO# as DUPLICATE_BILLING disputing 100% of the invoice', async () => {
      // Prior invoice already audited/settled
      await dbClient.insertCarrierInvoice({
        tenantId,
        shipmentId,
        carrierScac: 'XPO',
        carrierName: 'XPO Logistics',
        proNumber: 'PRO-XPO-DUPLICATE-77192',
        invoiceNumber: 'INV-XPO-ORIGINAL-01',
        totalBilledCents: 63000,
        billedLinehaulCents: 50000,
        billedFuelCents: 13000,
        billedAccessorialCents: 0,
        billedAccessorials: {},
        billedWeightLbs: 3000,
        billedClass: '70',
        invoiceDate: '2026-08-25',
        status: 'SETTLED',
      });

      // New second invoice received for same PRO
      const duplicateInvoice = await dbClient.insertCarrierInvoice({
        tenantId,
        shipmentId,
        carrierScac: 'XPO',
        carrierName: 'XPO Logistics',
        proNumber: 'PRO-XPO-DUPLICATE-77192',
        invoiceNumber: 'INV-XPO-DUPLICATE-02',
        totalBilledCents: 63000,
        billedLinehaulCents: 50000,
        billedFuelCents: 13000,
        billedAccessorialCents: 0,
        billedAccessorials: {},
        billedWeightLbs: 3000,
        billedClass: '70',
        invoiceDate: '2026-09-06',
        status: 'PENDING_AUDIT',
      });

      const auditResult = await ReBillAuditEngine.auditCarrierInvoice(tenantId, duplicateInvoice.id);
      const classification = await DiscrepancyClassifier.classifyDiscrepancy(auditResult);

      expect(classification.isDisputed).toBe(true);
      expect(classification.primaryDiscrepancyType).toBe('DUPLICATE_BILLING');

      const dup = classification.discrepancies[0];
      expect(dup.discrepancyType).toBe('DUPLICATE_BILLING');
      expect(dup.disputableAmountCents).toBe(63000); // 100% of duplicate bill
      expect(classification.totalDisputableAmountCents).toBe(63000);
      expect(dup.confidenceScore).toBe(99.0);
    });
  });

  describe('Category 6: INCORRECT_RATE_BASE Classification', () => {
    it('categorizes unagreed tariff base application as INCORRECT_RATE_BASE', async () => {
      const invoice = await dbClient.insertCarrierInvoice({
        tenantId,
        shipmentId,
        carrierScac: 'XPO',
        carrierName: 'XPO Logistics',
        proNumber: 'PRO-XPO-77192',
        invoiceNumber: 'INV-XPO-TARIFF-01',
        totalBilledCents: 71000, // $80.00 linehaul overcharge from wrong tariff base
        billedLinehaulCents: 58000,
        billedFuelCents: 13000,
        billedAccessorialCents: 0,
        billedAccessorials: {},
        tariffRateBase: 'NON_CONTRACT_SPOT_BASE_2026',
        billedWeightLbs: 3000,
        billedClass: '70',
        invoiceDate: '2026-09-06',
        status: 'PENDING_AUDIT',
      });

      const auditResult = await ReBillAuditEngine.auditCarrierInvoice(tenantId, invoice.id);
      const classification = await DiscrepancyClassifier.classifyDiscrepancy(auditResult);

      expect(classification.isDisputed).toBe(true);
      expect(classification.primaryDiscrepancyType).toBe('INCORRECT_RATE_BASE');

      const rateBaseDisc = classification.discrepancies[0];
      expect(rateBaseDisc.discrepancyType).toBe('INCORRECT_RATE_BASE');
      expect(rateBaseDisc.disputableAmountCents).toBe(8000); // $80.00
      expect(rateBaseDisc.confidenceScore).toBeGreaterThanOrEqual(90.0);
    });
  });

  describe('Compound Discrepancies & createAndPersistDiscrepancies Database Persistence', () => {
    it('persists multiple classified discrepancies to DB and updates invoice status', async () => {
      // Invoice with BOTH an unauthorized reweigh (+500 lbs) AND a bogus liftgate charge ($75.00)
      const invoice = await dbClient.insertCarrierInvoice({
        tenantId,
        shipmentId,
        carrierScac: 'XPO',
        carrierName: 'XPO Logistics',
        proNumber: 'PRO-XPO-77192',
        invoiceNumber: 'INV-XPO-COMPOUND-01',
        totalBilledCents: 79500, // $590.00 linehaul + $130.00 fuel + $75.00 LG
        billedLinehaulCents: 59000, // +$90.00 linehaul from reweigh
        billedFuelCents: 13000,
        billedAccessorialCents: 7500,
        billedAccessorials: {
          LG_DEL: 7500,
        },
        billedWeightLbs: 3500, // +500 lbs reweigh
        billedClass: '70',
        hasScaleCertificate: false,
        invoiceDate: '2026-09-06',
        status: 'PENDING_AUDIT',
      });

      const auditResult = await ReBillAuditEngine.auditCarrierInvoice(tenantId, invoice.id);
      const createdRecords = await DiscrepancyClassifier.createAndPersistDiscrepancies(
        tenantId,
        auditResult
      );

      expect(createdRecords).toHaveLength(2);

      // Verify records in DB
      const dbRecords = await dbClient.getDiscrepanciesByInvoiceId(tenantId, invoice.id);
      expect(dbRecords).toHaveLength(2);

      const reweighRecord = dbRecords.find((r) => r.discrepancyType === 'UNAUTHORIZED_REWEIGH');
      const bogusRecord = dbRecords.find((r) => r.discrepancyType === 'BOGUS_ACCESSORIAL');

      expect(reweighRecord).toBeDefined();
      expect(bogusRecord).toBeDefined();
      expect(reweighRecord?.status).toBe('FLAGGED');
      expect(bogusRecord?.status).toBe('FLAGGED');

      // Verify invoice status updated to DISCREPANCY_FLAGGED
      const updatedInvoice = await dbClient.getCarrierInvoiceById(invoice.id);
      expect(updatedInvoice?.status).toBe('DISCREPANCY_FLAGGED');
    });
  });
});
