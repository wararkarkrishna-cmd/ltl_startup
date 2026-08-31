import { describe, it, expect, beforeEach } from 'vitest';
import {
  ExifParser,
  ImageCompressor,
  GeofenceValidator,
  PodTokenEngine,
  PodValidatorEngine,
  EARTH_RADIUS_MILES,
} from '../src/lib/pod';
import { dbClient } from '../src/db/client';

describe('Phase 4.1 & 4.2: Core POD, EXIF, Geofencing & Image Processing Engines', () => {
  const TEST_TENANT_ID = '01916362-7901-7080-867c-9b8895092a01';
  const TEST_SHIPMENT_ID = '01916362-7901-7080-867c-9b8895092a02';

  beforeEach(() => {
    dbClient.setTenantContext(TEST_TENANT_ID);
  });

  // ==========================================================================
  // 1. EXIF PARSER ENGINE TESTS
  // ==========================================================================
  describe('ExifParser Engine', () => {
    it('accurately converts GPS DMS degrees/minutes/seconds to Decimal Degrees', () => {
      // 34 degrees, 5 minutes, 30.6 seconds North
      const latDec = ExifParser.dmsToDecimal(34, 5, 30.6, 'N');
      expect(latDec).toBeCloseTo(34.091833, 5);

      // 118 degrees, 24 minutes, 23.4 seconds West -> negative
      const lonDec = ExifParser.dmsToDecimal(118, 24, 23.4, 'W');
      expect(lonDec).toBeCloseTo(-118.4065, 4);

      // South latitude -> negative
      const southLat = ExifParser.dmsToDecimal(22, 54, 12, 'S');
      expect(southLat).toBeLessThan(0);
      expect(southLat).toBeCloseTo(-22.903333, 5);
    });

    it('creates a synthesized JPEG APP1 buffer and parses Camera Model, Orientation, and GPS', () => {
      // Create synthetic JPEG with APP1 EXIF segment (Little-Endian TIFF)
      // SOI (2 bytes) + APP1 Marker (2 bytes) + Length (2 bytes) + Exif\0\0 (6 bytes) + TIFF Header + IFD0 + GPS IFD
      const buffer = Buffer.alloc(300);
      let pos = 0;

      // SOI
      buffer.writeUInt16BE(0xffd8, pos); pos += 2;
      // APP1 Marker
      buffer.writeUInt16BE(0xffe1, pos); pos += 2;
      // APP1 Length (250 bytes)
      buffer.writeUInt16BE(250, pos); pos += 2;
      // Exif\0\0 header
      buffer.write('Exif\0\0', pos, 6, 'ascii'); pos += 6;

      const tiffStart = pos;
      // TIFF Header: 'II' (Little Endian) + 42 (magic) + IFD0 offset (8)
      buffer.writeUInt16LE(0x4949, pos); pos += 2;
      buffer.writeUInt16LE(42, pos); pos += 2;
      buffer.writeUInt32LE(8, pos); pos += 4; // IFD0 starts at offset 8 from tiffStart

      // IFD0 starts at tiffStart + 8
      pos = tiffStart + 8;
      // Number of entries in IFD0 = 3 (Orientation, Model pointer, GPS IFD pointer)
      buffer.writeUInt16LE(3, pos); pos += 2;

      // Entry 1: Orientation (Tag 0x0112, Type 3 = SHORT, Count 1, Value 6 = Rotated 90 CW)
      buffer.writeUInt16LE(0x0112, pos); // Tag
      buffer.writeUInt16LE(3, pos + 2);  // Type SHORT
      buffer.writeUInt32LE(1, pos + 4);  // Count
      buffer.writeUInt16LE(6, pos + 8);  // Value 6
      pos += 12;

      // Entry 2: Model (Tag 0x0110, Type 2 = ASCII, Count 14, Offset 100)
      buffer.writeUInt16LE(0x0110, pos);
      buffer.writeUInt16LE(2, pos + 2);
      buffer.writeUInt32LE(14, pos + 4);
      buffer.writeUInt32LE(100, pos + 8); // Offset 100 from tiffStart
      pos += 12;

      // Entry 3: GPS IFD Pointer (Tag 0x8825, Type 4 = LONG, Count 1, Offset 120)
      buffer.writeUInt16LE(0x8825, pos);
      buffer.writeUInt16LE(4, pos + 2);
      buffer.writeUInt32LE(1, pos + 4);
      buffer.writeUInt32LE(120, pos + 8); // Offset 120 from tiffStart
      pos += 12;

      // Write Model string at tiffStart + 100
      buffer.write('iPhone 15 Pro\0', tiffStart + 100, 14, 'ascii');

      // Write GPS SubIFD at tiffStart + 120
      let gpsPos = tiffStart + 120;
      buffer.writeUInt16LE(4, gpsPos); gpsPos += 2; // 4 GPS entries

      // GPS Entry 1: LatitudeRef (0x0001, ASCII 'N')
      buffer.writeUInt16LE(0x0001, gpsPos);
      buffer.writeUInt16LE(2, gpsPos + 2);
      buffer.writeUInt32LE(2, gpsPos + 4);
      buffer.write('N\0', gpsPos + 8, 2, 'ascii');
      gpsPos += 12;

      // GPS Entry 2: Latitude (0x0002, 3 RATIONALs at offset 180)
      buffer.writeUInt16LE(0x0002, gpsPos);
      buffer.writeUInt16LE(5, gpsPos + 2);
      buffer.writeUInt32LE(3, gpsPos + 4);
      buffer.writeUInt32LE(180, gpsPos + 8);
      gpsPos += 12;

      // GPS Entry 3: LongitudeRef (0x0003, ASCII 'W')
      buffer.writeUInt16LE(0x0003, gpsPos);
      buffer.writeUInt16LE(2, gpsPos + 2);
      buffer.writeUInt32LE(2, gpsPos + 4);
      buffer.write('W\0', gpsPos + 8, 2, 'ascii');
      gpsPos += 12;

      // GPS Entry 4: Longitude (0x0004, 3 RATIONALs at offset 204)
      buffer.writeUInt16LE(0x0004, gpsPos);
      buffer.writeUInt16LE(5, gpsPos + 2);
      buffer.writeUInt32LE(3, gpsPos + 4);
      buffer.writeUInt32LE(204, gpsPos + 8);
      gpsPos += 12;

      // Write Latitude Rationals: 41/1 deg, 52/1 min, 48/1 sec (Chicago lat ~41.88)
      let latDataPos = tiffStart + 180;
      buffer.writeUInt32LE(41, latDataPos); buffer.writeUInt32LE(1, latDataPos + 4);
      buffer.writeUInt32LE(52, latDataPos + 8); buffer.writeUInt32LE(1, latDataPos + 12);
      buffer.writeUInt32LE(48, latDataPos + 16); buffer.writeUInt32LE(1, latDataPos + 20);

      // Write Longitude Rationals: 87/1 deg, 37/1 min, 12/1 sec (Chicago lon ~ -87.62)
      let lonDataPos = tiffStart + 204;
      buffer.writeUInt32LE(87, lonDataPos); buffer.writeUInt32LE(1, lonDataPos + 4);
      buffer.writeUInt32LE(37, lonDataPos + 8); buffer.writeUInt32LE(1, lonDataPos + 12);
      buffer.writeUInt32LE(12, lonDataPos + 16); buffer.writeUInt32LE(1, lonDataPos + 20);

      const parsed = ExifParser.parseExif(buffer);

      expect(parsed.hasExif).toBe(true);
      expect(parsed.deviceModel).toBe('iPhone 15 Pro');
      expect(parsed.imageOrientation).toBe(6);
      expect(parsed.gpsLatitude).toBeCloseTo(41.88, 1);
      expect(parsed.gpsLongitude).toBeCloseTo(-87.62, 1);
      expect(parsed.source).toBe('EXIF_APP1');
    });

    it('gracefully handles stripped images and adopts client-supplied fallback GPS', () => {
      const plainBuffer = Buffer.from('Plain Scanned Image without EXIF headers', 'utf-8');

      const fallbackGps = { lat: 32.7876, lon: -96.7997 };
      const parsed = ExifParser.parseExif(plainBuffer, { fallbackGps });

      expect(parsed.hasExif).toBe(false);
      expect(parsed.gpsLatitude).toBe(32.7876);
      expect(parsed.gpsLongitude).toBe(-96.7997);
      expect(parsed.source).toBe('CLIENT_FALLBACK');
      expect(parsed.imageOrientation).toBe(1);
    });
  });

  // ==========================================================================
  // 2. IMAGE COMPRESSOR & INTEGRITY ENGINE TESTS
  // ==========================================================================
  describe('ImageCompressor Engine', () => {
    it('detects MIME types from magic bytes', () => {
      const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
      const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
      const webp = Buffer.from('RIFF\x00\x00\x00\x00WEBPVP8 ', 'binary');

      expect(ImageCompressor.detectMimeType(jpeg)).toBe('image/jpeg');
      expect(ImageCompressor.detectMimeType(png)).toBe('image/png');
      expect(ImageCompressor.detectMimeType(webp)).toBe('image/webp');
      expect(ImageCompressor.validateMimeType('image/jpeg')).toBe(true);
      expect(ImageCompressor.validateMimeType('application/pdf')).toBe(false);
    });

    it('calculates SHA-256 integrity hash for immutable audit compliance', () => {
      const buffer = Buffer.from('Immutable Proof of Delivery Document for Shipment #8841', 'utf-8');
      const hash = ImageCompressor.calculateHash(buffer);

      expect(hash).toHaveLength(64);
      expect(/^[a-f0-9]{64}$/.test(hash)).toBe(true);
    });

    it('compresses large image payloads (>1MB -> <800KB) and calculates compression ratio', async () => {
      // 1.5 MB simulated camera buffer
      const largeBuffer = Buffer.alloc(1.5 * 1024 * 1024);
      largeBuffer[0] = 0xff;
      largeBuffer[1] = 0xd8; // JPEG magic

      const result = await ImageCompressor.processUpload(largeBuffer, 'driver_camera_photo.jpg', {
        maxTargetBytes: 800 * 1024,
      });

      expect(result.originalSizeBytes).toBe(1.5 * 1024 * 1024);
      expect(result.fileSizeBytes).toBeLessThanOrEqual(800 * 1024);
      expect(result.isOptimized).toBe(true);
      expect(result.compressionRatio).toBeGreaterThan(1.0);
      expect(result.compressionSavingsPercent).toBeGreaterThan(30);
      expect(result.hash).toHaveLength(64);
    });

    it('processes Base64 payloads and Data URLs seamlessly', async () => {
      const base64Data = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
      const result = await ImageCompressor.processBase64(base64Data, 'signature.png');

      expect(result.mimeType).toBe('image/png');
      expect(result.fileSizeBytes).toBeGreaterThan(0);
      expect(result.hash).toBeDefined();
    });
  });

  // ==========================================================================
  // 3. GEOFENCE VALIDATOR ENGINE TESTS
  // ==========================================================================
  describe('GeofenceValidator Engine', () => {
    it('calculates accurate Haversine Distance between Chicago and Dallas', () => {
      // Chicago 60601: (41.8853, -87.6216)
      // Dallas 75201: (32.7876, -96.7997)
      const distance = GeofenceValidator.calculateHaversineDistance(
        41.8853,
        -87.6216,
        32.7876,
        -96.7997
      );

      // Expected distance is ~800 miles
      expect(distance).toBeGreaterThan(790);
      expect(distance).toBeLessThan(820);
    });

    it('resolves destination ZIP coordinates with precision', () => {
      const la = GeofenceValidator.resolveCoordinates('90001');
      expect(la.city).toBe('Los Angeles');
      expect(la.state).toBe('CA');
      expect(la.lat).toBeCloseTo(33.97, 1);

      const chicago = GeofenceValidator.resolveCoordinates('60601');
      expect(chicago.city).toBe('Chicago');
      expect(chicago.state).toBe('IL');
      expect(chicago.lat).toBeCloseTo(41.88, 1);
    });

    it('validates photo captured WITHIN destination geofence (< 0.5 miles)', () => {
      // Destination: Chicago IL 60601 (lat: 41.8853, lon: -87.6216)
      // Driver captured 0.1 miles away: (41.8860, -87.6220)
      const result = GeofenceValidator.validateDeliveryLocation(
        '60601',
        41.8860,
        -87.6220,
        0.5
      );

      expect(result.isWithinGeofence).toBe(true);
      expect(result.distanceMiles).toBeLessThan(0.5);
      expect(result.flaggedWarning).toBeNull();
      expect(result.confidencePenaltyPercent).toBe(0);
    });

    it('flags warning when photo captured OUTSIDE destination geofence (> 0.5 miles)', () => {
      // Destination: Chicago IL 60601
      // Driver photo captured at O'Hare airport (~15 miles away)
      const result = GeofenceValidator.validateDeliveryLocation(
        '60601',
        41.9742,
        -87.9073,
        0.5
      );

      expect(result.isWithinGeofence).toBe(false);
      expect(result.distanceMiles).toBeGreaterThan(10);
      expect(result.flaggedWarning).toContain('outside destination geofence');
      expect(result.confidencePenaltyPercent).toBeGreaterThan(20);
    });

    it('handles missing GPS gracefully and flags warning', () => {
      const result = GeofenceValidator.validateDeliveryLocation('60601', null, null);

      expect(result.isWithinGeofence).toBe(false);
      expect(result.distanceMiles).toBeNull();
      expect(result.flaggedWarning).toContain('No GPS metadata');
    });
  });

  // ==========================================================================
  // 4. POD TOKEN ENGINE TESTS
  // ==========================================================================
  describe('PodTokenEngine', () => {
    it('generates secure crypto-random pod_sec_ tokens and stores in database', async () => {
      const podToken = await PodTokenEngine.generatePodToken({
        tenantId: TEST_TENANT_ID,
        shipmentId: TEST_SHIPMENT_ID,
        carrierCode: 'SAIA',
        driverPhone: '+1-312-555-0199',
        expiresInHours: 48,
      });

      expect(podToken.token.startsWith('pod_sec_')).toBe(true);
      expect(podToken.token.length).toBeGreaterThan(40);
      expect(podToken.isUsed).toBe(false);
      expect(new Date(podToken.expiresAt).getTime()).toBeGreaterThan(Date.now());

      const url = PodTokenEngine.buildDriverPortalUrl('https://app.apexltl.com', podToken.token);
      expect(url).toBe(`https://app.apexltl.com/pod/${podToken.token}`);
    });

    it('validates and consumes POD action token for single-use compliance', async () => {
      const podToken = await PodTokenEngine.generatePodToken({
        tenantId: TEST_TENANT_ID,
        shipmentId: TEST_SHIPMENT_ID,
      });

      // 1. Initial Validation
      const validation1 = await PodTokenEngine.validateAndConsumePodToken(podToken.token, false);
      expect(validation1.isValid).toBe(true);
      expect(validation1.isConsumed).toBe(false);

      // 2. Consume Token
      const validation2 = await PodTokenEngine.validateAndConsumePodToken(podToken.token, true);
      expect(validation2.isValid).toBe(true);
      expect(validation2.isConsumed).toBe(true);

      // 3. Subsequent use attempt should fail
      const validation3 = await PodTokenEngine.validateAndConsumePodToken(podToken.token, false);
      expect(validation3.isValid).toBe(false);
      expect(validation3.error).toContain('already used and consumed');
    });

    it('rejects invalid or missing tokens', async () => {
      const res = await PodTokenEngine.validateAndConsumePodToken('pod_sec_invalid_non_existent');
      expect(res.isValid).toBe(false);
      expect(res.error).toContain('Invalid or non-existent');
    });
  });

  // ==========================================================================
  // 5. POD COMPOSITE VALIDATOR ENGINE TESTS
  // ==========================================================================
  describe('PodValidatorEngine Composite Verification', () => {
    it('verifies clean delivery receipt with signature, geofence pass, and matching piece count', async () => {
      const cleanBillText = Buffer.from(
        'PROOF OF DELIVERY RECEIPT\n' +
        'Consignee: Apex Distribution Hub\n' +
        'Address: 4500 S Cicero Ave, Chicago IL 60601\n' +
        'Total Pieces: 4 PALLETS\n' +
        'Weight: 3,200 LBS\n' +
        'Delivered Date: 09/01/2026\n' +
        'Received in Good Order by: John Miller, Warehouse Lead\n' +
        'Signature: [AUTHORIZED SIGNATURE DETECTED]',
        'utf-8'
      );

      const result = await PodValidatorEngine.validatePod(cleanBillText, {
        tenantId: TEST_TENANT_ID,
        shipmentId: TEST_SHIPMENT_ID,
        consigneeName: 'John Miller',
        receivedPieces: 4,
        expectedPieces: 4,
        destZip: '60601',
        clientGpsLat: 41.8855,
        clientGpsLon: -87.6220,
        consigneeSignatureDataUrl: 'data:image/png;base64,' + 'A'.repeat(300),
      });

      expect(result.status).toBe('VERIFIED');
      expect(result.overallConfidence).toBeGreaterThanOrEqual(85.0);
      expect(result.signatureDetected).toBe(true);
      expect(result.pieceCountVerified).toBe(true);
      expect(result.piecesShort).toBe(0);
      expect(result.geofence.isWithinGeofence).toBe(true);
      expect(result.damageCheck.hasDamageException).toBe(false);
    });

    it('flags exception when piece count shortage is detected (3 received vs 4 expected)', async () => {
      const shortageBillText = Buffer.from(
        'DELIVERY RECEIPT\n' +
        'Destination: Chicago IL 60601\n' +
        'Expected: 4 Pallets\n' +
        'Received: 3 Pallets - 1 PLT Short on Dock\n' +
        'Signed by: Marcus Vance\n' +
        'Date: 09/01/2026',
        'utf-8'
      );

      const result = await PodValidatorEngine.validatePod(shortageBillText, {
        tenantId: TEST_TENANT_ID,
        shipmentId: TEST_SHIPMENT_ID,
        consigneeName: 'Marcus Vance',
        receivedPieces: 3, // 3 received vs 4 expected
        expectedPieces: 4,
        destZip: '60601',
        clientGpsLat: 41.8853,
        clientGpsLon: -87.6216,
      });

      expect(result.status).toBe('FLAGGED_EXCEPTION');
      expect(result.pieceCountVerified).toBe(false);
      expect(result.piecesShort).toBe(1);
      expect(result.validationFlags.some((f) => f.includes('Piece count shortage'))).toBe(true);
    });

    it('flags exception and calculates severity when damage notations are detected', async () => {
      const damagedBillText = Buffer.from(
        'DELIVERY RECEIPT\n' +
        'Destination: Dallas TX 75201\n' +
        'Total: 4 Pallets\n' +
        'DAMAGED: 1 Pallet Crushed and shrink-wrap torn, wet cartons leaking\n' +
        'Signed: Robert Hayes\n' +
        'Date: 09/01/2026',
        'utf-8'
      );

      const result = await PodValidatorEngine.validatePod(damagedBillText, {
        tenantId: TEST_TENANT_ID,
        shipmentId: TEST_SHIPMENT_ID,
        consigneeName: 'Robert Hayes',
        receivedPieces: 4,
        expectedPieces: 4,
        destZip: '75201',
        clientGpsLat: 32.7876,
        clientGpsLon: -96.7997,
        hasDamageNotation: true,
        driverNotes: '1 Pallet Crushed, carton corners smashed',
      });

      expect(result.status).toBe('FLAGGED_EXCEPTION');
      expect(result.damageCheck.hasDamageException).toBe(true);
      expect(result.damageCheck.exceptionSeverity).toBe('HIGH');
      expect(result.damageCheck.detectedKeywords).toContain('DAMAGED');
      expect(result.damageCheck.detectedKeywords).toContain('CRUSHED');
    });

    it('flags exception when delivery occurs outside destination geofence', async () => {
      const offSiteBillText = Buffer.from(
        'DELIVERY RECEIPT\n' +
        'Destination: Chicago IL 60601\n' +
        'Total: 4 Pallets\n' +
        'Signed by: Dave Clark',
        'utf-8'
      );

      const result = await PodValidatorEngine.validatePod(offSiteBillText, {
        tenantId: TEST_TENANT_ID,
        shipmentId: TEST_SHIPMENT_ID,
        consigneeName: 'Dave Clark',
        receivedPieces: 4,
        expectedPieces: 4,
        destZip: '60601',
        clientGpsLat: 41.5000, // ~26 miles away from Chicago 60601
        clientGpsLon: -87.6200,
      });

      expect(result.status).toBe('FLAGGED_EXCEPTION');
      expect(result.geofence.isWithinGeofence).toBe(false);
      expect(result.geofence.distanceMiles).toBeGreaterThan(15);
      expect(result.validationFlags.some((f) => f.includes('outside destination geofence'))).toBe(true);
    });

    it('rejects delivery with critical fraud indicators or zero verifiable traits', async () => {
      const blankCorruptedText = Buffer.from('--- BLANK CORRUPTED SCAN ---', 'utf-8');

      const result = await PodValidatorEngine.validatePod(blankCorruptedText, {
        tenantId: TEST_TENANT_ID,
        shipmentId: TEST_SHIPMENT_ID,
        consigneeName: 'Unknown',
        receivedPieces: 0,
        expectedPieces: 4,
        destZip: '60601',
        clientGpsLat: 25.7743, // In Miami FL while dest is Chicago! (1,100+ miles away)
        clientGpsLon: -80.1937,
      });

      expect(result.status).toBe('REJECTED');
      expect(result.overallConfidence).toBeLessThan(50.0);
    });
  });
});
