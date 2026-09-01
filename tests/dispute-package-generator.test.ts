import { describe, it, expect, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import {
  DisputePackageGenerator,
  DisputePackageData,
  CARRIER_CLAIM_ROUTING_DIRECTORY,
} from '../src/lib/documents/dispute-package-generator';
import { dbClient } from '../src/db/client';
import { generateUuidV7 } from '../src/lib/uuidv7';
import { POST as generateDisputeRoute } from '../src/app/api/v1/disputes/generate/route';
import { GET as getDisputeRoute } from '../src/app/api/v1/disputes/[id]/route';

describe('Phase 5.4: Automated Carrier Legal Dispute Package Generator & Direct Claim Desk Router', () => {
  const testTenantId = '01916362-7901-7080-867c-9b8895092a01';

  beforeEach(() => {
    dbClient.setTenantContext(testTenantId);
  });

  // ==========================================================================
  // 1. CARRIER CLAIM DESK ROUTING DIRECTORY TESTS
  // ==========================================================================
  describe('Carrier Claim Desk Routing Directory', () => {
    it('accurately maps all primary carrier SCACs to designated claims intake emails', () => {
      expect(DisputePackageGenerator.getCarrierClaimEmail('XPO')).toBe('disputes@xpo.com');
      expect(DisputePackageGenerator.getCarrierClaimEmail('xpo')).toBe('disputes@xpo.com');
      expect(DisputePackageGenerator.getCarrierClaimEmail('SAIA')).toBe('billingclaims@saia.com');
      expect(DisputePackageGenerator.getCarrierClaimEmail('saia')).toBe('billingclaims@saia.com');
      expect(DisputePackageGenerator.getCarrierClaimEmail('EXLA')).toBe('reweighs@estes-express.com');
      expect(DisputePackageGenerator.getCarrierClaimEmail('ESTES')).toBe('reweighs@estes-express.com');
      expect(DisputePackageGenerator.getCarrierClaimEmail('ODFL')).toBe('overchargeclaims@odfl.com');
      expect(DisputePackageGenerator.getCarrierClaimEmail('ABFS')).toBe('billingaudit@arcb.com');
      expect(DisputePackageGenerator.getCarrierClaimEmail('ABF')).toBe('billingaudit@arcb.com');
      expect(DisputePackageGenerator.getCarrierClaimEmail('RDWY')).toBe('claims@rrts.com');
      expect(DisputePackageGenerator.getCarrierClaimEmail('ROADRUNNER')).toBe('claims@rrts.com');
      expect(DisputePackageGenerator.getCarrierClaimEmail('RLCA')).toBe('claims@rlcarriers.com');
      expect(DisputePackageGenerator.getCarrierClaimEmail('RL')).toBe('claims@rlcarriers.com');
    });

    it('gracefully handles unknown carrier SCAC with standard claims intake fallback', () => {
      expect(DisputePackageGenerator.getCarrierClaimEmail('UNKN')).toBe('claims@unkn.com');
      expect(DisputePackageGenerator.getCarrierClaimEmail('')).toBe('disputes@apexfreightos.com');
    });
  });

  // ==========================================================================
  // 2. DISPUTE REFERENCE GENERATION TESTS
  // ==========================================================================
  describe('Dispute Reference Number Generator', () => {
    it('generates canonical dispute reference numbers following DISP-YYYY-SCAC-XXXXX pattern', () => {
      const year = new Date().getFullYear();
      const ref1 = DisputePackageGenerator.generateDisputeReferenceNumber('XPO', 98421);
      expect(ref1).toBe(`DISP-${year}-XPO-98421`);

      const ref2 = DisputePackageGenerator.generateDisputeReferenceNumber('saia');
      expect(ref2).toMatch(new RegExp(`^DISP-${year}-SAIA-\\d{5}$`));
    });
  });

  // ==========================================================================
  // 3. DYNAMIC 49 CFR § 378 LEGAL REBUTTAL BUILDER TESTS
  // ==========================================================================
  describe('Dynamic 49 CFR § 378 Legal Rebuttal Builder', () => {
    it('generates statutory certified scale ticket rebuttal for UNAUTHORIZED_REWEIGH (49 CFR § 378.4)', () => {
      const rebuttal = DisputePackageGenerator.buildLegalRebuttal('UNAUTHORIZED_REWEIGH', {
        billedWeight: 3750,
        quotedWeight: 3200,
      });

      expect(rebuttal).toContain('49 CFR § 378.4');
      expect(rebuttal).toContain('certified scale weight ticket');
      expect(rebuttal).toContain('gross, tare, and net weights');
      expect(rebuttal).toContain('3,750 lbs');
      expect(rebuttal).toContain('3,200 lbs');
      expect(rebuttal).toContain('certified shipper Bill of Lading weight stands as legally binding');
    });

    it('generates NMFTA density rule rebuttal for RECLASSIFICATION_DISPUTE citing pallet dimensions', () => {
      const rebuttal = DisputePackageGenerator.buildLegalRebuttal('RECLASSIFICATION_DISPUTE', {
        billedClass: '92.5',
        quotedClass: '70',
        palletDimensions: '48x40x48 in',
        actualDensityPcf: 11.2,
      });

      expect(rebuttal).toContain('NMFTA DENSITY RULES');
      expect(rebuttal).toContain('49 CFR § 378');
      expect(rebuttal).toContain('Class 92.5');
      expect(rebuttal).toContain('Class 70');
      expect(rebuttal).toContain('48x40x48 in');
      expect(rebuttal).toContain('11.2 PCF');
      expect(rebuttal).toContain('certified inspection report');
    });

    it('generates clean dock delivery certification rebuttal for BOGUS_ACCESSORIAL', () => {
      const rebuttal = DisputePackageGenerator.buildLegalRebuttal('BOGUS_ACCESSORIAL', {
        accessorialCode: 'LG_DEL (Liftgate Delivery)',
      });

      expect(rebuttal).toContain('SIGNED RECEIVING PROOF');
      expect(rebuttal).toContain('49 CFR § 378');
      expect(rebuttal).toContain('LG_DEL (Liftgate Delivery)');
      expect(rebuttal).toContain('commercial distribution facility');
      expect(rebuttal).toContain('dock-height loading doors');
      expect(rebuttal).toContain('clean delivery receipt');
    });

    it('generates DOE fuel surcharge rebuttal for FUEL_INDEX_MISMATCH', () => {
      const rebuttal = DisputePackageGenerator.buildLegalRebuttal('FUEL_INDEX_MISMATCH');

      expect(rebuttal).toContain('Department of Energy (DOE)');
      expect(rebuttal).toContain('National Average Diesel Fuel Price');
      expect(rebuttal).toContain('49 CFR § 378');
    });
  });

  // ==========================================================================
  // 4. HTML RENDERING & PRINT TOOLBAR TESTS
  // ==========================================================================
  describe('Printable HTML Dispute Document Rendering (renderDisputeHtml)', () => {
    const sampleDisputeData: DisputePackageData = {
      disputeReferenceNumber: 'DISP-2026-XPO-98421',
      issueDate: '2026-09-01',
      carrierName: 'XPO Logistics',
      carrierScac: 'XPO',
      carrierProNumber: 'XPO-9842100',
      bolNumber: 'BOL-2026-8941',
      poNumber: 'PO-GLOBAL-98421',
      destinationDeliveryDate: '2026-08-28',
      claimDeskEmail: 'disputes@xpo.com',
      legalCitation: '49 CFR § 378 (Procedures Governing the Processing, Investigation, and Disposition of Overcharge Claims)',
      lineItems: [
        {
          description: 'Unauthorized Terminal Reweigh Surcharge',
          category: 'UNAUTHORIZED_REWEIGH',
          quotedAmountCents: 125000,
          invoicedAmountCents: 147000,
          disputedAmountCents: 22000,
          explanation: 'Billed weight +550 lbs without certified scale ticket',
        },
      ],
      totalQuotedCents: 125000,   // $1,250.00
      totalInvoicedCents: 147000, // $1,470.00
      totalDisputedCents: 22000,  // $220.00
      primaryDisputeCategory: 'UNAUTHORIZED_REWEIGH',
      legalRebuttalStatement: DisputePackageGenerator.buildLegalRebuttal('UNAUTHORIZED_REWEIGH', {
        billedWeight: 3750,
        quotedWeight: 3200,
      }),
      origin: {
        name: 'Apex Manufacturing Los Angeles',
        address: '100 Industrial Parkway',
        city: 'Los Angeles',
        state: 'CA',
        zip: '90001',
      },
      destination: {
        name: 'Midwest Distribution Hub',
        address: '500 Logistics Way',
        city: 'Chicago',
        state: 'IL',
        zip: '60601',
      },
      evidence: {
        bolDetails: {
          bolNumber: 'BOL-2026-8941',
          shipperName: 'Apex Manufacturing Los Angeles',
          originAddress: '100 Industrial Parkway, Los Angeles, CA',
          consigneeName: 'Midwest Distribution Hub',
          destAddress: '500 Logistics Way, Chicago, IL',
          certifiedWeightLbs: 3200,
          totalPallets: 4,
          declaredClass: '70',
          bolSha256Hash: 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2',
          signedDate: '2026-08-25',
        },
        podDetails: {
          podId: '01916362-7901-7080-867c-pod00000001',
          deliveredAt: '2026-08-28 14:28:10 CST',
          consigneeSignerName: 'Robert Vance, Receiving Dock Manager',
          signatureSha256OrData: 'f9e8d7c6b5a4f3e2d1c0b9a8f7e6d5c4b3a2f1e0d9c8b7a6f5e4d3c2b1a0f9e8',
          gpsLatitude: 41.8781,
          gpsLongitude: -87.6298,
          isWithinGeofence: true,
          dockDeliveryBadge: true,
          accessorialNotationsNone: true,
          pieceCountVerified: true,
          receivedPieces: 4,
        },
        scaleTicketRequirement: {
          citedRule: '49 CFR § 378.4',
          status: 'UNFURNISHED_BY_CARRIER',
          demandNotice: 'Pursuant to 49 CFR § 378.4, carrier must provide certified scale weight ticket with gross, tare, and net weights.',
        },
      },
    };

    it('renders complete HTML dispute package with print toolbar, legal citation, comparison table, and evidence hashes', () => {
      const html = DisputePackageGenerator.renderDisputeHtml(sampleDisputeData);

      // Header & Reference
      expect(html).toContain('APEX FREIGHT SOLUTIONS');
      expect(html).toContain('DISP-2026-XPO-98421');
      expect(html).toContain('XPO Logistics (XPO)');
      expect(html).toContain('disputes@xpo.com');
      expect(html).toContain('XPO-9842100');

      // Print Toolbar
      expect(html).toContain('window.print()');
      expect(html).toContain('Print / Save PDF');

      // 49 CFR § 378 Citation
      expect(html).toContain('49 CFR § 378 (Procedures Governing the Processing, Investigation, and Disposition of Overcharge Claims)');
      expect(html).toContain('49 U.S.C. § 14708');

      // Side-by-Side Comparison Table
      expect(html).toContain('Statement of Overcharge & Line-Item Variance');
      expect(html).toContain('Unauthorized Terminal Reweigh Surcharge');
      expect(html).toContain('UNAUTHORIZED_REWEIGH');
      expect(html).toContain('$1,250.00'); // Quoted
      expect(html).toContain('$1,470.00'); // Invoiced
      expect(html).toContain('$220.00');   // Disputed

      // Page 2 Supporting Evidence Bundle
      expect(html).toContain('DISPUTE EVIDENCE BUNDLE');
      expect(html).toContain('Certified Shipper Bill of Lading (BOL) Specifications');
      expect(html).toContain('a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2');
      expect(html).toContain('Geotagged Proof of Delivery (POD) & Dock Audit');
      expect(html).toContain('Robert Vance, Receiving Dock Manager');
      expect(html).toContain('41.8781, -87.6298');
      expect(html).toContain('f9e8d7c6b5a4f3e2d1c0b9a8f7e6d5c4b3a2f1e0d9c8b7a6f5e4d3c2b1a0f9e8');
      expect(html).toContain('FMCSA 30-Day Acknowledgment Mandate');
    });
  });

  // ==========================================================================
  // 5. PDF COMPILATION TESTS
  // ==========================================================================
  describe('High-Resolution PDF Generation (generateDisputePdf)', () => {
    it('generates high-resolution 2-page binary PDF document buffer with PDFKit', async () => {
      const sampleDisputeData: DisputePackageData = {
        disputeReferenceNumber: 'DISP-2026-SAIA-77123',
        issueDate: '2026-09-01',
        carrierName: 'SAIA LTL Freight',
        carrierScac: 'SAIA',
        carrierProNumber: 'SAIA-7712300',
        bolNumber: 'BOL-SAIA-7712',
        destinationDeliveryDate: '2026-08-30',
        claimDeskEmail: 'billingclaims@saia.com',
        legalCitation: '49 CFR § 378',
        lineItems: [
          {
            description: 'Liftgate Delivery Surcharge Dispute',
            category: 'BOGUS_ACCESSORIAL',
            quotedAmountCents: 110000,
            invoicedAmountCents: 117500,
            disputedAmountCents: 7500,
            explanation: 'Commercial dock with bay doors utilized',
          },
        ],
        totalQuotedCents: 110000,
        totalInvoicedCents: 117500,
        totalDisputedCents: 7500,
        primaryDisputeCategory: 'BOGUS_ACCESSORIAL',
        legalRebuttalStatement: DisputePackageGenerator.buildLegalRebuttal('BOGUS_ACCESSORIAL', {
          accessorialCode: 'LG_DEL',
        }),
        origin: { name: 'Origin Facility', city: 'Atlanta', state: 'GA', zip: '30301' },
        destination: { name: 'Receiver Dock', city: 'Dallas', state: 'TX', zip: '75201' },
        evidence: {
          bolDetails: {
            bolNumber: 'BOL-SAIA-7712',
            shipperName: 'Atlanta Depot',
            originAddress: '100 Depot Rd, Atlanta, GA',
            consigneeName: 'Dallas Receiving',
            destAddress: '200 Commercial Way, Dallas, TX',
            certifiedWeightLbs: 2800,
            totalPallets: 3,
            declaredClass: '70',
            bolSha256Hash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
          },
          podDetails: {
            deliveredAt: '2026-08-30 11:15:00 CST',
            consigneeSignerName: 'David Lee',
            signatureSha256OrData: 'c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6',
            gpsLatitude: 32.7767,
            gpsLongitude: -96.797,
            isWithinGeofence: true,
            dockDeliveryBadge: true,
            accessorialNotationsNone: true,
            pieceCountVerified: true,
            receivedPieces: 3,
          },
        },
      };

      const pdfBuffer = await DisputePackageGenerator.generateDisputePdf(sampleDisputeData);

      expect(pdfBuffer).toBeInstanceOf(Buffer);
      expect(pdfBuffer.length).toBeGreaterThan(3000);
      // Verify PDF binary header '%PDF-'
      const header = pdfBuffer.subarray(0, 5).toString('ascii');
      expect(header).toBe('%PDF-');
    });
  });

  // ==========================================================================
  // 6. END-TO-END DATABASE COMPILATION & STATE LIFECYCLE
  // ==========================================================================
  describe('Dispute Compilation & Database Lifecycle (compileAndCreateDispute)', () => {
    it('compiles dispute package from invoice, links discrepancy, updates status to DISPUTE_GENERATED and saves CarrierDispute', async () => {
      // 1. Seed shipment
      const shipment = await dbClient.insertShipment({
        tenantId: testTenantId,
        referenceNumber: 'SHP-2026-XPO-01',
        status: 'DELIVERED',
        originAddress1: '123 Main St',
        originCity: 'Los Angeles',
        originState: 'CA',
        originZip: '90001',
        originCountry: 'US',
        destAddress1: '456 Market St',
        destCity: 'Chicago',
        destState: 'IL',
        destZip: '60601',
        destCountry: 'US',
        totalPallets: 4,
        totalWeightLbs: 3200,
        pickupDateReady: '2026-08-20',
      });

      // 2. Seed Carrier Invoice
      const carrierInvoice = await dbClient.insertCarrierInvoice({
        tenantId: testTenantId,
        shipmentId: shipment.id,
        carrierScac: 'XPO',
        carrierName: 'XPO Logistics',
        proNumber: 'XPO-984210',
        invoiceNumber: 'INV-XPO-110022',
        totalBilledCents: 147000,
        linehaulBilledCents: 125000,
        fuelBilledCents: 0,
        accessorialsBilledCents: 22000,
        billedWeightLbs: 3750,
        billedClass: '70',
        invoiceDate: '2026-09-01',
        status: 'PENDING_AUDIT',
      });

      // 3. Seed Discrepancy Record
      const discrepancy = await dbClient.insertDiscrepancyRecord({
        tenantId: testTenantId,
        carrierInvoiceId: carrierInvoice.id,
        shipmentId: shipment.id,
        discrepancyType: 'UNAUTHORIZED_REWEIGH',
        discrepancyDescription: 'Unauthorized Terminal Reweigh Surcharge',
        quotedCents: 125000,
        billedCents: 147000,
        varianceCents: 22000,
        status: 'FLAGGED',
      });

      // 4. Seed POD
      await dbClient.insertPodRecord({
        tenantId: testTenantId,
        shipmentId: shipment.id,
        imageUrl: 'https://storage.apexfreightos.com/pods/xpo-984210.jpg',
        imageHash: 'a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8',
        fileSizeBytes: 1024000,
        consigneeName: 'Mark Jenkins, Receiver',
        receivedPieces: 4,
        expectedPieces: 4,
        gpsLatitude: 41.8781,
        gpsLongitude: -87.6298,
        isWithinGeofence: true,
        pieceCountVerified: true,
        hasDamageException: false,
        status: 'VERIFIED',
      });

      // 5. Execute compileAndCreateDispute
      const dispute = await DisputePackageGenerator.compileAndCreateDispute({
        tenantId: testTenantId,
        carrierInvoiceId: carrierInvoice.id,
        discrepancyId: discrepancy.id,
        disputeType: 'UNAUTHORIZED_REWEIGH',
      });

      expect(dispute).toBeDefined();
      expect(dispute.disputeReferenceNumber).toMatch(/^DISP-\d{4}-XPO-\d{5}$/);
      expect(dispute.carrierScac).toBe('XPO');
      expect(dispute.carrierProNumber).toBe('XPO-984210');
      expect(dispute.assignedClaimEmail).toBe('disputes@xpo.com');
      expect(dispute.disputedAmountCents).toBe(22000);
      expect(dispute.quotedAmountCents).toBe(125000);
      expect(dispute.billedAmountCents).toBe(147000);
      expect(dispute.status).toBe('DISPUTE_GENERATED');
      expect(dispute.statutoryResponseDeadlineDays).toBe(30);

      // Verify legal rebuttal contains 49 CFR § 378.4
      expect(dispute.rebuttalStatement).toContain('49 CFR § 378.4');
      expect(dispute.rebuttalStatement).toContain('certified scale weight ticket');

      // Verify Discrepancy Record updated in DB
      const updatedDisc = await dbClient.getDiscrepancyRecordById(discrepancy.id);
      expect(updatedDisc?.status).toBe('DISPUTE_GENERATED');
      expect(updatedDisc?.disputePackagePdfPath).toContain(dispute.id);

      // Verify Carrier Invoice updated in DB
      const updatedInv = await dbClient.getCarrierInvoiceById(carrierInvoice.id);
      expect(updatedInv?.status).toBe('DISPUTE_FILED');
    });
  });

  // ==========================================================================
  // 7. API ROUTES INTEGRATION (POST & GET)
  // ==========================================================================
  describe('Disputes API Routes Integration', () => {
    it('POST /api/v1/disputes/generate creates dispute record and returns routing metadata', async () => {
      // Seed shipment & invoice
      const shipment = await dbClient.insertShipment({
        tenantId: testTenantId,
        referenceNumber: 'SHP-2026-ESTES-02',
        status: 'DELIVERED',
        originAddress1: '111 First Ave',
        originCity: 'Richmond',
        originState: 'VA',
        originZip: '23219',
        originCountry: 'US',
        destAddress1: '222 Second Ave',
        destCity: 'Philadelphia',
        destState: 'PA',
        destZip: '19104',
        destCountry: 'US',
        totalPallets: 2,
        totalWeightLbs: 1800,
        pickupDateReady: '2026-08-22',
      });

      const carrierInvoice = await dbClient.insertCarrierInvoice({
        tenantId: testTenantId,
        shipmentId: shipment.id,
        carrierScac: 'EXLA',
        carrierName: 'Estes Express Lines',
        proNumber: 'EXLA-554433',
        invoiceNumber: 'INV-EXLA-9988',
        totalBilledCents: 98000,
        linehaulBilledCents: 85000,
        fuelBilledCents: 0,
        accessorialsBilledCents: 13000,
        billedWeightLbs: 2100,
        billedClass: '70',
        invoiceDate: '2026-09-01',
        status: 'PENDING_AUDIT',
      });

      const req = new NextRequest('http://localhost:3000/api/v1/disputes/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId: testTenantId,
          carrierInvoiceId: carrierInvoice.id,
          disputeType: 'UNAUTHORIZED_REWEIGH',
          customNotes: 'Reweigh rejected pursuant to 49 CFR 378',
        }),
      });

      const res = await generateDisputeRoute(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.dispute).toBeDefined();
      expect(json.dispute.carrierScac).toBe('EXLA');
      expect(json.routing.claimDeskEmail).toBe('reweighs@estes-express.com');
      expect(json.routing.statutoryResponseDays).toBe(30);

      // Verify GET by ID returns JSON
      const getJsonReq = new NextRequest(
        `http://localhost:3000/api/v1/disputes/${json.dispute.id}?format=json&tenantId=${testTenantId}`
      );
      const getJsonRes = await getDisputeRoute(getJsonReq, { params: { id: json.dispute.id } });
      const getJsonData = await getJsonRes.json();

      expect(getJsonRes.status).toBe(200);
      expect(getJsonData.success).toBe(true);
      expect(getJsonData.dispute.id).toBe(json.dispute.id);

      // Verify GET by ID returns HTML
      const getHtmlReq = new NextRequest(
        `http://localhost:3000/api/v1/disputes/${json.dispute.id}?format=html&tenantId=${testTenantId}`
      );
      const getHtmlRes = await getDisputeRoute(getHtmlReq, { params: { id: json.dispute.id } });
      const htmlText = await getHtmlRes.text();

      expect(getHtmlRes.status).toBe(200);
      expect(getHtmlRes.headers.get('Content-Type')).toContain('text/html');
      expect(htmlText).toContain('APEX FREIGHT SOLUTIONS');
      expect(htmlText).toContain('49 CFR § 378');
      expect(htmlText).toContain('reweighs@estes-express.com');

      // Verify GET by ID returns PDF
      const getPdfReq = new NextRequest(
        `http://localhost:3000/api/v1/disputes/${json.dispute.id}?format=pdf&tenantId=${testTenantId}`
      );
      const getPdfRes = await getDisputeRoute(getPdfReq, { params: { id: json.dispute.id } });
      const pdfArrayBuffer = await getPdfRes.arrayBuffer();
      const pdfBuffer = Buffer.from(pdfArrayBuffer);

      expect(getPdfRes.status).toBe(200);
      expect(getPdfRes.headers.get('Content-Type')).toContain('application/pdf');
      expect(pdfBuffer.subarray(0, 5).toString('ascii')).toBe('%PDF-');
    });

    it('returns 404 when dispute ID is not found', async () => {
      const getReq = new NextRequest(
        `http://localhost:3000/api/v1/disputes/nonexistent-id?format=json&tenantId=${testTenantId}`
      );
      const res = await getDisputeRoute(getReq, { params: { id: 'nonexistent-id' } });
      const json = await res.json();

      expect(res.status).toBe(404);
      expect(json.success).toBe(false);
      expect(json.error).toBe('Dispute not found');
    });
  });
});
