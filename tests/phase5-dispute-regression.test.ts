import { describe, it, expect, beforeEach } from 'vitest';
import { dbClient } from '../src/db/client';
import { CarrierInvoiceParser } from '../src/lib/audit/carrier-invoice-parser';
import { ReBillAuditEngine } from '../src/lib/audit/re-bill-audit-engine';
import { DiscrepancyClassifier } from '../src/lib/audit/discrepancy-classifier';
import { DisputePackageGenerator } from '../src/lib/documents/dispute-package-generator';

describe('Phase 5.1-5.4: Master End-to-End Re-Bill Audit & Dispute Regression Suite', () => {
  const tenantId = '01916362-7901-7080-867c-9b8895092a01';
  let shipmentId: string;
  let quoteId: string;
  const proNumber = 'XPO-89421098';
  const bolNumber = 'BOL-2026-XPO-01';

  beforeEach(async () => {
    dbClient.setTenantContext(tenantId);

    // 1. Seed baseline shipment
    const shipment = await dbClient.insertShipment({
      tenantId,
      referenceNumber: 'LTL-2026-9921',
      status: 'DELIVERED',
      originName: 'Chicago Dist Center',
      originAddress1: '1200 S Canal St',
      originCity: 'Chicago',
      originState: 'IL',
      originZip: '60607',
      originCountry: 'US',
      destName: 'Dallas Retail Hub',
      destAddress1: '4500 Commerce Way',
      destCity: 'Dallas',
      destState: 'TX',
      destZip: '75201',
      destCountry: 'US',
      totalPallets: 4,
      totalWeightLbs: 3200,
      pickupDateReady: '2026-09-01' as any,
    });
    shipmentId = shipment.id;

    // 2. Seed baseline Quote
    const quote = await dbClient.insertQuote({
      tenantId,
      shipmentId,
      carrierCode: 'XPO',
      carrierName: 'XPO Logistics',
      carrierScac: 'CNWY',
      accountType: 'DIRECT_BYOC',
      sourceTag: 'BYOC_CONTRACT',
      quoteNumber: 'XPO-Q-88219',
      linehaulCostCents: 58000,      // $580.00
      fuelSurchargeCents: 11600,     // $116.00
      accessorialCostCents: 2500,    // $25.00 (NOTIFY)
      totalCarrierCostCents: 72100,  // $721.00
      appliedMarginPercent: 15.0,
      appliedMarginCents: 10815,
      quotedCustomerPriceCents: 82915,
      grossProfitCents: 10815,
      grossMarginPercent: 13.04,
      transitDays: 3,
      isGuaranteed: false,
      isSelected: true,
      accessorialFees: { NOTIFY: 2500 },
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });
    quoteId = quote.id;

    // 3. Seed Rate Confirmation
    await dbClient.insertRateConfirmation({
      tenantId,
      shipmentId,
      rateConfirmationNumber: 'RC-2026-XPO-01',
      carrierCode: 'XPO',
      carrierName: 'XPO Logistics',
      carrierScac: 'CNWY',
      agreedLinehaulCents: 58000,
      agreedFuelCents: 11600,
      agreedAccessorialCents: 2500,
      totalAgreedRateCents: 72100,
      pickupNumber: 'PU-9921',
      pickupDate: '2026-09-01',
      deliveryDateEst: '2026-09-04',
      specialInstructions: 'Commercial dock delivery. No liftgate required.',
    });

    // 4. Seed signed VICS eBOL
    await dbClient.insertDigitalBol({
      tenantId,
      shipmentId,
      bolNumber,
      masterBolNumber: bolNumber,
      proNumber,
      carrierCode: 'XPO',
      carrierScac: 'CNWY',
      barcodeData: `(00)${bolNumber}`,
      freightChargeTerm: 'PREPAID',
      emergencyContact: 'CHEMTREC: 1-800-424-9300',
      shipperSignature: 'Authorized Warehouse Supervisor',
      carrierSignature: 'Driver Verified 4 Pallets / 3,200 lbs',
    });

    // 5. Seed Geotagged POD
    await dbClient.insertPodRecord({
      tenantId,
      shipmentId,
      imageUrl: 'https://storage.freightos.app/tenants/apex/pods/pod-9921.jpg',
      imageHash: 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2',
      fileSizeBytes: 450000,
      consigneeName: 'Carlos Ramirez (Receiving Dock Mgr)',
      receivedPieces: 4,
      expectedPieces: 4,
      gpsLatitude: 32.7767,
      gpsLongitude: -96.7970,
      destLatitude: 32.7767,
      destLongitude: -96.7970,
      geofenceDistanceMiles: 0.05,
      isWithinGeofence: true,
      ocrConfidence: 98.0,
      signatureDetected: true,
      pieceCountVerified: true,
      hasDamageException: false,
      exceptionSeverity: 'NONE',
      status: 'VERIFIED',
      overallConfidence: 99.0,
    });
  });

  it('executes the full Phase 5.1 -> 5.4 automated re-bill audit and legal dispute cycle', async () => {
    // -------------------------------------------------------------------------
    // STEP 1: Phase 5.1 - Ingest Carrier EDI 210 Invoice with Unauthorized Charges
    // -------------------------------------------------------------------------
    const rawEdi210 = [
      'ISA*00*          *00*          *ZZ*CARRIERXPO     *ZZ*APEXFREIGHT    *260920*1030*U*00401*000000001*0*P*>~',
      'GS*IN*CARRIERXPO*APEXFREIGHT*20260920*1030*1*X*004010~',
      'ST*210*0001~',
      `B3*B*INV-XPO-99412*${proNumber}*PP**20260920*97600**20261020*CNWY~`, // Invoiced $976.00 instead of $721.00
      'N1*CA*XPO LOGISTICS*92*CNWY~',
      'N1*SH*CHICAGO DIST CENTER~',
      'N1*CN*DALLAS RETAIL HUB~',
      `N9*BM*${bolNumber}~`,
      'LX*1~',
      'L5*1*COMMERCIAL HVAC UNITS*70*D~',
      'L0*1*3800*LB*4*PLT~', // Reweigh bump: 3,800 lbs (+600 lbs)
      'L1*1*58000*FR*58000****400~', // Linehaul $580.00
      'L1*2*11600*FR*11600****FUE~', // Fuel $116.00
      'L1*3*2500*FR*2500****NOT~',   // Notify $25.00
      'L1*4*15000*FR*15000****LFT~', // BOGUS Liftgate $150.00
      'L1*5*10500*FR*10500****RWG~', // Unauthorized Reweigh $105.00
      'L3*3800*N***97600~',           // Net Total: $976.00
      'SE*17*0001~',
      'GE*1*1~',
      'IEA*1*000000001~',
    ].join('\n');

    const parsedInvoice = CarrierInvoiceParser.parseEdi210(rawEdi210, tenantId);
    const lgAcc = parsedInvoice.invoicedAccessorialBreakdown.find((a) => a.code === 'LG_DEL');
    const rwgAcc = parsedInvoice.invoicedAccessorialBreakdown.find((a) => a.code === 'REWEIGH');
    expect(lgAcc?.amountCents).toBe(15000);
    expect(rwgAcc?.amountCents).toBe(10500);

    const { carrierInvoice, matchedShipment } = await CarrierInvoiceParser.matchAndIngestInvoice({
      tenantId,
      rawPayload: rawEdi210,
      format: 'EDI_210',
    });

    expect(matchedShipment).not.toBeNull();
    expect(carrierInvoice.shipmentId).toBe(shipmentId);
    expect(carrierInvoice.invoicedTotalCents).toBe(97600);

    // -------------------------------------------------------------------------
    // STEP 2: Phase 5.2 - Automated Line-Item Cross-Audit
    // -------------------------------------------------------------------------
    const auditResult = await ReBillAuditEngine.auditCarrierInvoice(tenantId, carrierInvoice.id);

    expect(auditResult.isWithinTolerance).toBe(false);
    expect(auditResult.status).toBe('DISCREPANCY_FLAGGED');
    expect(auditResult.expectedTotalCents).toBe(72100);
    expect(auditResult.invoicedTotalCents).toBe(97600);
    expect(auditResult.deltas.totalDeltaCents).toBe(25500); // $255.00 overcharge
    expect(auditResult.deltas.weightDeltaLbs).toBe(600);    // 3,800 - 3,200 = 600 lbs delta
    expect(auditResult.deltas.accessorials.length).toBeGreaterThanOrEqual(1);

    // -------------------------------------------------------------------------
    // STEP 3: Phase 5.3 - Discrepancy Classification & Categorization Matrix
    // -------------------------------------------------------------------------
    const classification = await DiscrepancyClassifier.classifyDiscrepancy(auditResult);

    expect(classification.isDisputed).toBe(true);
    expect(classification.totalDisputableAmountCents).toBe(38875); // $388.75 (Proportional weight linehaul $108.75 + Liftgate $150.00 + Reweigh fee $105.00)
    expect(classification.overallConfidenceScore).toBeGreaterThanOrEqual(90.0);

    const categories = classification.discrepancies.map((c) => c.discrepancyType);
    expect(categories).toContain('UNAUTHORIZED_REWEIGH');
    expect(categories).toContain('BOGUS_ACCESSORIAL');

    // Persist Discrepancy Records
    const savedDiscrepancies = await DiscrepancyClassifier.createAndPersistDiscrepancies(
      tenantId,
      auditResult
    );
    expect(savedDiscrepancies.length).toBeGreaterThanOrEqual(1);

    // -------------------------------------------------------------------------
    // STEP 4: Phase 5.4 - Automated Legal Dispute Package Generation
    // -------------------------------------------------------------------------
    const primaryDiscrepancy = savedDiscrepancies[0];
    const carrierDispute = await DisputePackageGenerator.compileAndCreateDispute({
      tenantId,
      carrierInvoiceId: carrierInvoice.id,
      discrepancyId: primaryDiscrepancy.id,
    });

    expect(carrierDispute.disputeReferenceNumber).toMatch(/^DISP-\d{4}-[A-Z0-9]+-/);
    expect(carrierDispute.carrierProNumber).toBe(proNumber);
    expect(carrierDispute.disputedAmountCents).toBeGreaterThan(0);
    expect(carrierDispute.carrierContactEmail).toMatch(/@(xpo\.com|xpol\.com)$/);
    expect(carrierDispute.disputeStatus).toBe('DISPUTE_GENERATED');
    expect(carrierDispute.disputeLetterText).toContain('49 CFR § 378');

    // Verify PDF and HTML Generation
    const disputePdf = await DisputePackageGenerator.generateDisputePdf(
      carrierDispute.disputePackageData as any
    );

    expect(disputePdf).toBeInstanceOf(Buffer);
    expect(disputePdf.length).toBeGreaterThan(500);

    const disputeHtml = DisputePackageGenerator.renderDisputeHtml(
      carrierDispute.disputePackageData as any
    );

    expect(disputeHtml).toContain('49 CFR § 378');
    expect(disputeHtml).toContain('window.print()');
  });
});
