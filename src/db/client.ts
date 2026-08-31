import { generateUuidV7 } from '../lib/uuidv7';
import {
  Tenant,
  User,
  Account,
  Shipment,
  ShipmentItem,
  AccessorialLookup,
  FinancialLedgerEntry,
  IngestionDocument,
  CarrierCredential,
  MarginRule,
  Quote,
  CarrierTender,
  DigitalBol,
  QuoteActionToken,
} from './schema';

/**
 * In-Memory & Connection Client for Tenant-Isolated Freight Operations
 */
export class FreightDatabaseClient {
  private currentTenantId: string | null = null;

  // In-Memory Storage for Testing & Rapid Local Execution
  public tenants: Map<string, Tenant> = new Map();
  public users: Map<string, User> = new Map();
  public accounts: Map<string, Account> = new Map();
  public shipments: Map<string, Shipment> = new Map();
  public shipmentItems: Map<string, ShipmentItem> = new Map();
  public accessorials: Map<string, AccessorialLookup> = new Map();
  public ledgerEntries: Map<string, FinancialLedgerEntry> = new Map();
  public documents: Map<string, IngestionDocument> = new Map();
  public carrierCredentials: Map<string, CarrierCredential> = new Map();
  public marginRules: Map<string, MarginRule> = new Map();
  public quotes: Map<string, Quote> = new Map();
  public tenders: Map<string, CarrierTender> = new Map();
  public digitalBols: Map<string, DigitalBol> = new Map();
  public quoteActionTokens: Map<string, QuoteActionToken> = new Map();
  public auditEvents: Map<string, any> = new Map();

  constructor(tenantId?: string) {
    if (tenantId) {
      this.currentTenantId = tenantId;
    }
  }

  public setTenantContext(tenantId: string): void {
    this.currentTenantId = tenantId;
  }

  public clearTenantContext(): void {
    this.currentTenantId = null;
  }

  public getTenantContext(): string | null {
    return this.currentTenantId;
  }

  private enforceTenantCheck(tenantId: string): void {
    if (!this.currentTenantId) {
      throw new Error('Tenant context is required for database operations (RLS Enforcement)');
    }
    if (this.currentTenantId !== tenantId) {
      throw new Error(`RLS Violation: Attempted cross-tenant access (${tenantId} vs ${this.currentTenantId})`);
    }
  }

