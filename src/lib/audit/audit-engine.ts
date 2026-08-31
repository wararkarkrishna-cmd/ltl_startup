import crypto from 'crypto';
import { generateUuidV7 } from '../uuidv7';
import { dbClient } from '../../db/client';

export type AuditSource = 'AI_EXTRACTOR' | 'USER_OVERRIDE' | 'SYSTEM' | 'CARRIER_EDI' | 'DISPUTE_BOT';

export interface AuditEventRecord {
  id: string;
  tenantId: string;
  shipmentId: string;
  userId?: string | null;
  fieldName: string;
  oldValue: string | null;
  newValue: string;
  source: AuditSource;
  prevHash: string;
  eventHash: string;
  createdAt: Date;
}

export interface AuditCertificate {
  certificateId: string;
  shipmentId: string;
  tenantId: string;
  issuedAt: string;
  totalEventsLogged: number;
  genesisHash: string;
  latestEventHash: string;
  isIntegrityVerified: boolean;
  events: Array<{
    timestamp: string;
    field: string;
    from: string | null;
    to: string;
    source: AuditSource;
    userId?: string | null;
    eventHash: string;
  }>;
  digitalSignature: string;
}

export class AuditEngine {
  public static readonly GENESIS_HASH = '0000000000000000000000000000000000000000000000000000000000000000';

  /**
   * Calculate deterministic SHA-256 event hash
   */
  public static computeEventHash(
    tenantId: string,
    shipmentId: string,
    fieldName: string,
    oldValue: string | null,
    newValue: string,
    source: AuditSource,
    prevHash: string,
    timestamp: Date
  ): string {
    const payload = `${tenantId}|${shipmentId}|${fieldName}|${oldValue ?? ''}|${newValue}|${source}|${prevHash}|${timestamp.getTime()}`;
    return crypto.createHash('sha256').update(payload).digest('hex');
  }

  /**
   * Log an immutable, hash-chained audit event
   */
  public static async recordEvent(params: {
    tenantId: string;
    shipmentId: string;
    userId?: string | null;
    fieldName: string;
    oldValue: string | null;
    newValue: string;
    source: AuditSource;
    timestamp?: Date;
  }): Promise<AuditEventRecord> {
    const { tenantId, shipmentId, userId, fieldName, oldValue, newValue, source } = params;
    const now = params.timestamp || new Date();

    dbClient.setTenantContext(tenantId);

    // Retrieve previous audit event to link hash chain
    const history = await this.getAuditHistory(tenantId, shipmentId);
    const prevHash = history.length > 0 ? history[history.length - 1].eventHash : this.GENESIS_HASH;

    const eventHash = this.computeEventHash(
      tenantId,
      shipmentId,
      fieldName,
      oldValue,
      newValue,
      source,
      prevHash,
      now
    );

    const record: AuditEventRecord = {
      id: generateUuidV7(),
      tenantId,
      shipmentId,
      userId: userId || null,
      fieldName,
      oldValue,
      newValue,
      source,
      prevHash,
      eventHash,
      createdAt: now,
    };

    dbClient.auditEvents.set(record.id, record);
    return record;
  }

  /**
   * Record differences between original AI extraction and broker manual overrides
   */
  public static async recordFieldDiffs(params: {
    tenantId: string;
    shipmentId: string;
    userId?: string | null;
    originalData: Record<string, any>;
    updatedData: Record<string, any>;
    source?: AuditSource;
  }): Promise<AuditEventRecord[]> {
    const { tenantId, shipmentId, userId, originalData, updatedData } = params;
    const source = params.source || 'USER_OVERRIDE';
    const recordedEvents: AuditEventRecord[] = [];

    const allKeys = Array.from(new Set([...Object.keys(originalData), ...Object.keys(updatedData)]));

    for (const key of allKeys) {
      const oldValStr = originalData[key] !== undefined ? JSON.stringify(originalData[key]) : null;
      const newValStr = updatedData[key] !== undefined ? JSON.stringify(updatedData[key]) : null;

      if (oldValStr !== newValStr && newValStr !== null) {
        const event = await this.recordEvent({
          tenantId,
          shipmentId,
          userId,
          fieldName: key,
          oldValue: oldValStr,
          newValue: newValStr,
          source,
        });
        recordedEvents.push(event);
      }
    }

    return recordedEvents;
  }

  /**
   * Fetch chronological audit history for a shipment
   */
  public static async getAuditHistory(tenantId: string, shipmentId: string): Promise<AuditEventRecord[]> {
    dbClient.setTenantContext(tenantId);
    const events: AuditEventRecord[] = [];

    for (const event of dbClient.auditEvents.values()) {
      if (event.tenantId === tenantId && event.shipmentId === shipmentId) {
        events.push(event);
      }
    }

    // Sort chronologically by timestamp and UUIDv7
    return events.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  }

  /**
   * Cryptographically verify hash-chain integrity for tamper detection
   */
  public static async verifyChainIntegrity(
    tenantId: string,
    shipmentId: string
  ): Promise<{ isValid: boolean; corruptedEventId?: string; reason?: string }> {
    const history = await this.getAuditHistory(tenantId, shipmentId);
    if (history.length === 0) {
      return { isValid: true };
    }

    let expectedPrevHash = this.GENESIS_HASH;

    for (let i = 0; i < history.length; i++) {
      const event = history[i];

      // 1. Verify prevHash matches previous event
      if (event.prevHash !== expectedPrevHash) {
        return {
          isValid: false,
          corruptedEventId: event.id,
          reason: `Broken hash chain at event index ${i}: expected prevHash ${expectedPrevHash}, got ${event.prevHash}`,
        };
      }

      // 2. Recompute eventHash and verify
      const recomputedHash = this.computeEventHash(
        event.tenantId,
        event.shipmentId,
        event.fieldName,
        event.oldValue,
        event.newValue,
        event.source,
        event.prevHash,
        event.createdAt
      );

      if (recomputedHash !== event.eventHash) {
        return {
          isValid: false,
          corruptedEventId: event.id,
          reason: `Tampered payload detected at event index ${i}: recomputed hash ${recomputedHash} does not match recorded hash ${event.eventHash}`,
        };
      }

      expectedPrevHash = event.eventHash;
    }

    return { isValid: true };
  }

  /**
   * Generate an exportable Legal Audit Certificate for Carrier Dispute Packages
   */
  public static async generateCertificate(
    tenantId: string,
    shipmentId: string
  ): Promise<AuditCertificate> {
    const history = await this.getAuditHistory(tenantId, shipmentId);
    const integrity = await this.verifyChainIntegrity(tenantId, shipmentId);

    const latestHash = history.length > 0 ? history[history.length - 1].eventHash : this.GENESIS_HASH;
    const certificateId = `CERT-AUDIT-${generateUuidV7().slice(-8).toUpperCase()}`;

    // Cryptographic digital signature across the entire audit history
    const signaturePayload = `${certificateId}|${shipmentId}|${tenantId}|${latestHash}|${history.length}`;
    const digitalSignature = crypto.createHash('sha256').update(signaturePayload).digest('hex');

    return {
      certificateId,
      shipmentId,
      tenantId,
      issuedAt: new Date().toISOString(),
      totalEventsLogged: history.length,
      genesisHash: this.GENESIS_HASH,
      latestEventHash: latestHash,
      isIntegrityVerified: integrity.isValid,
      events: history.map((e) => ({
        timestamp: e.createdAt.toISOString(),
        field: e.fieldName,
        from: e.oldValue,
        to: e.newValue,
        source: e.source,
        userId: e.userId,
        eventHash: e.eventHash,
      })),
      digitalSignature,
    };
  }
}
