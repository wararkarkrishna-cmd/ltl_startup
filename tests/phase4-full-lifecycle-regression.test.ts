import { describe, it, expect, beforeEach } from 'vitest';
import { dbClient } from '../src/db/client';
import { PodTokenEngine } from '../src/lib/pod/pod-token-engine';
import { GeofenceValidator } from '../src/lib/pod/geofence-validator';
import { PodValidatorEngine } from '../src/lib/pod/pod-validator-engine';
import { DamageDetectorEngine } from '../src/lib/pod/damage-detector-engine';
import { CustomerInvoiceEngine } from '../src/lib/billing/customer-invoice-engine';
import { InvoiceGenerator } from '../src/lib/documents/invoice-generator';
import { AccountingSyncEngine } from '../src/lib/accounting/accounting-sync-engine';
import { GrossMarginEngine } from '../src/lib/accounting/gross-margin-engine';
import { CommissionCalculator } from '../src/lib/accounting/commission-calculator';
import { ArAgingEngine } from '../src/lib/accounting/ar-aging-engine';
import { DunningEngine } from '../src/lib/accounting/dunning-engine';
import { WormVaultEngine } from '../src/lib/storage/worm-vault-engine';

describe('Phase 4.9: Master End-to-End POD-to-Invoice & Settlement Regression Harness', () => {
  const tenantId = '01916362-7901-7080-867c-9b8895092a01';
  let shipmentId: string;
  let quoteId: string;

  beforeEach(async () => {
    dbClient.setTenantContext(tenantId);

    // 1. Seed Customer Account
    const account = {
      id: '01916362-7901-7080-867c-9b8895092acc',
      tenantId,
      name: 'Acme Heavy Industrial Corp.',
      contactEmail: 'ap@acmeindustrial.com',
      contactPhone: '+1-312-555-0100',
      billingAddress1: '100 Manufacturing Way',
      billingCity: 'Chicago',
      billingState: 'IL',
      billingZip: '60601',
      creditLimitCents: 5000000, // $50,000.00
      paymentTermsDays: 30,
      isCreditHold: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    dbClient.accounts.set(account.id, account as any);

    // 2. Seed Sales Representative
    await dbClient.insertSalesRep({
      tenantId,
      name: 'Marcus Vance',
      email: 'm.vance@apexfreightos.com',
      phone: '+1-312-555-0188',
      defaultCommissionTierId: 'SENIOR_REP_TIER',
      baseCommissionPercent: 10.0,
      monthlyProfitQuotaCents: 1000000, // $10,000.00
      isActive: true,
    });

    // 3. Seed Accounting OAuth2 Connection (QuickBooks Online)
    await dbClient.insertAccountingConnection({
      tenantId,
      platform: 'QUICKBOOKS_ONLINE',
      realmId: '46208163650192',
      companyName: 'Apex Logistics Freight LLC',
      accessToken: 'qbo_access_token_mock_test_2026',
      refreshToken: 'qbo_refresh_token_mock_test_2026',
      tokenExpiresAt: new Date(Date.now() + 3600 * 1000 * 24),
      isActive: true,
      glFreightRevenueAccountId: '4000',
      glCarrierExpenseAccountId: '5000',
      glAccountsReceivableAccountId: '1200',
      glAccountsPayableAccountId: '2000',
      syncSettings: { autoSyncInvoices: true, autoSyncBills: true },
      lastSyncAt: null,
    });

    // 4. Seed Delivered Shipment
    const shipment = await dbClient.insertShipment({
      tenantId,
      referenceNumber: 'LTL-2026-REG-8821',
      status: 'DELIVERED',
      shipperAccountId: account.id,
      originName: 'Acme Midwest Warehouse',
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
      totalWeightLbs: 3850,
      pickupDateReady: '2026-08-28',
    });
    shipmentId = shipment.id;

    // 5. Seed Selected Carrier Quote (Wholesale SAIA rate with Liftgate)
    const quote = await dbClient.insertQuote({
      tenantId,
      shipmentId,
      carrierCode: 'SAIA',
      carrierName: 'SAIA LTL Freight',
      carrierScac: 'SAIA',
      accountType: 'PLATFORM_WHOLESALE',
      sourceTag: 'PLATFORM_WHOLESALE',
      quoteNumber: 'Q-8821-SAIA',
      linehaulCostCents: 52000,
      fuelSurchargeCents: 14500,
      accessorialCostCents: 7500, // Liftgate delivery
      totalCarrierCostCents: 74000, // $740.00 Carrier Cost
      appliedMarginPercent: 18.0,
      appliedMarginCents: 16244,
      quotedCustomerPriceCents: 90244, // $902.44 Invoiced to Customer
      grossProfitCents: 16244, // $162.44 Gross Profit
      grossMarginPercent: 18.0,
      transitDays: 2,
      isGuaranteed: true,
      isSelected: true,
      accessorialFees: { LG_DEL: 7500 },
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });
    quoteId = quote.id;

    // 6. Seed Accepted Carrier Tender
    await dbClient.insertTender({
      tenantId,
      shipmentId,
      quoteId,
      carrierCode: 'SAIA',
      carrierName: 'SAIA LTL Freight',
      carrierScac: 'SAIA',
      tenderMethod: 'REST_API',
      tenderStatus: 'TENDER_ACCEPTED',
      proNumber: 'SAIA-984210',
      pickupNumber: 'PU-8821',
      tenderSentAt: new Date(),
      tenderRespondedAt: new Date(),
    });
  });

  it('executes full automated lifecycle: Driver PWA -> Multi-Point POD -> Invoice PDF -> QBO Sync -> Margin & Commission -> AR Aging -> S3 WORM Vault', async () => {
    // -------------------------------------------------------------------------
    // STEP 1: Driver Mobile Token Generation & Consumption (Phase 4.1)
    // -------------------------------------------------------------------------
    const token = await PodTokenEngine.generatePodToken({
      tenantId,
      shipmentId,
      carrierCode: 'SAIA',
      driverPhone: '+1-312-555-0199',
    });
    expect(token.token).toMatch(/^pod_sec_[a-f0-9]{64}$/);

    const tokenVerification = await PodTokenEngine.validateAndConsumePodToken(token.token, true);
    expect(tokenVerification.isValid).toBe(true);
    expect(tokenVerification.podToken?.isUsed).toBe(true);

    // -------------------------------------------------------------------------
    // STEP 2: Haversine Geofence & Multi-Point POD Validation (Phase 4.2 & 4.3)
    // -------------------------------------------------------------------------
    // Chicago 60601 centroid: lat 41.8853, lon -87.6216
    const geo = GeofenceValidator.validateDeliveryLocation('60601', 41.8853, -87.6216, 0.5);
    expect(geo.isWithinGeofence).toBe(true);
    expect(geo.distanceMiles).toBeLessThan(0.5);

    const mockPhotoBuffer = Buffer.from('RECEIVED 4 PALLETS CLEAN ORDER. DATE: 08/30/2026. SIGNED: MIKE DOCK');
    const signatureCanvasDataUrl = 'data:image/png;base64,' + 'A'.repeat(250);

    const podValidation = await PodValidatorEngine.validatePod(mockPhotoBuffer, {
      tenantId,
      shipmentId,
      destZip: '60601',
      clientGpsLat: 41.8853,
      clientGpsLon: -87.6216,
      consigneeName: 'Mike Dock, Receiving Lead',
      consigneeSignatureDataUrl: signatureCanvasDataUrl,
      receivedPieces: 4,
      expectedPieces: 4,
      driverNotes: 'Clean delivery. Consignee signed on mobile canvas.',
    });

    expect(['VERIFIED', 'FLAGGED_EXCEPTION']).toContain(podValidation.status);
    expect(podValidation.pieceCountVerified).toBe(true);
    expect(podValidation.damageCheck.hasDamageException).toBe(false);

    // Persist POD in DB
    const podRecord = await dbClient.insertPodRecord({
      tenantId,
      shipmentId,
      imageUrl: '/uploads/pod/pod_clean_8821.jpg',
      imageHash: podValidation.imageHash,
      fileSizeBytes: podValidation.fileSizeBytes,
      consigneeName: podValidation.consigneeName,
      receivedPieces: 4,
      expectedPieces: 4,
      status: 'VERIFIED',
      overallConfidence: podValidation.overallConfidence,
      destLatitude: 41.8853,
      destLongitude: -87.6216,
      isWithinGeofence: true,
      signatureDetected: true,
      pieceCountVerified: true,
      stampedDateDetected: true,
      hasDamageException: false,
      detectedExceptionKeywords: [],
      exceptionSeverity: 'NONE',
    });
    expect(podRecord.id).toBeDefined();

    // -------------------------------------------------------------------------
    // STEP 3: Sub-Minute Instant Customer Invoice Generation (<60s DSO) (Phase 4.4)
    // -------------------------------------------------------------------------
    const invoiceResult = await CustomerInvoiceEngine.generateAndIssueInvoice({
      tenantId,
      shipmentId,
      podId: podRecord.id,
      customerPoNumber: 'PO-ACME-8821',
      paymentTermsDays: 30,
    });

    expect(invoiceResult.success).toBe(true);
    expect(invoiceResult.invoice.invoiceNumber).toMatch(/^INV-\d{4}-\d{5}$/);
    expect(invoiceResult.invoice.totalAmountCents).toBe(90244); // Exact $902.44
    expect(invoiceResult.invoice.linehaulAmountCents).toBe(68244);
    expect(invoiceResult.invoice.fuelSurchargeCents).toBe(14500);
    expect(invoiceResult.invoice.accessorialAmountCents).toBe(7500);

    // Verify 2-Page PDF document binary compilation
    const pdfBuffer = await InvoiceGenerator.generateInvoicePdf(invoiceResult.invoicePdfData);
    expect(pdfBuffer.subarray(0, 4).toString('ascii')).toBe('%PDF');
    expect(pdfBuffer.length).toBeGreaterThan(1000);

    // -------------------------------------------------------------------------
    // STEP 4: Accounting System Integration (QuickBooks Online Sync) (Phase 4.5)
    // -------------------------------------------------------------------------
    const arSync = await AccountingSyncEngine.syncCustomerInvoice(tenantId, invoiceResult.invoice.id);
    expect(arSync.success).toBe(true);
    expect(arSync.platform).toBe('QUICKBOOKS_ONLINE');
    expect(arSync.syncType).toBe('AR_INVOICE');
    expect(arSync.externalPlatformId).toMatch(/^QBO-INV-/i);

    const apSync = await AccountingSyncEngine.syncCarrierBill(tenantId, shipmentId);
    expect(apSync.success).toBe(true);
    expect(apSync.syncType).toBe('AP_BILL');
    expect(apSync.externalPlatformId).toMatch(/^QBO-BILL-/i);

    // -------------------------------------------------------------------------
    // STEP 5: Broker Gross Margin Realization & Commission Calculation (Phase 4.6)
    // -------------------------------------------------------------------------
    const marginAnalysis = GrossMarginEngine.calculateGrossProfit({
      tenantId,
      shipmentId,
      customerInvoicedCents: invoiceResult.invoice.totalAmountCents,
      carrierSettlementCents: 74000, // Carrier cost
      minimumProfitFloorCents: 5000,
    });

    expect(marginAnalysis.realizedGrossProfitCents).toBe(16244); // $162.44
    expect(marginAnalysis.realizedMarginPercent).toBeCloseTo(18.0, 1);
    expect(marginAnalysis.isBelowProfitFloor).toBe(false);
    expect(marginAnalysis.healthClassification).toBe('HEALTHY');

    const salesRep = (await dbClient.getSalesReps(tenantId))[0];
    const commission = await CommissionCalculator.calculateCommission({
      tenantId,
      shipmentId,
      invoiceId: invoiceResult.invoice.id,
      salesRepId: salesRep.id,
      customerInvoicedCents: invoiceResult.invoice.totalAmountCents,
      carrierSettlementCents: 74000,
    });

    expect(commission.record.commissionEarnedCents).toBeGreaterThan(0);
    expect(commission.appliedCommissionPercent).toBeGreaterThanOrEqual(10.0);
    expect(commission.record.status).toBe('ACCRUED');

    // -------------------------------------------------------------------------
    // STEP 6: Accounts Receivable (AR) Aging & Automated Dunning (Phase 4.7)
    // -------------------------------------------------------------------------
    const aging = await ArAgingEngine.analyzeArAging(tenantId);
    expect(aging.totalOpenInvoices).toBeGreaterThanOrEqual(1);
    expect(aging.totalArOutstandingCents).toBeGreaterThan(0);
    expect(aging.buckets.CURRENT.invoiceCount).toBeGreaterThanOrEqual(1);

    const dunningResult = await DunningEngine.evaluateAndDispatchDunning(tenantId);
    expect(dunningResult.totalInvoicesEvaluated).toBeGreaterThanOrEqual(1);

    // -------------------------------------------------------------------------
    // STEP 7: Settlement Document Vault & S3 WORM Compliance Sealing (Phase 4.8)
    // -------------------------------------------------------------------------
    const wormSeal = await WormVaultEngine.packageAndSealSettlement({
      tenantId,
      shipmentId,
      invoiceId: invoiceResult.invoice.id,
    });

    expect(wormSeal.success).toBe(true);
    expect(wormSeal.package.merkleRootHash).toMatch(/^[a-f0-9]{64}$/);
    expect(wormSeal.package.bundleManifest).toHaveLength(5);
    expect(wormSeal.package.retentionMode).toBe('COMPLIANCE');

    // Verify 7-year retention policy (2026 + 7 = 2033)
    expect(wormSeal.package.retainUntilDate.getFullYear()).toBe(2033);

    // Cryptographic tamper check
    const tamperCheck = WormVaultEngine.verifyVaultPackageIntegrity(wormSeal.package);
    expect(tamperCheck.isValid).toBe(true);
  });
});
