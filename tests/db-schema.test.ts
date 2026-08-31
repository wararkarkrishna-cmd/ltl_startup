import { describe, it, expect, beforeEach } from 'vitest';
import { generateUuidV7, isValidUuidV7, getTimestampFromUuidV7 } from '../src/lib/uuidv7';
import { FreightDatabaseClient } from '../src/db/client';
import { seedDatabase } from '../src/db/seed';
import {
  ShipmentItemSchema,
  FinancialLedgerEntrySchema,
  NMFC_CLASSES,
} from '../src/db/schema';

describe('Phase 1.1: Database Schema, Tables & DDL Constraints', () => {
  let db: FreightDatabaseClient;
  const tenantIdA = generateUuidV7();
  const tenantIdB = generateUuidV7();

  beforeEach(() => {
    db = new FreightDatabaseClient();
  });

  describe('UUIDv7 Primary Key Generator', () => {
    it('generates valid RFC 9562 UUIDv7 identifiers', () => {
      const id = generateUuidV7();
      expect(isValidUuidV7(id)).toBe(true);
      expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    });

    it('generates monotonically increasing, time-ordered IDs', () => {
      const id1 = generateUuidV7();
      const id2 = generateUuidV7();
      const id3 = generateUuidV7();

      expect(id1 < id2).toBe(true);
      expect(id2 < id3).toBe(true);

      const timestamp = getTimestampFromUuidV7(id1);
      expect(timestamp.getTime()).toBeCloseTo(Date.now(), -3);
    });
  });

  describe('Row-Level Security (RLS) & Multi-Tenancy', () => {
    it('enforces tenant context requirement on all operations', async () => {
      db.clearTenantContext();
      await expect(
        db.insertShipment({
          tenantId: tenantIdA,
          referenceNumber: 'REF-1001',
          status: 'DRAFT',
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
          totalWeightLbs: 2500,
          pickupDateReady: '2026-09-01',
        })
      ).rejects.toThrow(/Tenant context is required/i);
    });

    it('prevents cross-tenant access and isolates records (RLS Policy simulation)', async () => {
      db.setTenantContext(tenantIdA);
      const shipmentA = await db.insertShipment({
        tenantId: tenantIdA,
        referenceNumber: 'REF-TENANT-A',
        status: 'DRAFT',
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
        totalPallets: 4,
        totalWeightLbs: 4800,
        pickupDateReady: '2026-09-01',
      });

      const fetchedA = await db.getShipmentById(shipmentA.id);
      expect(fetchedA).not.toBeNull();
      expect(fetchedA?.id).toBe(shipmentA.id);

      // Switch context to Tenant B
      db.setTenantContext(tenantIdB);
      const fetchedByB = await db.getShipmentById(shipmentA.id);
      expect(fetchedByB).toBeNull();
    });
  });

  describe('DDL Constraints & Data Integrity', () => {
    it('enforces check constraint: total_weight_lbs > 0', async () => {
      db.setTenantContext(tenantIdA);
      await expect(
        db.insertShipment({
          tenantId: tenantIdA,
          referenceNumber: 'REF-INVALID-WEIGHT',
          status: 'DRAFT',
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
          totalPallets: 1,
          totalWeightLbs: 0,
          pickupDateReady: '2026-09-01',
        })
      ).rejects.toThrow(/total_weight_lbs must be > 0/i);
    });

    it('enforces check constraint: total_pallets >= 1', async () => {
      db.setTenantContext(tenantIdA);
      await expect(
        db.insertShipment({
          tenantId: tenantIdA,
          referenceNumber: 'REF-INVALID-PALLETS',
          status: 'DRAFT',
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
          totalPallets: 0,
          totalWeightLbs: 1000,
          pickupDateReady: '2026-09-01',
        })
      ).rejects.toThrow(/total_pallets must be >= 1/i);
    });

    it('validates NMFC standard freight classes via Zod schema', () => {
      expect(NMFC_CLASSES).toContain('70');
      expect(NMFC_CLASSES).toContain('92.5');
      expect(NMFC_CLASSES).toContain('500');

      const validItem = {
        id: generateUuidV7(),
        shipmentId: generateUuidV7(),
        tenantId: tenantIdA,
        quantity: 2,
        packagingType: 'PALLET' as const,
        lengthIn: 48,
        widthIn: 40,
        heightIn: 48,
        weightLbs: 1200,
        nmfcClass: '77.5' as const,
        commodityDescription: 'Industrial Valves',
        isStackable: false,
        isHazmat: false,
        createdAt: new Date(),
      };

      const parsed = ShipmentItemSchema.parse(validItem);
      expect(parsed.nmfcClass).toBe('77.5');

      expect(() => {
        ShipmentItemSchema.parse({
          ...validItem,
          nmfcClass: '99' as any,
        });
      }).toThrow();
    });

    it('validates financial double-entry ledger constraints', () => {
      const validLedgerEntry = {
        id: generateUuidV7(),
        tenantId: tenantIdA,
        transactionId: generateUuidV7(),
        accountType: 'CARRIER_PAYABLE' as const,
        entryType: 'CREDIT' as const,
        amountCents: 125000,
        currency: 'USD' as const,
        description: 'Carrier XPO linehaul settlement for load REF-1001',
        createdAt: new Date(),
      };

      const parsed = FinancialLedgerEntrySchema.parse(validLedgerEntry);
      expect(parsed.amountCents).toBe(125000);
      expect(parsed.entryType).toBe('CREDIT');

      expect(() => {
        FinancialLedgerEntrySchema.parse({
          ...validLedgerEntry,
          amountCents: -500,
        });
      }).toThrow();
    });
  });

  describe('Database Seeding', () => {
    it('seeds master accessorial dictionary and default organization', async () => {
      const seeded = await seedDatabase(db);
      expect(seeded.tenantId).toBeDefined();
      expect(db.tenants.size).toBe(1);
      expect(db.users.size).toBe(1);
      expect(db.accounts.size).toBe(1);
      expect(db.accessorials.size).toBeGreaterThanOrEqual(10);
      expect(db.accessorials.has('LG_DEL')).toBe(true);
      expect(db.accessorials.has('RES_DEL')).toBe(true);
      expect(db.accessorials.has('LIM_ACC')).toBe(true);
    });
  });
});
