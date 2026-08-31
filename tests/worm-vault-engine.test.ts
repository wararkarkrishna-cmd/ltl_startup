import { describe, it, expect, beforeEach } from 'vitest';
import { WormVaultEngine, VAULT_DOCUMENT_TYPES } from '../src/lib/storage/worm-vault-engine';
import { dbClient } from '../src/db/client';

describe('Phase 4.8: Settlement Document Vault with S3 WORM Compliance (WormVaultEngine)', () => {
  const tenantId = '01916362-7901-7080-867c-9b8895092a01';
  let shipmentId: string;
  let invoiceId: string;

  beforeEach(async () => {
    dbClient.setTenantContext(tenantId);

    // 1. Seed Customer Account
    const account = {
      id: '01916362-7901-7080-867c-acc000000001',
      tenantId,
      name: 'Vanguard Industrial Supply Co',
      accountType: 'SHIPPER' as const,
      contactName: 'Robert Langdon (AP Lead)',
      contactEmail: 'ap@vanguardlogistics.com',
      contactPhone: '555-0199',
      billingAddressLine1: '8800 Commerce Blvd',
      billingCity: 'Dallas',
      billingState: 'TX',
      billingZip: '75201',
      creditLimitCents: 5000000,
      paymentTermsDays: 30,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    dbClient.accounts.set(account.id, account);

    // 2. Seed Shipment
    const shipment = await dbClient.insertShipment({
      tenantId,
      shipperAccountId: account.id,
      referenceNumber: 'SHP-2026-WORM-001',
      status: 'DELIVERED',
      originName: 'Vanguard Dallas Distribution',
      originAddress1: '8800 Commerce Blvd',
      originCity: 'Dallas',
      originState: 'TX',
      originZip: '75201',
      originCountry: 'US',
      destName: 'Apex Midwest Hub',
      destAddress1: '1400 Hub Parkway',
      destCity: 'Chicago',
      destState: 'IL',
      destZip: '60601',
      destCountry: 'US',
      totalPallets: 4,
      totalWeightLbs: 4200,
      pickupDateReady: '2026-09-01',
      deliveryDateTarget: '2026-09-04',
    });
    shipmentId = shipment.id;

    // 3. Seed POD Record
    await dbClient.insertPodRecord({
      tenantId,
      shipmentId,
      imageUrl: '/uploads/pod/shp-worm-001.jpg',
      imageHash: 'a1b2c3d4e5f60718293a4b5c6d7e8f90123456789abcdef0123456789abcdef0',
      fileSizeBytes: 245000,
      consigneeName: 'Marcus Wright (Dock Foreman)',
      consigneeSignatureDataUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==',
      receivedPieces: 4,
      expectedPieces: 4,
      gpsLatitude: 41.8781,
      gpsLongitude: -87.6298,
      destLatitude: 41.8781,
      destLongitude: -87.6298,
      geofenceDistanceMiles: 0.05,
      isWithinGeofence: true,
      ocrConfidence: 99.1,
      signatureDetected: true,
      pieceCountVerified: true,
      stampedDateDetected: true,
      stampedDate: '2026-09-04',
      hasDamageException: false,
      detectedExceptionKeywords: [],
      exceptionSeverity: 'NONE',
      claimsAlertSent: false,
      status: 'VERIFIED',
      overallConfidence: 99.4,
      submittedAt: new Date('2026-09-04T14:30:00Z'),
    });

    // 4. Seed Carrier Tender
    await dbClient.insertTender({
      tenantId,
      shipmentId,
      quoteId: '01916362-7901-7080-867c-9b8895092a01',
      carrierCode: 'ESTES',
      carrierName: 'Estes Express Lines',
      carrierScac: 'EXLA',
      tenderMethod: 'REST_API',
      tenderStatus: 'TENDER_ACCEPTED',
      tenderSentAt: new Date('2026-09-01T10:00:00Z'),
      tenderRespondedAt: new Date('2026-09-01T10:05:00Z'),
    });

    // 5. Seed Customer Invoice
    const invoice = await dbClient.insertCustomerInvoice({
      tenantId,
      shipmentId,
      customerAccountId: account.id,
      invoiceNumber: 'INV-2026-99042',
      customerPoNumber: 'PO-VG-7741',
      invoiceDate: '2026-09-04',
      dueDate: '2026-10-04',
      paymentTermsDays: 30,
      linehaulAmountCents: 85000,
      fuelSurchargeCents: 16500,
      accessorialAmountCents: 7500,
      accessorialBreakdown: {},
      totalAmountCents: 109000,
      currency: 'USD',
      shipperName: 'Vanguard Industrial Supply Co',
      shipperEmail: 'ap@vanguardlogistics.com',
      shipperAddress: '800 West Monroe St, Chicago, IL 60661',
      remitInstructions: {
        bankName: 'JPMorgan Chase',
        routingNumber: '021000021',
        accountNumber: '984021984210',
        remitEmail: 'billing@apexfreightos.com',
        remitAddress: '1000 Logistics Blvd, Chicago IL',
      },
      status: 'ISSUED',
    });
    invoiceId = invoice.id;
  });

  it('calculates deterministic SHA-256 hashes and Merkle root reduction', () => {
    const hash1 = WormVaultEngine.calculateSha256('document_one_content');
    const hash2 = WormVaultEngine.calculateSha256('document_two_content');
    const hash3 = WormVaultEngine.calculateSha256('document_three_content');
    const hash4 = WormVaultEngine.calculateSha256('document_four_content');
    const hash5 = WormVaultEngine.calculateSha256('document_five_content');

    expect(hash1).toHaveLength(64);
    expect(hash2).toHaveLength(64);

    const merkleRoot = WormVaultEngine.calculateMerkleRoot([hash1, hash2, hash3, hash4, hash5]);
    expect(merkleRoot).toHaveLength(64);

    // Merkle root must be deterministic
    const merkleRootAgain = WormVaultEngine.calculateMerkleRoot([hash1, hash2, hash3, hash4, hash5]);
    expect(merkleRootAgain).toBe(merkleRoot);
  });

  it('calculates 7-year DOT / FMCSA WORM retention date accurately', () => {
    const baseDate = new Date('2026-09-04T12:00:00Z');
    const retentionDate = WormVaultEngine.calculate7YearRetentionDate(baseDate);

    // 7 years later (2033)
    expect(retentionDate.getUTCFullYear()).toBe(2033);
    expect(retentionDate.getTime()).toBeGreaterThan(baseDate.getTime());
  });

  it('compiles all 5 required regulatory documents in Complete Load Settlement Archive', async () => {
    const shipment = (await dbClient.getShipmentById(shipmentId))!;
    const docs = await WormVaultEngine.compileSettlementDocuments(tenantId, shipment, invoiceId);

    expect(docs).toHaveLength(5);
    const types = docs.map((d) => d.documentType);

    expect(types).toContain('VICS_DIGITAL_BOL');
    expect(types).toContain('GEOTAGGED_POD_EXIF');
    expect(types).toContain('CARRIER_RATE_CONFIRMATION');
    expect(types).toContain('CUSTOMER_FREIGHT_INVOICE');
    expect(types).toContain('FMCSA_SAFETY_INSURANCE_CERTIFICATE');

    for (const doc of docs) {
      expect(doc.fileHashSha256).toHaveLength(64);
      expect(doc.sizeBytes).toBeGreaterThan(500);
      expect(doc.buffer.length).toBe(doc.sizeBytes);
      expect(doc.mimeType).toBe('application/pdf');
    }
  });

  it('packages and seals settlement load archive with S3 WORM COMPLIANCE lock and persists in database', async () => {
    const result = await WormVaultEngine.packageAndSealSettlement({
      tenantId,
      shipmentId,
      invoiceId,
      deliveryDate: '2026-09-04',
    });

    expect(result.success).toBe(true);
    expect(result.package).toBeDefined();
    expect(result.package.id).toBeDefined();
    expect(result.package.shipmentId).toBe(shipmentId);
    expect(result.package.invoiceId).toBe(invoiceId);
    expect(result.package.retentionMode).toBe('COMPLIANCE');
    expect(result.package.merkleRootHash).toHaveLength(64);
    expect(result.package.bundleManifest).toHaveLength(5);

    // S3 Object Lock configuration check
    expect(result.s3ObjectLockConfig.retentionMode).toBe('COMPLIANCE');
    expect(result.s3ObjectLockConfig.isLegalHoldActive).toBe(false);
    expect(result.s3ObjectLockConfig.retainUntilDate.getUTCFullYear()).toBe(2033);
    expect(result.s3ObjectLockConfig.sha256Checksum).toBe(result.merkleRootHash);

    // Database lookup check
    const stored = await dbClient.getWormAuditPackageByShipmentId(tenantId, shipmentId);
    expect(stored).toBeDefined();
    expect(stored?.merkleRootHash).toBe(result.merkleRootHash);
    expect(stored?.packageReference).toContain('SHP-2026-WORM-001');

    // Compliance Certificate check
    expect(result.complianceCertificateHtml).toContain('FMCSA 49 CFR § 379 & DOT 7-YEAR WORM SEALED');
    expect(result.complianceCertificateHtml).toContain(result.merkleRootHash);
  });

  it('validates cryptographic package integrity and catches tampered document payload', async () => {
    const result = await WormVaultEngine.packageAndSealSettlement({
      tenantId,
      shipmentId,
      invoiceId,
      deliveryDate: '2026-09-04',
    });

    // 1. Untampered check -> Must pass
    const verificationUntampered = WormVaultEngine.verifyVaultPackageIntegrity(result.package);
    expect(verificationUntampered.isValid).toBe(true);
    expect(verificationUntampered.matchedCount).toBe(5);
    expect(verificationUntampered.mismatches).toHaveLength(0);

    // 2. Tampered check -> Modify one document's hash
    const tamperedHashes = result.package.bundleManifest.map((m, idx) =>
      idx === 0 ? 'bad_hash_000000000000000000000000000000000000000000000000000000000000' : m.fileHashSha256
    );

    const verificationTampered = WormVaultEngine.verifyVaultPackageIntegrity(result.package, tamperedHashes);
    expect(verificationTampered.isValid).toBe(false);
    expect(verificationTampered.matchedCount).toBe(4);
    expect(verificationTampered.mismatches.length).toBeGreaterThan(0);
    expect(verificationTampered.mismatches[0]).toContain('hash mismatch');
  });

  it('exports AWS S3 Object Lock PutObjectRetention & PutObjectLegalHold command payloads', async () => {
    const result = await WormVaultEngine.packageAndSealSettlement({
      tenantId,
      shipmentId,
      invoiceId,
    });

    const s3Payload = WormVaultEngine.exportS3ObjectLockPutPayload(result.package);
    expect(s3Payload.PutObjectRetentionCommandInput.Bucket).toBe(result.package.s3Bucket);
    expect(s3Payload.PutObjectRetentionCommandInput.Retention.Mode).toBe('COMPLIANCE');
    expect(s3Payload.PutObjectRetentionCommandInput.Retention.RetainUntilDate).toEqual(result.package.retainUntilDate);
    expect(s3Payload.PutObjectLegalHoldCommandInput.LegalHold.Status).toBe('OFF');
    expect(s3Payload.ChecksumSHA256).toBe(result.package.merkleRootHash);
  });
});
