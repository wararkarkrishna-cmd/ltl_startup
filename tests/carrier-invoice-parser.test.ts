import { describe, it, expect, beforeEach } from 'vitest';
import { generateUuidV7 } from '../src/lib/uuidv7';
import { dbClient } from '../src/db/client';
import {
  CarrierInvoiceParser,
  normalizeCarrierMetadata,
  parseFlexibleDate,
  parseCentsAmount,
  mapAccessorialCode,
} from '../src/lib/audit/carrier-invoice-parser';
import {
  CarrierInvoiceSchema,
  DiscrepancyRecordSchema,
  CarrierDisputeSchema,
} from '../src/db/schema';

describe('Phase 5.1: Carrier Final Invoice Ingestion & EDI 210 / PDF Parser Engine', () => {
  const tenantId = generateUuidV7();
  const alternateTenantId = generateUuidV7();

  beforeEach(() => {
    dbClient.carrierInvoices.clear();
    dbClient.discrepancyRecords.clear();
    dbClient.carrierDisputes.clear();
    dbClient.shipments.clear();
    dbClient.digitalBols.clear();
    dbClient.tenders.clear();
    dbClient.customerInvoices.clear();
    dbClient.setTenantContext(tenantId);
  });

  describe('EDI 210 (ASC X12 Motor Carrier Freight Invoice) Parsing', () => {
    it('successfully parses a comprehensive EDI 210 transaction set (XPO Logistics)', () => {
      const sampleEdi210 = [
        'ISA*00*          *00*          *ZZ*XPOL           *ZZ*MYBROKER       *260901*1430*U*00401*000000001*0*P*>~',
        'GS*IM*XPOL*MYBROKER*20260901*1430*1*X*004010~',
        'ST*210*0001~',
        'B3**INV-982410*BOL-44921*PP**20260901*156550**20261001**XPOL~',
        'N1*CA*XPO LOGISTICS*92*XPOL~',
        'N1*SH*ACME MANUFACTURING~',
        'N1*CN*GLOBAL DISTRIBUTION INC~',
        'N9*BM*BOL-44921~',
        'N9*CN*PRO-9842100~',
        'LX*1~',
        'L5*1*INDUSTRIAL PUMPS*70*D*84130~',
        'L0*1*2450.00*LB*2450.00*G***2*PLT~',
        'L1*1*1150.00*FR*115000***400*Linehaul Freight Charge~',
        'L1*2*240.50*FR*24050***FUE*Fuel Surcharge (20.9%)~',
        'L1*3*95.00*FR*9500***LFT*Liftgate Delivery Service~',
        'L1*4*80.00*FR*8000***INC*Inside Delivery Service~',
        'L3*2450*G***156550~',
        'SE*16*0001~',
        'GE*1*1~',
        'IEA*1*000000001~',
      ].join('');

      const parsed = CarrierInvoiceParser.parseEdi210(sampleEdi210, tenantId);

      expect(parsed.carrierCode).toBe('XPO');
      expect(parsed.carrierScac).toBe('XPOL');
      expect(parsed.carrierName).toBe('XPO Logistics');
      expect(parsed.carrierInvoiceNumber).toBe('INV-982410');
      expect(parsed.proNumber).toBe('PRO-9842100');
      expect(parsed.bolNumber).toBe('BOL-44921');
      expect(parsed.invoicedLinehaulCents).toBe(115000);
      expect(parsed.invoicedFuelCents).toBe(24050);
      expect(parsed.invoicedAccessorialCents).toBe(17500); // 9500 + 8000
      expect(parsed.invoicedTotalCents).toBe(156550);
      expect(parsed.invoicedWeightLbs).toBe(2450);
      expect(parsed.invoicedClass).toBe('70');
      expect(parsed.sourceFormat).toBe('EDI_210');
      expect(parsed.invoicedAccessorialBreakdown).toHaveLength(2);
      expect(parsed.invoicedAccessorialBreakdown[0].code).toBe('LG_DEL');
      expect(parsed.invoicedAccessorialBreakdown[0].amountCents).toBe(9500);
      expect(parsed.invoicedAccessorialBreakdown[1].code).toBe('INS_DEL');
      expect(parsed.invoicedAccessorialBreakdown[1].amountCents).toBe(8000);
    });

    it('parses EDI 210 with reweigh and reclassification accessorial surcharges', () => {
      const sampleEdi210 = [
        'ST*210*0002~',
        'B3**EST-440192*BOL-7718*PP**20260901*198000***EXLA~',
        'N1*CA*ESTES EXPRESS LINES*92*EXLA~',
        'N9*PRO*0987654321~',
        'L5*1*PLASTIC MOLDED PARTS*85*D~',
        'L0*1*3200.00*LB~',
        'L1*1*1400.00*FR*140000***400*Base Linehaul~',
        'L1*2*280.00*FR*28000***FSC*Fuel Surcharge~',
        'L1*3*150.00*FR*15000***RES*Residential Delivery~',
        'L1*4*50.00*FR*5000***RWG*Scale Weight Verification~',
        'L1*5*100.00*FR*10000***RCL*NMFC Class Adjustment Fee~',
        'L3*3200*G***198000~',
        'SE*12*0002~',
      ].join('');

      const parsed = CarrierInvoiceParser.parseEdi210(sampleEdi210, tenantId);

      expect(parsed.carrierCode).toBe('ESTES');
      expect(parsed.carrierScac).toBe('EXLA');
      expect(parsed.proNumber).toBe('0987654321');
      expect(parsed.invoicedWeightLbs).toBe(3200);
      expect(parsed.invoicedClass).toBe('85');
      expect(parsed.invoicedLinehaulCents).toBe(140000);
      expect(parsed.invoicedFuelCents).toBe(28000);
      expect(parsed.invoicedAccessorialCents).toBe(30000); // 15000 + 5000 + 10000
      expect(parsed.invoicedTotalCents).toBe(198000);
      expect(parsed.invoicedAccessorialBreakdown).toHaveLength(3);
      expect(parsed.invoicedAccessorialBreakdown.map((a) => a.code)).toEqual([
        'RES_DEL',
        'REWEIGH',
        'RECLASSIFICATION',
      ]);
    });
  });

  describe('PDF Carrier Invoice OCR Parsing', () => {
    it('successfully extracts structured fields from OCR text of an Old Dominion freight invoice', () => {
      const ocrText = `
        OLD DOMINION FREIGHT LINE, INC.
        500 Old Dominion Way, Thomasville, NC 27360
        SCAC: ODFL

        FREIGHT INVOICE
        INVOICE NUMBER: ODFL-9982341
        INVOICE DATE: 09/01/2026
        PAYMENT DUE: 10/01/2026
        PRO NUMBER: 123-456789-0
        BILL OF LADING: BOL-OD-55410

        SHIPPER: APEX MANUFACTURING, CLEVELAND OH
        CONSIGNEE: SUMMIT LOGISTICS, ATLANTA GA

        BILLED WEIGHT: 1,850 LBS
        FREIGHT CLASS: 77.5
        TOTAL PIECES: 2 PALLETS

        CHARGES SUMMARY:
        LINEHAUL FREIGHT CHARGE: $925.00
        FUEL SURCHARGE (21.5%): $198.88
        LIFTGATE DELIVERY: $75.00
        NOTIFICATION BEFORE DELIVERY: $35.00
        LIMITED ACCESS DELIVERY: $65.00

        TOTAL AMOUNT DUE: $1,298.88
      `;

      const parsed = CarrierInvoiceParser.parseOcrText(ocrText, tenantId);

      expect(parsed.carrierCode).toBe('ODFL');
      expect(parsed.carrierScac).toBe('ODFL');
      expect(parsed.carrierName).toBe('Old Dominion Freight Line');
      expect(parsed.carrierInvoiceNumber).toBe('ODFL-9982341');
      expect(parsed.proNumber).toBe('123-456789-0');
      expect(parsed.bolNumber).toBe('BOL-OD-55410');
      expect(parsed.invoicedWeightLbs).toBe(1850);
      expect(parsed.invoicedClass).toBe('77.5');
      expect(parsed.invoicedLinehaulCents).toBe(92500);
      expect(parsed.invoicedFuelCents).toBe(19888);
      expect(parsed.invoicedAccessorialCents).toBe(17500); // 7500 + 3500 + 6500
      expect(parsed.invoicedTotalCents).toBe(129888);
      expect(parsed.sourceFormat).toBe('PDF_OCR');
      expect(parsed.invoicedAccessorialBreakdown).toHaveLength(3);
    });

    it('extracts carrier invoices from Saia LTL text with reweigh & hazmat fees', () => {
      const ocrText = `
        SAIA LTL FREIGHT
        INVOICE#: SAIA-882340
        PRO#: 44109823
        BOL#: BOL-99012
        DATE: 08/25/2026
        TOTAL WEIGHT: 4200 LBS
        CLASS: 92.5
        Base Rate: $1,650.00
        Fuel Surcharge: $345.50
        Reweigh Fee: $25.00
        Hazardous Material Fee: $120.00
        Total Due: $2,140.50
      `;

      const parsed = CarrierInvoiceParser.parseOcrText(ocrText, tenantId);

      expect(parsed.carrierCode).toBe('SAIA');
      expect(parsed.carrierInvoiceNumber).toBe('SAIA-882340');
      expect(parsed.proNumber).toBe('44109823');
      expect(parsed.bolNumber).toBe('BOL-99012');
      expect(parsed.invoicedWeightLbs).toBe(4200);
      expect(parsed.invoicedClass).toBe('92.5');
      expect(parsed.invoicedLinehaulCents).toBe(165000);
      expect(parsed.invoicedFuelCents).toBe(34550);
      expect(parsed.invoicedAccessorialCents).toBe(14500); // 2500 + 12000
      expect(parsed.invoicedTotalCents).toBe(214050);
      expect(parsed.invoicedAccessorialBreakdown.map((a) => a.code)).toEqual([
        'REWEIGH',
        'HAZMAT',
      ]);
    });
  });

  describe('Automatic Shipment Matcher & Database Ingestion', () => {
    it('matches invoice to internal shipment via direct referenceNumber', async () => {
      const shipment = await dbClient.insertShipment({
        tenantId,
        referenceNumber: 'REF-MATCH-101',
        status: 'DELIVERED',
        originAddress1: '100 Main St',
        originCity: 'Los Angeles',
        originState: 'CA',
        originZip: '90001',
        originCountry: 'US',
        destAddress1: '200 State St',
        destCity: 'Chicago',
        destState: 'IL',
        destZip: '60601',
        destCountry: 'US',
        totalPallets: 2,
        totalWeightLbs: 2400,
        pickupDateReady: '2026-09-01',
      });

      const sampleEdi = [
        'ST*210*0001~',
        'B3**INV-1001*REF-MATCH-101*PP**20260901*145000***XPOL~',
        'L1*1*1200.00*FR*120000***400*Linehaul~',
        'L1*2*250.00*FR*25000***FUE*Fuel~',
        'L3*2400*G***145000~',
        'SE*6*0001~',
      ].join('');

      const result = await CarrierInvoiceParser.matchAndIngestInvoice({
        tenantId,
        rawPayload: sampleEdi,
        format: 'EDI_210',
      });

      expect(result.matchedShipment).not.toBeNull();
      expect(result.matchedShipment?.id).toBe(shipment.id);
      expect(result.carrierInvoice.shipmentId).toBe(shipment.id);
      expect(result.carrierInvoice.carrierInvoiceNumber).toBe('INV-1001');
      expect(result.carrierInvoice.status).toBe('RECEIVED');

      // Verify schema validation
      const validated = CarrierInvoiceSchema.parse(result.carrierInvoice);
      expect(validated.id).toBe(result.carrierInvoice.id);
    });

    it('matches invoice to internal shipment via Digital BOL Pro Number', async () => {
      const shipment = await dbClient.insertShipment({
        tenantId,
        referenceNumber: 'SHP-2026-88',
        status: 'DELIVERED',
        originAddress1: '500 Oak St',
        originCity: 'Dallas',
        originState: 'TX',
        originZip: '75201',
        originCountry: 'US',
        destAddress1: '700 Elm St',
        destCity: 'Denver',
        destState: 'CO',
        destZip: '80201',
        destCountry: 'US',
        totalPallets: 3,
        totalWeightLbs: 3100,
        pickupDateReady: '2026-09-01',
      });

      await dbClient.insertDigitalBol({
        tenantId,
        shipmentId: shipment.id,
        bolNumber: 'BOL-DIGITAL-9988',
        masterBolNumber: 'MBOL-DIGITAL-9988',
        proNumber: 'PRO-EBOL-776655',
        carrierCode: 'XPO',
        carrierScac: 'XPOL',
        barcodeData: 'BARCODE-9988',
        freightChargeTerm: 'PREPAID',
        emergencyContact: '1-800-424-9300',
      });

      const ocrPayload = `
        XPO LOGISTICS
        INVOICE NUMBER: INV-OCR-7766
        PRO NUMBER: PRO-EBOL-776655
        DATE: 09/01/2026
        Linehaul: $1,100.00
        Fuel: $220.00
        Total: $1,320.00
        Weight: 3100 lbs
      `;

      const result = await CarrierInvoiceParser.matchAndIngestInvoice({
        tenantId,
        rawPayload: ocrPayload,
        format: 'PDF_OCR',
      });

      expect(result.matchedShipment).not.toBeNull();
      expect(result.matchedShipment?.id).toBe(shipment.id);
      expect(result.carrierInvoice.shipmentId).toBe(shipment.id);
      expect(result.carrierInvoice.sourceFormat).toBe('PDF_OCR');
    });

    it('handles unmatched invoice gracefully with shipmentId set to null', async () => {
      const sampleEdi = [
        'ST*210*0001~',
        'B3**INV-UNMATCHED-99*UNKNOWN-REF*PP**20260901*85000***ODFL~',
        'L1*1*700.00*FR*70000***400*Linehaul~',
        'L1*2*150.00*FR*15000***FUE*Fuel~',
        'L3*1500*G***85000~',
        'SE*6*0001~',
      ].join('');

      const result = await CarrierInvoiceParser.matchAndIngestInvoice({
        tenantId,
        rawPayload: sampleEdi,
        format: 'EDI_210',
      });

      expect(result.matchedShipment).toBeNull();
      expect(result.carrierInvoice.shipmentId).toBeNull();
      expect(result.carrierInvoice.carrierInvoiceNumber).toBe('INV-UNMATCHED-99');
    });
  });

  describe('Database Client CRUD & Multi-Tenant Isolation for Phase 5.1', () => {
    it('persists and retrieves Carrier Invoices with RLS isolation', async () => {
      const invoice = await dbClient.insertCarrierInvoice({
        tenantId,
        carrierCode: 'XPO',
        carrierScac: 'XPOL',
        carrierName: 'XPO Logistics',
        carrierInvoiceNumber: 'INV-DB-100',
        proNumber: 'PRO-DB-100',
        invoicedLinehaulCents: 100000,
        invoicedFuelCents: 20000,
        invoicedAccessorialCents: 5000,
        invoicedAccessorialBreakdown: [
          { code: 'LG_DEL', description: 'Liftgate', amountCents: 5000 },
        ],
        invoicedTotalCents: 125000,
        invoicedWeightLbs: 2000,
        invoicedClass: '70',
        invoiceDate: new Date('2026-09-01'),
        status: 'RECEIVED',
        sourceFormat: 'EDI_210',
      });

      expect(invoice.id).toBeDefined();

      const fetched = await dbClient.getCarrierInvoiceById(invoice.id);
      expect(fetched).not.toBeNull();
      expect(fetched?.carrierInvoiceNumber).toBe('INV-DB-100');

      const tenantInvoices = await dbClient.getCarrierInvoicesByTenant(tenantId);
      expect(tenantInvoices.length).toBe(1);

      // Verify cross-tenant isolation
      dbClient.setTenantContext(alternateTenantId);
      const crossTenantFetched = await dbClient.getCarrierInvoiceById(invoice.id);
      expect(crossTenantFetched).toBeNull();
    });

    it('persists and queries Discrepancy Records', async () => {
      const invoice = await dbClient.insertCarrierInvoice({
        tenantId,
        carrierCode: 'ESTES',
        carrierScac: 'EXLA',
        carrierInvoiceNumber: 'INV-DISC-01',
        proNumber: 'PRO-DISC-01',
        invoicedLinehaulCents: 150000,
        invoicedFuelCents: 30000,
        invoicedAccessorialCents: 15000,
        invoicedAccessorialBreakdown: [],
        invoicedTotalCents: 195000,
        status: 'DISCREPANCY_FLAGGED',
        sourceFormat: 'EDI_210',
      });

      const discrepancy = await dbClient.insertDiscrepancyRecord({
        tenantId,
        carrierInvoiceId: invoice.id,
        discrepancyType: 'BOGUS_ACCESSORIAL',
        deltaTotalCents: 15000,
        deltaAccessorialCents: 15000,
        quotedExpectedRateCents: 180000,
        carrierInvoicedRateCents: 195000,
        discrepancyDescription:
          'Carrier billed $150.00 for Liftgate Delivery; Shipper BOL & POD confirm dock delivery with no liftgate requested.',
        confidenceScore: 0.98,
        isDisputable: true,
      });

      expect(discrepancy.id).toBeDefined();
      expect(discrepancy.discrepancyType).toBe('BOGUS_ACCESSORIAL');

      const validated = DiscrepancyRecordSchema.parse(discrepancy);
      expect(validated.isDisputable).toBe(true);

      const discrepancies = await dbClient.getDiscrepanciesByInvoiceId(tenantId, invoice.id);
      expect(discrepancies.length).toBe(1);
      expect(discrepancies[0].id).toBe(discrepancy.id);
    });

    it('persists, retrieves, and updates Carrier Disputes lifecycle', async () => {
      const invoice = await dbClient.insertCarrierInvoice({
        tenantId,
        carrierCode: 'SAIA',
        carrierScac: 'SAIA',
        carrierInvoiceNumber: 'INV-DISP-55',
        proNumber: 'PRO-DISP-55',
        invoicedLinehaulCents: 120000,
        invoicedFuelCents: 24000,
        invoicedAccessorialCents: 20000,
        invoicedAccessorialBreakdown: [],
        invoicedTotalCents: 164000,
        status: 'DISPUTED',
        sourceFormat: 'EDI_210',
      });

      const dispute = await dbClient.insertCarrierDispute({
        tenantId,
        carrierInvoiceId: invoice.id,
        disputeReferenceNumber: 'DISP-2026-SAIA-001',
        carrierScac: 'SAIA',
        carrierProNumber: 'PRO-DISP-55',
        disputedAmountCents: 20000,
        disputeStatus: 'SUBMITTED',
        carrierContactEmail: 'claims@saia.com',
        disputeLetterText: 'Formal dispute regarding unauthorized liftgate fee.',
        rebuttalEvidenceBundle: { podVerified: true, dockDelivery: true },
      });

      expect(dispute.id).toBeDefined();
      expect(dispute.disputeStatus).toBe('SUBMITTED');

      const validated = CarrierDisputeSchema.parse(dispute);
      expect(validated.disputeReferenceNumber).toBe('DISP-2026-SAIA-001');

      // Update dispute status to CREDIT_ISSUED
      const updated = await dbClient.updateCarrierDispute(dispute.id, {
        disputeStatus: 'CREDIT_ISSUED',
        creditMemoNumber: 'CM-SAIA-99812',
        recoveredAmountCents: 20000,
        resolvedAt: new Date(),
      });

      expect(updated?.disputeStatus).toBe('CREDIT_ISSUED');
      expect(updated?.creditMemoNumber).toBe('CM-SAIA-99812');
      expect(updated?.recoveredAmountCents).toBe(20000);

      const allDisputes = await dbClient.getCarrierDisputesByTenant(tenantId);
      expect(allDisputes.length).toBe(1);
      expect(allDisputes[0].disputeStatus).toBe('CREDIT_ISSUED');
    });
  });

  describe('Helper Utilities & Edge Cases', () => {
    it('normalizes various carrier names and SCACs', () => {
      expect(normalizeCarrierMetadata('XPOL', '').carrierCode).toBe('XPO');
      expect(normalizeCarrierMetadata('', 'Old Dominion Freight').carrierCode).toBe('ODFL');
      expect(normalizeCarrierMetadata('EXLA', '').carrierCode).toBe('ESTES');
      expect(normalizeCarrierMetadata('', 'Saia Motor Freight').carrierCode).toBe('SAIA');
      expect(normalizeCarrierMetadata('ABFS', '').carrierCode).toBe('ABF');
      expect(normalizeCarrierMetadata('RDFS', '').carrierCode).toBe('RL');
      expect(normalizeCarrierMetadata('FXNL', '').carrierCode).toBe('FEDEX');
      expect(normalizeCarrierMetadata('TWWF', '').carrierCode).toBe('TFORCE');
    });

    it('parses amounts accurately from strings with and without decimals', () => {
      expect(parseCentsAmount('$1,250.50')).toBe(125050);
      expect(parseCentsAmount('125050')).toBe(125050);
      expect(parseCentsAmount('$45.00')).toBe(4500);
      expect(parseCentsAmount('0')).toBe(0);
      expect(parseCentsAmount(null)).toBe(0);
    });

    it('maps accessorial codes accurately', () => {
      expect(mapAccessorialCode('LFT').code).toBe('LG_DEL');
      expect(mapAccessorialCode('RES').code).toBe('RES_DEL');
      expect(mapAccessorialCode('INC').code).toBe('INS_DEL');
      expect(mapAccessorialCode('NOT').code).toBe('NOTIFY');
      expect(mapAccessorialCode('LMA').code).toBe('LIM_ACC');
      expect(mapAccessorialCode('RWG').code).toBe('REWEIGH');
      expect(mapAccessorialCode('RCL').code).toBe('RECLASSIFICATION');
      expect(mapAccessorialCode('DET').code).toBe('DETENTION');
      expect(mapAccessorialCode('RED').code).toBe('REDELIVERY');
      expect(mapAccessorialCode('HM').code).toBe('HAZMAT');
    });

    it('parses various date formats robustly', () => {
      const d1 = parseFlexibleDate('20260901');
      expect(d1.getFullYear()).toBe(2026);
      expect(d1.getMonth()).toBe(8); // September is 8 (0-indexed)
      expect(d1.getDate()).toBe(1);

      const d2 = parseFlexibleDate('260901');
      expect(d2.getFullYear()).toBe(2026);

      const d3 = parseFlexibleDate('2026-09-15');
      expect(d3.getDate()).toBe(15);

      const d4 = parseFlexibleDate('09/20/2026');
      expect(d4.getDate()).toBe(20);
    });
  });
});