  // Shipments Operations
  public async insertShipment(
    shipment: Omit<Shipment, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<Shipment> {
    this.enforceTenantCheck(shipment.tenantId);

    // DDL Constraint Check: totalWeightLbs > 0
    if (shipment.totalWeightLbs <= 0) {
      throw new Error('DDL Constraint Violation: total_weight_lbs must be > 0');
    }

    // DDL Constraint Check: totalPallets >= 1
    if (shipment.totalPallets < 1) {
      throw new Error('DDL Constraint Violation: total_pallets must be >= 1');
    }

    const id = generateUuidV7();
    const now = new Date();
    const record: Shipment = {
      ...shipment,
      id,
      createdAt: now,
      updatedAt: now,
    };

    this.shipments.set(id, record);
    return record;
  }

  public async getShipmentById(id: string): Promise<Shipment | null> {
    const record = this.shipments.get(id);
    if (!record) return null;
    if (this.currentTenantId && record.tenantId !== this.currentTenantId) {
      return null; // Enforce RLS isolation
    }
    return record;
  }

  // Ingestion Documents Operations
  public async insertDocument(
    doc: Omit<IngestionDocument, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<IngestionDocument> {
    this.enforceTenantCheck(doc.tenantId);
    const id = generateUuidV7();
    const now = new Date();
    const record: IngestionDocument = {
      ...doc,
      id,
      createdAt: now,
      updatedAt: now,
    };
    this.documents.set(id, record);
    return record;
  }

  public async getDocumentByHash(tenantId: string, sha256Hash: string): Promise<IngestionDocument | null> {
    this.enforceTenantCheck(tenantId);
    for (const doc of this.documents.values()) {
      if (doc.tenantId === tenantId && doc.sha256Hash === sha256Hash) {
        return doc;
      }
    }
    return null;
  }

  // Carrier Credentials Operations
  public async insertCarrierCredential(
    cred: Omit<CarrierCredential, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<CarrierCredential> {
    this.enforceTenantCheck(cred.tenantId);
    const id = generateUuidV7();
    const now = new Date();
    const record: CarrierCredential = {
      ...cred,
      id,
      createdAt: now,
      updatedAt: now,
    };
    this.carrierCredentials.set(id, record);
    return record;
  }

  public async getActiveCarrierCredentials(tenantId: string): Promise<CarrierCredential[]> {
    this.enforceTenantCheck(tenantId);
    const results: CarrierCredential[] = [];
    for (const cred of this.carrierCredentials.values()) {
      if (cred.tenantId === tenantId && cred.isActive) {
        results.push(cred);
      }
    }
    return results;
  }

  // Margin Rules Operations
  public async insertMarginRule(
    rule: Omit<MarginRule, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<MarginRule> {
    this.enforceTenantCheck(rule.tenantId);
    const id = generateUuidV7();
    const now = new Date();
    const record: MarginRule = {
      ...rule,
      id,
      createdAt: now,
      updatedAt: now,
    };
    this.marginRules.set(id, record);
    return record;
  }

  public async getActiveMarginRules(tenantId: string): Promise<MarginRule[]> {
    this.enforceTenantCheck(tenantId);
    const results: MarginRule[] = [];
    for (const rule of this.marginRules.values()) {
      if (rule.tenantId === tenantId && rule.isActive) {
        results.push(rule);
      }
    }
    // Sort by priority ascending (1 = Customer Contract, 2 = Lane, 3 = Weight, 4 = Global)
    return results.sort((a, b) => a.priority - b.priority);
  }

  // Quotes Operations
  public async insertQuote(
    quote: Omit<Quote, 'id' | 'createdAt'>
  ): Promise<Quote> {
    this.enforceTenantCheck(quote.tenantId);
    const id = generateUuidV7();
    const record: Quote = {
      ...quote,
      id,
      createdAt: new Date(),
    };
    this.quotes.set(id, record);
    return record;
  }

  public async getQuotesByShipmentId(tenantId: string, shipmentId: string): Promise<Quote[]> {
    this.enforceTenantCheck(tenantId);
    const results: Quote[] = [];
    for (const quote of this.quotes.values()) {
      if (quote.tenantId === tenantId && quote.shipmentId === shipmentId) {
        results.push(quote);
      }
    }
    return results.sort((a, b) => a.quotedCustomerPriceCents - b.quotedCustomerPriceCents);
  }

  // Carrier Tender Operations
  public async insertTender(
    tender: Omit<CarrierTender, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<CarrierTender> {
    this.enforceTenantCheck(tender.tenantId);
    const id = generateUuidV7();
    const now = new Date();
    const record: CarrierTender = {
      ...tender,
      id,
      createdAt: now,
      updatedAt: now,
    };
    this.tenders.set(id, record);
    return record;
  }

  public async getTenderById(id: string): Promise<CarrierTender | null> {
    const record = this.tenders.get(id);
    if (!record) return null;
    if (this.currentTenantId && record.tenantId !== this.currentTenantId) return null;
    return record;
  }

  public async getTendersByShipmentId(tenantId: string, shipmentId: string): Promise<CarrierTender[]> {
    this.enforceTenantCheck(tenantId);
    const results: CarrierTender[] = [];
    for (const t of this.tenders.values()) {
      if (t.tenantId === tenantId && t.shipmentId === shipmentId) {
        results.push(t);
      }
    }
    return results;
  }

  // Digital BOL Operations
  public async insertDigitalBol(
    bol: Omit<DigitalBol, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<DigitalBol> {
    this.enforceTenantCheck(bol.tenantId);
    const id = generateUuidV7();
    const now = new Date();
    const record: DigitalBol = {
      ...bol,
      id,
      createdAt: now,
      updatedAt: now,
    };
    this.digitalBols.set(id, record);
    return record;
  }

  public async getDigitalBolByShipmentId(tenantId: string, shipmentId: string): Promise<DigitalBol | null> {
    this.enforceTenantCheck(tenantId);
    for (const b of this.digitalBols.values()) {
      if (b.tenantId === tenantId && b.shipmentId === shipmentId) {
        return b;
      }
    }
    return null;
  }

  // Quote Action Token Operations
  public async insertQuoteActionToken(token: QuoteActionToken): Promise<QuoteActionToken> {
    this.quoteActionTokens.set(token.token, token);
    return token;
  }

  public async getQuoteActionToken(tokenString: string): Promise<QuoteActionToken | null> {
    return this.quoteActionTokens.get(tokenString) || null;
  }

  public async markTokenUsed(tokenString: string, bookedByIp?: string, poNumber?: string): Promise<QuoteActionToken | null> {
    const record = this.quoteActionTokens.get(tokenString);
    if (!record) return null;
    record.isUsed = true;
    record.usedAt = new Date();
    record.bookedByIp = bookedByIp || null;
    record.poNumber = poNumber || null;
    this.quoteActionTokens.set(tokenString, record);
    return record;
  }
}

// Global Singleton for Local State / Mock DB
export const dbClient = new FreightDatabaseClient();
