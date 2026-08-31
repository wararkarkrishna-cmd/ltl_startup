import { describe, it, expect, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { AuditEngine } from '../src/lib/audit/audit-engine';
import { GET as handleAuditTrail } from '../src/app/api/shipments/[id]/audit-trail/route';
import { GET as handleAuditCert } from '../src/app/api/shipments/[id]/audit-certificate/route';
import { dbClient } from '../src/db/client';
import { generateUuidV7 } from '../src/lib/uuidv7';

describe('Phase 1.8: Immutable Audit Trail & CDC Engine', () => {
  const tenantId = 'tenant-audit-test-org';
  const shipmentId = generateUuidV7();
  const userId = generateUuidV7();

  beforeEach(() => {
    dbClient.setTenantContext(tenantId);
    dbClient.auditEvents.clear();
  });

  describe('Cryptographic Hash-Chained Audit Logging', () => {
    it('creates monotonically linked, hash-chained audit events', async () => {
      // Event 1: Initial AI extraction
      const event1 = await AuditEngine.recordEvent({
        tenantId,
        shipmentId,
        fieldName: 'status',
        oldValue: null,
        newValue: 'EXTRACTED',
        source: 'AI_EXTRACTOR',
      });

      expect(event1.prevHash).toBe(AuditEngine.GENESIS_HASH);
      expect(event1.eventHash).toHaveLength(64);

      // Event 2: Broker overrides weight
      const event2 = await AuditEngine.recordEvent({
        tenantId,
        shipmentId,
        userId,
        fieldName: 'totalWeightLbs',
        oldValue: '4000',
        newValue: '4800',
        source: 'USER_OVERRIDE',
      });

      expect(event2.prevHash).toBe(event1.eventHash); // Linked to event1

      // Event 3: Broker adds Liftgate
      const event3 = await AuditEngine.recordEvent({
        tenantId,
        shipmentId,
        userId,
        fieldName: 'accessorials',
        oldValue: '[]',
        newValue: '["LG_DEL"]',
        source: 'USER_OVERRIDE',
      });

      expect(event3.prevHash).toBe(event2.eventHash); // Linked to event2
    });

    it('verifies intact audit chain integrity successfully', async () => {
      await AuditEngine.recordEvent({
        tenantId,
        shipmentId,
        fieldName: 'status',
        oldValue: null,
        newValue: 'EXTRACTED',
        source: 'AI_EXTRACTOR',
      });

      await AuditEngine.recordEvent({
        tenantId,
        shipmentId,
        userId,
        fieldName: 'totalPallets',
        oldValue: '3',
        newValue: '4',
        source: 'USER_OVERRIDE',
      });

      const integrity = await AuditEngine.verifyChainIntegrity(tenantId, shipmentId);
      expect(integrity.isValid).toBe(true);
    });

    it('detects tampering and corrupted audit payloads immediately', async () => {
      const e1 = await AuditEngine.recordEvent({
        tenantId,
        shipmentId,
        fieldName: 'status',
        oldValue: null,
        newValue: 'EXTRACTED',
        source: 'AI_EXTRACTOR',
      });

      const e2 = await AuditEngine.recordEvent({
        tenantId,
        shipmentId,
        userId,
        fieldName: 'totalWeightLbs',
        oldValue: '4000',
        newValue: '4800',
        source: 'USER_OVERRIDE',
      });

      // Maliciously tamper with e1 payload in database
      const tamperedE1 = { ...e1, newValue: 'SETTLED_FRAUDULENT' };
      dbClient.auditEvents.set(e1.id, tamperedE1);

      const integrity = await AuditEngine.verifyChainIntegrity(tenantId, shipmentId);
      expect(integrity.isValid).toBe(false);
      expect(integrity.reason).toContain('Tampered payload detected');
    });
  });

  describe('Batch Field Diff Recording', () => {
    it('records atomic audit events for all changed fields in a single mutation', async () => {
      const originalData = {
        originZip: '90001',
        destZip: '60601',
        totalWeightLbs: 2000,
        accessorials: ['LG_DEL'],
      };

      const updatedData = {
        originZip: '90001', // unchanged
        destZip: '60611',   // changed
        totalWeightLbs: 2400,// changed
        accessorials: ['LG_DEL', 'RES_DEL'], // changed
      };

      const diffEvents = await AuditEngine.recordFieldDiffs({
        tenantId,
        shipmentId,
        userId,
        originalData,
        updatedData,
        source: 'USER_OVERRIDE',
      });

      expect(diffEvents).toHaveLength(3);
      expect(diffEvents.some((e) => e.fieldName === 'destZip')).toBe(true);
      expect(diffEvents.some((e) => e.fieldName === 'totalWeightLbs')).toBe(true);
      expect(diffEvents.some((e) => e.fieldName === 'accessorials')).toBe(true);
    });
  });

  describe('Legal Audit Certificate Generation & API', () => {
    it('generates verifiable digital audit certificate with signature', async () => {
      await AuditEngine.recordEvent({
        tenantId,
        shipmentId,
        fieldName: 'originZip',
        oldValue: null,
        newValue: '90001',
        source: 'AI_EXTRACTOR',
      });

      const cert = await AuditEngine.generateCertificate(tenantId, shipmentId);

      expect(cert.certificateId).toMatch(/^CERT-AUDIT-/);
      expect(cert.isIntegrityVerified).toBe(true);
      expect(cert.totalEventsLogged).toBe(1);
      expect(cert.digitalSignature).toHaveLength(64);
    });

    it('GET /api/shipments/[id]/audit-trail returns history', async () => {
      await AuditEngine.recordEvent({
        tenantId,
        shipmentId,
        fieldName: 'status',
        oldValue: 'DRAFT',
        newValue: 'QUOTED',
        source: 'SYSTEM',
      });

      const req = new NextRequest(`http://localhost:3000/api/shipments/${shipmentId}/audit-trail`, {
        headers: { 'x-tenant-id': tenantId },
      });

      const res = await handleAuditTrail(req, { params: { id: shipmentId } });
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.totalEvents).toBeGreaterThanOrEqual(1);
      expect(json.isChainIntact).toBe(true);
    });

    it('GET /api/shipments/[id]/audit-certificate returns signed certificate', async () => {
      await AuditEngine.recordEvent({
        tenantId,
        shipmentId,
        fieldName: 'status',
        oldValue: null,
        newValue: 'DELIVERED',
        source: 'CARRIER_EDI',
      });

      const req = new NextRequest(`http://localhost:3000/api/shipments/${shipmentId}/audit-certificate`, {
        headers: { 'x-tenant-id': tenantId },
      });

      const res = await handleAuditCert(req, { params: { id: shipmentId } });
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.certificate.digitalSignature).toBeDefined();
    });
  });
});
