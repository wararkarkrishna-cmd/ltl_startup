import { describe, it, expect, beforeEach } from 'vitest';
import { CustomerInvoiceEngine } from '../src/lib/billing/customer-invoice-engine';
import { dbClient } from '../src/db/client';

describe('Phase 4.4: Sub-Minute Customer Invoice Engine (CustomerInvoiceEngine)', () => {
  const tenantId = '01916362-7901-7080-867c-9b8895092a01';
  let shipmentId: string;
  let cleanPodId: string;
  let damagedPodId: string;

  beforeEach(async () => {
    dbClient.setTenantContext(tenantId);

    // Seed test customer account
    const account = {
      id: '01916362-7901-7080-867c-acc000000001',
      tenantId,
      name: 'Pacific Industrial Corp',
      accountType: 'SHIPPER' as const,
      contactName: 'Jennifer Vance (Billing Mgr)',
      contactEmail: 'ap@pacificindustrial.com',
      contactPhone: '555-0812',
      billingAddressLine1: '400 Enterprise Blvd',
      billingCity: 'San Francisco',
      billingState: 'CA',
      billingZip: '94107',
      creditLimitCents: 5000000,
      paymentTermsDays: 30,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    dbClient.accounts.set(account.id, account);

    // Seed test shipment
    const shipment = await dbClient.insertShipment({
      tenantId,
      shipperAccountId: account.id,
      referenceNumber: 'SHP-2026-009941',
      status: 'DELIVERED',
      originName: 'Pacific Industrial HQ',
      originAddress1: '400 Enterprise Blvd',
      originCity: 'San Francisco',
      originState: 'CA',
      originZip: '94107',
      originCountry: 'US',
      destName: 'Apex Midwest Warehouse',
      destAddress1: '1200 Logistics Way',
      destCity: 'Chicago',
      destState: 'IL',
      destZip: '60601',
      destCountry: 'US',
      totalPallets: 4,
      totalWeightLbs: 3600,
      pickupDateReady: '2026-09-01',
      deliveryDateTarget: '2026-09-04',
    });
    shipmentId = shipment.id;

    // Seed Quote with itemized accessorials
    await dbClient.insertQuote({
      tenantId,
      shipmentId,
      carrierCode: 'SAIA',
      carrierName: 'SAIA LTL Freight',
      carrierScac: 'SAIA',
      accountType: 'DIRECT_BYOC',
      sourceTag: 'SAIA_DIRECT',
      quoteNumber: 'Q-SAIA-984210',
      linehaulCostCents: 110000,
      fuelSurchargeCents: 16500,
      accessorialCostCents: 20000,
      totalCarrierCostCents: 146500,
      appliedMarginPercent: 15,
      appliedMarginCents: 21975,
      quotedCustomerPriceCents: 168475,
      grossProfitCents: 21975,
      grossMarginPercent: 13.04,
      transitDays: 3,
      isGuaranteed: false,
      isSelected: true,
      accessorialFees: {
        LG_DEL: 7500,  // $75.00 Liftgate Delivery
        INS_DEL: 12500, // $125.00 Inside Delivery
      },
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });

    // Seed Clean POD Record
    const cleanPod = await dbClient.insertPodRecord({
      tenantId,
      shipmentId,
      imageUrl: '/uploads/pod/clean_pod.jpg',
      imageHash: 'd7a8fbb307d7809469ca9abcb0082e4f8d5651e46d3cdb762d02d0bf37c9e592',
      fileSizeBytes: 350000,
      consigneeName: 'Marcus Wright (Receiving)',
      consigneeSignatureDataUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==',
      receivedPieces: 4,
      expectedPieces: 4,
      gpsLatitude: 41.8781,
      gpsLongitude: -87.6298,
      imageOrientation: 1,
      destLatitude: 41.8781,
      destLongitude: -87.6298,
      geofenceDistanceMiles: 0.08,
      isWithinGeofence: true,
      ocrConfidence: 98.0,
      signatureDetected: true,
      pieceCountVerified: true,
      stampedDateDetected: true,
      stampedDate: '2026-09-04',
      hasDamageException: false,
      detectedExceptionKeywords: [],
      exceptionSeverity: 'NONE',
      claimsAlertSent: false,
      status: 'VERIFIED',
      overallConfidence: 99.0,
      submittedAt: new Date(),
    });
    cleanPodId = cleanPod.id;

    // Seed Damaged POD Record
    const damagedPod = await dbClient.insertPodRecord({
      tenantId,
      shipmentId,
      imageUrl: '/uploads/pod/damaged_pod.jpg',
      imageHash: 'e8b9fcc418e8910570db0bcd01193f5a9e6762f57e4dec873e13e1ca48d0f603',
      fileSizeBytes: 420000,
      consigneeName: 'Marcus Wright (Receiving)',
      receivedPieces: 2,
      expectedPieces: 4,
      gpsLatitude: 41.8781,
      gpsLongitude: -87.6298,
      imageOrientation: 1,
      isWithinGeofence: true,
      ocrConfidence: 95.0,
      signatureDetected: true,
      pieceCountVerified: false,
      stampedDateDetected: false,
      hasDamageException: true,
      detectedExceptionKeywords: ['Shortage', 'Damaged', 'Crushed'],
      exceptionSeverity: 'CRITICAL',
      claimsAlertSent: true,
      status: 'FLAGGED_EXCEPTION',
      overallConfidence: 85.0,
      submittedAt: new Date(),
    });
    damagedPodId = damagedPod.id;
  });

  it('calculates due date accurately without timezone drift', () => {
    expect(CustomerInvoiceEngine.calculateDueDate('2026-09-01', 30)).toBe('2026-10-01');
    expect(CustomerInvoiceEngine.calculateDueDate('2026-01-15', 15)).toBe('2026-01-30');
    expect(CustomerInvoiceEngine.calculateDueDate('2026-12-15', 30)).toBe('2027-01-14');
  });

  it('executes sub-minute invoicing on verified clean POD with zero integer drift', async () => {
    const result = await CustomerInvoiceEngine.generateAndIssueInvoice({
      tenantId,
      shipmentId,
      podId: cleanPodId,
      customerPoNumber: 'PO-PACIFIC-8890',
      paymentTermsDays: 30,
      invoiceDate: '2026-09-04',
    });

    expect(result.success).toBe(true);
    expect(result.invoice).toBeDefined();
    expect(result.invoice.invoiceNumber).toMatch(/^INV-2026-\d{5}$/);
    expect(result.invoice.dueDate).toBe('2026-10-04');
    expect(result.invoice.status).toBe('ISSUED');
    expect(result.invoice.shipperName).toBe('Pacific Industrial Corp');
    expect(result.invoice.shipperEmail).toBe('ap@pacificindustrial.com');

    // Strict Integer Financial Math Check:
    // Total = Linehaul ($1,319.75) + Fuel ($165.00) + Liftgate ($75.00) + Inside ($125.00) = $1,684.75 (168475 cents)
    const inv = result.invoice;
    expect(inv.linehaulAmountCents + inv.fuelSurchargeCents + inv.accessorialAmountCents).toBe(inv.totalAmountCents);
    expect(inv.totalAmountCents).toBe(168475);
    expect(inv.accessorialAmountCents).toBe(20000); // 7500 + 12500

    // Check Shipment Status Updated to INVOICED
    const updatedShipment = await dbClient.getShipmentById(shipmentId);
    expect(updatedShipment?.status).toBe('INVOICED');

    // Check PDF Buffer generated
    expect(result.pdfBuffer).toBeDefined();
    expect(result.pdfBuffer.length).toBeGreaterThan(2000);

    // Check AP Email dispatched
    expect(result.emailDispatchStatus.sent).toBe(true);
    expect(result.emailDispatchStatus.recipient).toBe('ap@pacificindustrial.com');
    expect(result.emailDispatchStatus.subject).toContain('PO-PACIFIC-8890');
  });

  it('blocks automated invoicing when POD has high/critical exception unless manual release is given', async () => {
    // Attempting without manual release should throw
    await expect(
      CustomerInvoiceEngine.generateAndIssueInvoice({
        tenantId,
        shipmentId,
        podId: damagedPodId,
        customerPoNumber: 'PO-PACIFIC-8890',
        manualBrokerRelease: false,
      })
    ).rejects.toThrow('AUTOMATIC INVOICING BLOCKED');

    // With manual broker release, it proceeds
    const manualResult = await CustomerInvoiceEngine.generateAndIssueInvoice({
      tenantId,
      shipmentId,
      podId: damagedPodId,
      customerPoNumber: 'PO-PACIFIC-8890',
      manualBrokerRelease: true,
      brokerReleaseNotes: 'Broker verified partial release after carrier credit agreement.',
    });

    expect(manualResult.success).toBe(true);
    expect(manualResult.invoice.status).toBe('ISSUED');
  });
});
