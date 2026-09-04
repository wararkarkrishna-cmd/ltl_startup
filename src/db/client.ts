import { z } from 'zod';
import { generateUuidV7 } from '../lib/uuidv7';
import {
  Tenant,
  User,
  Account,
  Shipment,
  ShipmentItem,
  AccessorialLookup,
  FinancialLedgerEntry,
  FinancialLedgerEntrySchema,
  IngestionDocument,
  CarrierCredential,
  MarginRule,
  Quote,
  CarrierTender,
  DigitalBol,
  QuoteActionToken,
  PodToken,
  PodRecord,
  DeliveryException,
  CustomerInvoice,
  CustomerInvoiceSchema,
  AccountingConnection,
  AccountingSyncLog,
  SalesRep,
  CommissionRecord,
  DunningRecord,
  WormAuditPackage,
  CarrierInvoice,
  CarrierInvoiceSchema,
  CarrierInvoiceStatus,
  DiscrepancyRecord,
  DiscrepancyRecordSchema,
  CarrierDispute,
  CarrierDisputeSchema,
  DisputeStatus,
  RateConfirmation,
  QuickPayToken,
  QuickPayTokenSchema,
  CarrierPayout,
  CarrierPayoutSchema,
  QuickPayAgreement,
  QuickPayAgreementSchema,
  Form1099Record,
  Form1099RecordSchema,
  CarrierFraudScore,
  CarrierFraudScoreSchema,
  BankStatement,
  BankStatementSchema,
  BankStatementLine,
  BankStatementLineSchema,
  FactoringCompany,
  FactoringCompanySchema,
  CarrierNoaRecord,
  CarrierNoaRecordSchema,
  FactoringWaiver,
  FactoringWaiverSchema,
  Soc2AuditRecord,
  Soc2AuditRecordSchema,
  Truck,
  TruckSchema,
  TruckStatus,
  Driver,
  DriverSchema,
  DriverStatus,
} from './schema';
import { supabaseAdmin } from '../lib/supabase/admin';

// ============================================================================
// HELPER MAPPING FUNCTIONS (SUPABASE DB <-> TS DOMAIN)
// ============================================================================

function mapDbAccountToAccount(row: any): Account {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    name: row.name,
    accountType: row.account_type,
    mcNumber: row.mc_number,
    dotNumber: row.dot_number,
    contactName: row.contact_name,
    contactEmail: row.contact_email,
    contactPhone: row.contact_phone,
    billingAddressLine1: row.billing_address_line1,
    billingCity: row.billing_city,
    billingState: row.billing_state,
    billingZip: row.billing_zip,
    creditLimitCents: typeof row.credit_limit_cents === 'string' ? parseInt(row.credit_limit_cents, 10) : (row.credit_limit_cents ?? 1000000),
    paymentTermsDays: row.payment_terms_days ?? 30,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

function mapAccountToDb(account: Account) {
  return {
    id: account.id,
    tenant_id: account.tenantId,
    name: account.name,
    account_type: account.accountType,
    mc_number: account.mcNumber || null,
    dot_number: account.dotNumber || null,
    contact_name: account.contactName || null,
    contact_email: account.contactEmail || null,
    contact_phone: account.contactPhone || null,
    billing_address_line1: account.billingAddressLine1 || null,
    billing_city: account.billingCity || null,
    billing_state: account.billingState || null,
    billing_zip: account.billingZip || null,
    credit_limit_cents: account.creditLimitCents,
    payment_terms_days: account.paymentTermsDays,
    created_at: account.createdAt instanceof Date ? account.createdAt.toISOString() : account.createdAt,
    updated_at: account.updatedAt instanceof Date ? account.updatedAt.toISOString() : account.updatedAt,
  };
}

function mapDbShipmentToShipment(row: any): Shipment {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    shipperAccountId: row.shipper_account_id,
    referenceNumber: row.reference_number,
    status: row.status,
    originName: row.origin_name,
    originAddress1: row.origin_address1,
    originAddress2: row.origin_address2,
    originCity: row.origin_city,
    originState: row.origin_state,
    originZip: row.origin_zip,
    originCountry: row.origin_country || 'US',
    originContactName: row.origin_contact_name,
    originContactPhone: row.origin_contact_phone,
    destName: row.dest_name,
    destAddress1: row.dest_address1,
    destAddress2: row.dest_address2,
    destCity: row.dest_city,
    destState: row.dest_state,
    destZip: row.dest_zip,
    destCountry: row.dest_country || 'US',
    destContactName: row.dest_contact_name,
    destContactPhone: row.dest_contact_phone,
    totalPallets: row.total_pallets ?? 1,
    totalWeightLbs: typeof row.total_weight_lbs === 'string' ? parseFloat(row.total_weight_lbs) : row.total_weight_lbs,
    totalLinearFeet: row.total_linear_feet ? Number(row.total_linear_feet) : null,
    totalCubeCuft: row.total_cube_cuft ? Number(row.total_cube_cuft) : null,
    pickupDateReady: row.pickup_date_ready,
    pickupTimeStart: row.pickup_time_start,
    pickupTimeEnd: row.pickup_time_end,
    deliveryDateTarget: row.delivery_date_target,
    deliveryTimeStart: row.delivery_time_start,
    deliveryTimeEnd: row.delivery_time_end,
    specialInstructions: row.special_instructions,
    createdBy: row.created_by,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

function mapShipmentToDb(shipment: Shipment) {
  return {
    id: shipment.id,
    tenant_id: shipment.tenantId,
    shipper_account_id: shipment.shipperAccountId || null,
    reference_number: shipment.referenceNumber,
    status: shipment.status,
    origin_name: shipment.originName || null,
    origin_address1: shipment.originAddress1,
    origin_address2: shipment.originAddress2 || null,
    origin_city: shipment.originCity,
    origin_state: shipment.originState,
    origin_zip: shipment.originZip,
    origin_country: shipment.originCountry || 'US',
    origin_contact_name: shipment.originContactName || null,
    origin_contact_phone: shipment.originContactPhone || null,
    dest_name: shipment.destName || null,
    dest_address1: shipment.destAddress1,
    dest_address2: shipment.destAddress2 || null,
    dest_city: shipment.destCity,
    dest_state: shipment.destState,
    dest_zip: shipment.destZip,
    dest_country: shipment.destCountry || 'US',
    dest_contact_name: shipment.destContactName || null,
    dest_contact_phone: shipment.destContactPhone || null,
    total_pallets: shipment.totalPallets,
    total_weight_lbs: shipment.totalWeightLbs,
    total_linear_feet: shipment.totalLinearFeet || null,
    total_cube_cuft: shipment.totalCubeCuft || null,
    pickup_date_ready: shipment.pickupDateReady,
    pickup_time_start: shipment.pickupTimeStart || null,
    pickup_time_end: shipment.pickupTimeEnd || null,
    delivery_date_target: shipment.deliveryDateTarget || null,
    delivery_time_start: shipment.deliveryTimeStart || null,
    delivery_time_end: shipment.deliveryTimeEnd || null,
    special_instructions: shipment.specialInstructions || null,
    created_by: shipment.createdBy || null,
    created_at: shipment.createdAt instanceof Date ? shipment.createdAt.toISOString() : shipment.createdAt,
    updated_at: shipment.updatedAt instanceof Date ? shipment.updatedAt.toISOString() : shipment.updatedAt,
  };
}

function mapDbCredentialToCredential(row: any): CarrierCredential {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    carrierCode: row.carrier_code,
    carrierName: row.carrier_name || row.carrier_code,
    carrierScac: row.carrier_scac || row.carrier_code,
    accountNumber: row.account_number || '',
    accountType: row.account_type || 'DIRECT_BYOC',
    encryptedApiKey: row.encrypted_api_key || row.api_key || 'placeholder',
    encryptedPassword: row.encrypted_password || null,
    encryptedClientSecret: row.encrypted_client_secret || null,
    authTag: row.auth_tag || '00000000000000000000000000000000',
    iv: row.iv || '00000000000000000000000000000000',
    isActive: row.is_active ?? true,
    createdAt: new Date(row.created_at || Date.now()),
    updatedAt: new Date(row.updated_at || Date.now()),
  };
}

function mapCredentialToDb(cred: CarrierCredential) {
  return {
    id: cred.id,
    tenant_id: cred.tenantId,
    carrier_code: cred.carrierCode,
    carrier_name: cred.carrierName,
    carrier_scac: cred.carrierScac,
    account_number: cred.accountNumber,
    account_type: cred.accountType,
    encrypted_api_key: cred.encryptedApiKey,
    encrypted_password: cred.encryptedPassword || null,
    encrypted_client_secret: cred.encryptedClientSecret || null,
    auth_tag: cred.authTag,
    iv: cred.iv,
    is_active: cred.isActive,
    created_at: cred.createdAt instanceof Date ? cred.createdAt.toISOString() : cred.createdAt,
    updated_at: cred.updatedAt instanceof Date ? cred.updatedAt.toISOString() : cred.updatedAt,
  };
}

function mapDbTruckToTruck(row: any): Truck {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    carrierAccountId: row.carrier_account_id,
    unitNumber: row.unit_number,
    equipmentType: row.equipment_type,
    maxWeightLbs: typeof row.max_weight_lbs === 'string' ? parseInt(row.max_weight_lbs, 10) : row.max_weight_lbs,
    maxPallets: typeof row.max_pallets === 'string' ? parseInt(row.max_pallets, 10) : row.max_pallets,
    hasLiftgate: row.has_liftgate ?? false,
    status: row.status,
    currentLocationZip: row.current_location_zip,
    currentCity: row.current_city,
    currentState: row.current_state,
    assignedDriverName: row.assigned_driver_name,
    assignedDriverPhone: row.assigned_driver_phone,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

function mapTruckToDb(truck: Truck) {
  return {
    id: truck.id,
    tenant_id: truck.tenantId,
    carrier_account_id: truck.carrierAccountId || null,
    unit_number: truck.unitNumber,
    equipment_type: truck.equipmentType,
    max_weight_lbs: truck.maxWeightLbs,
    max_pallets: truck.maxPallets,
    has_liftgate: truck.hasLiftgate,
    status: truck.status,
    current_location_zip: truck.currentLocationZip || null,
    current_city: truck.currentCity || null,
    current_state: truck.currentState || null,
    assigned_driver_name: truck.assignedDriverName || null,
    assigned_driver_phone: truck.assignedDriverPhone || null,
    created_at: truck.createdAt instanceof Date ? truck.createdAt.toISOString() : truck.createdAt,
    updated_at: truck.updatedAt instanceof Date ? truck.updatedAt.toISOString() : truck.updatedAt,
  };
}

function mapDbDriverToDriver(row: any): Driver {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    carrierAccountId: row.carrier_account_id,
    truckId: row.truck_id,
    fullName: row.full_name,
    phoneNumber: row.phone_number,
    cdlNumber: row.cdl_number,
    cdlState: row.cdl_state,
    status: row.status,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

function mapDriverToDb(driver: Driver) {
  return {
    id: driver.id,
    tenant_id: driver.tenantId,
    carrier_account_id: driver.carrierAccountId || null,
    truck_id: driver.truckId || null,
    full_name: driver.fullName,
    phone_number: driver.phoneNumber,
    cdl_number: driver.cdlNumber || null,
    cdl_state: driver.cdlState || null,
    status: driver.status,
    created_at: driver.createdAt instanceof Date ? driver.createdAt.toISOString() : driver.createdAt,
    updated_at: driver.updatedAt instanceof Date ? driver.updatedAt.toISOString() : driver.updatedAt,
  };
}

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
  public rateConfirmations: Map<string, RateConfirmation> = new Map();
  public quoteActionTokens: Map<string, QuoteActionToken> = new Map();
  public podTokens: Map<string, PodToken> = new Map();
  public podRecords: Map<string, PodRecord> = new Map();
  public deliveryExceptions: Map<string, DeliveryException> = new Map();
  public customerInvoices: Map<string, CustomerInvoice> = new Map();
  public accountingConnections: Map<string, AccountingConnection> = new Map();
  public accountingSyncLogs: Map<string, AccountingSyncLog> = new Map();
  public salesReps: Map<string, SalesRep> = new Map();
  public commissionRecords: Map<string, CommissionRecord> = new Map();
  public dunningRecords: Map<string, DunningRecord> = new Map();
  public wormAuditPackages: Map<string, WormAuditPackage> = new Map();
  public carrierInvoices: Map<string, CarrierInvoice> = new Map();
  public discrepancyRecords: Map<string, DiscrepancyRecord> = new Map();
  public carrierDisputes: Map<string, CarrierDispute> = new Map();
  public quickpayTokens: Map<string, QuickPayToken> = new Map();
  public carrierPayouts: Map<string, CarrierPayout> = new Map();
  public quickpayAgreements: Map<string, QuickPayAgreement> = new Map();
  public form1099Records: Map<string, Form1099Record> = new Map();
  public carrierFraudScores: Map<string, CarrierFraudScore> = new Map();
  public bankStatements: Map<string, BankStatement> = new Map();
  public bankStatementLines: Map<string, BankStatementLine> = new Map();
  public factoringCompanies: Map<string, FactoringCompany> = new Map();
  public carrierNoaRecords: Map<string, CarrierNoaRecord> = new Map();
  public factoringWaivers: Map<string, FactoringWaiver> = new Map();
  public soc2AuditLogs: Map<string, Soc2AuditRecord> = new Map();
  public trucks: Map<string, Truck> = new Map();
  public drivers: Map<string, Driver> = new Map();
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

  // Accounts Operations
  public async insertAccount(
    account: Omit<Account, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }
  ): Promise<Account> {
    this.enforceTenantCheck(account.tenantId);
    const id = account.id || generateUuidV7();
    const now = new Date();
    const record: Account = {
      ...account,
      id,
      createdAt: now,
      updatedAt: now,
    };
    this.accounts.set(id, record);

    try {
      await supabaseAdmin.from('accounts').upsert(mapAccountToDb(record));
    } catch (err: any) {
      console.warn('[FreightDatabaseClient] Supabase insert account warning:', err.message);
    }

    return record;
  }

  public async getAccountById(id: string): Promise<Account | null> {
    const record = this.accounts.get(id);
    if (record) {
      if (this.currentTenantId && record.tenantId !== this.currentTenantId) {
        return null;
      }
      return record;
    }

    try {
      const { data, error } = await supabaseAdmin.from('accounts').select('*').eq('id', id).maybeSingle();
      if (!error && data) {
        const acc = mapDbAccountToAccount(data);
        if (this.currentTenantId && acc.tenantId !== this.currentTenantId) {
          return null;
        }
        this.accounts.set(acc.id, acc);
        return acc;
      }
    } catch (err: any) {
      console.warn('[FreightDatabaseClient] Supabase fetch account by ID warning:', err.message);
    }

    return null;
  }

  public async getAccounts(tenantId?: string): Promise<Account[]> {
    const effectiveTenantId = tenantId || this.currentTenantId || undefined;
    if (effectiveTenantId) {
      this.enforceTenantCheck(effectiveTenantId);
    }

    try {
      let query = supabaseAdmin.from('accounts').select('*');
      if (effectiveTenantId) {
        query = query.eq('tenant_id', effectiveTenantId);
      }
      const { data, error } = await query;
      if (!error && data) {
        const accountsFromDb = data.map(mapDbAccountToAccount);
        for (const acc of accountsFromDb) {
          this.accounts.set(acc.id, acc);
        }
        return accountsFromDb;
      }
    } catch (err: any) {
      console.warn('[FreightDatabaseClient] Supabase fetch accounts warning:', err.message);
    }

    const results: Account[] = [];
    for (const acc of this.accounts.values()) {
      if (!effectiveTenantId || acc.tenantId === effectiveTenantId) {
        results.push(acc);
      }
    }
    return results;
  }

  // Shipments Operations
  public async insertShipment(
    shipment: Omit<Shipment, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }
  ): Promise<Shipment> {
    this.enforceTenantCheck(shipment.tenantId);

    // DDL Constraint Check: totalWeightLbs > 0
    if (shipment.totalWeightLbs <= 0) {
      throw new Error('DDL Constraint Violation: total_weight_lbs must be > 0');
    }

    // DDL Constraint Check: totalPallets >= 1
    if (shipment.totalPallets !== undefined && shipment.totalPallets < 1) {
      throw new Error('DDL Constraint Violation: total_pallets must be >= 1');
    }

    const id = shipment.id || generateUuidV7();
    const now = new Date();
    const record: Shipment = {
      ...shipment,
      totalPallets: shipment.totalPallets ?? ((shipment as any).handlingUnits || 1),
      id,
      createdAt: now,
      updatedAt: now,
    };

    this.shipments.set(id, record);

    try {
      await supabaseAdmin.from('shipments').upsert(mapShipmentToDb(record));
    } catch (err: any) {
      console.warn('[FreightDatabaseClient] Supabase insert shipment warning:', err.message);
    }

    return record;
  }

  public async getShipmentById(id: string): Promise<Shipment | null> {
    const record = this.shipments.get(id);
    if (record) {
      if (this.currentTenantId && record.tenantId !== this.currentTenantId) {
        return null;
      }
      return record;
    }

    try {
      const { data, error } = await supabaseAdmin.from('shipments').select('*').eq('id', id).maybeSingle();
      if (!error && data) {
        const shp = mapDbShipmentToShipment(data);
        if (this.currentTenantId && shp.tenantId !== this.currentTenantId) {
          return null;
        }
        this.shipments.set(shp.id, shp);
        return shp;
      }
    } catch (err: any) {
      console.warn('[FreightDatabaseClient] Supabase fetch shipment by ID warning:', err.message);
    }

    return null;
  }

  public async getShipments(tenantId?: string): Promise<Shipment[]> {
    const effectiveTenantId = tenantId || this.currentTenantId || undefined;
    if (effectiveTenantId) {
      this.enforceTenantCheck(effectiveTenantId);
    }

    try {
      let query = supabaseAdmin.from('shipments').select('*');
      if (effectiveTenantId) {
        query = query.eq('tenant_id', effectiveTenantId);
      }
      const { data, error } = await query;
      if (!error && data) {
        const shipmentsFromDb = data.map(mapDbShipmentToShipment);
        for (const s of shipmentsFromDb) {
          this.shipments.set(s.id, s);
        }
        return shipmentsFromDb.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      }
    } catch (err: any) {
      console.warn('[FreightDatabaseClient] Supabase fetch shipments warning:', err.message);
    }

    const results: Shipment[] = [];
    for (const s of this.shipments.values()) {
      if (!effectiveTenantId || s.tenantId === effectiveTenantId) {
        results.push(s);
      }
    }
    return results.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  public async getShipmentsByTenant(tenantId: string): Promise<Shipment[]> {
    return this.getShipments(tenantId);
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
    cred: Omit<CarrierCredential, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }
  ): Promise<CarrierCredential> {
    this.enforceTenantCheck(cred.tenantId);
    const id = cred.id || generateUuidV7();
    const now = new Date();
    const record: CarrierCredential = {
      ...cred,
      id,
      createdAt: now,
      updatedAt: now,
    };
    this.carrierCredentials.set(id, record);

    try {
      await supabaseAdmin.from('carrier_credentials').upsert(mapCredentialToDb(record));
    } catch (err: any) {
      console.warn('[FreightDatabaseClient] Supabase insert carrier_credentials warning:', err.message);
    }

    return record;
  }

  public async getCarrierCredentials(tenantId?: string): Promise<CarrierCredential[]> {
    const effectiveTenantId = tenantId || this.currentTenantId || undefined;
    if (effectiveTenantId) {
      this.enforceTenantCheck(effectiveTenantId);
    }

    try {
      let query = supabaseAdmin.from('carrier_credentials').select('*');
      if (effectiveTenantId) {
        query = query.eq('tenant_id', effectiveTenantId);
      }
      const { data, error } = await query;
      if (!error && data) {
        const credsFromDb = data.map(mapDbCredentialToCredential);
        for (const c of credsFromDb) {
          this.carrierCredentials.set(c.id, c);
        }
        return credsFromDb;
      }
    } catch (err: any) {
      console.warn('[FreightDatabaseClient] Supabase fetch carrier credentials warning:', err.message);
    }

    const results: CarrierCredential[] = [];
    for (const cred of this.carrierCredentials.values()) {
      if (!effectiveTenantId || cred.tenantId === effectiveTenantId) {
        results.push(cred);
      }
    }
    return results;
  }

  public async getActiveCarrierCredentials(tenantId: string): Promise<CarrierCredential[]> {
    const creds = await this.getCarrierCredentials(tenantId);
    return creds.filter((c) => c.isActive);
  }

  // Fleet Trucks Operations
  public async insertTruck(
    truck: Omit<Truck, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }
  ): Promise<Truck> {
    this.enforceTenantCheck(truck.tenantId);
    const id = truck.id || generateUuidV7();
    const now = new Date();
    const record: Truck = {
      ...truck,
      maxWeightLbs: truck.maxWeightLbs ?? 45000,
      maxPallets: truck.maxPallets ?? 26,
      hasLiftgate: truck.hasLiftgate ?? false,
      status: truck.status ?? 'AVAILABLE',
      id,
      createdAt: now,
      updatedAt: now,
    };

    this.trucks.set(id, record);

    try {
      await supabaseAdmin.from('trucks').upsert(mapTruckToDb(record));
    } catch (err: any) {
      console.warn('[FreightDatabaseClient] Supabase insert truck warning:', err.message);
    }

    return record;
  }

  public async getTrucks(tenantId?: string): Promise<Truck[]> {
    const effectiveTenantId = tenantId || this.currentTenantId || undefined;
    if (effectiveTenantId) {
      this.enforceTenantCheck(effectiveTenantId);
    }

    try {
      let query = supabaseAdmin.from('trucks').select('*');
      if (effectiveTenantId) {
        query = query.eq('tenant_id', effectiveTenantId);
      }
      const { data, error } = await query;
      if (!error && data) {
        const trucksFromDb = data.map(mapDbTruckToTruck);
        for (const t of trucksFromDb) {
          this.trucks.set(t.id, t);
        }
        return trucksFromDb;
      }
    } catch (err: any) {
      console.warn('[FreightDatabaseClient] Supabase fetch trucks warning:', err.message);
    }

    const results: Truck[] = [];
    for (const t of this.trucks.values()) {
      if (!effectiveTenantId || t.tenantId === effectiveTenantId) {
        results.push(t);
      }
    }
    return results;
  }

  public async updateTruckStatus(
    truckId: string,
    status: TruckStatus,
    location?: { city?: string; state?: string; zip?: string }
  ): Promise<Truck | null> {
    const truck = this.trucks.get(truckId);
    if (truck) {
      truck.status = status;
      if (location?.city) truck.currentCity = location.city;
      if (location?.state) truck.currentState = location.state;
      if (location?.zip) truck.currentLocationZip = location.zip;
      truck.updatedAt = new Date();
      this.trucks.set(truckId, truck);
    }

    try {
      const updatePayload: any = {
        status,
        updated_at: new Date().toISOString(),
      };
      if (location?.city) updatePayload.current_city = location.city;
      if (location?.state) updatePayload.current_state = location.state;
      if (location?.zip) updatePayload.current_location_zip = location.zip;

      const { data, error } = await supabaseAdmin
        .from('trucks')
        .update(updatePayload)
        .eq('id', truckId)
        .select('*')
        .maybeSingle();

      if (!error && data) {
        const updatedTruck = mapDbTruckToTruck(data);
        this.trucks.set(truckId, updatedTruck);
        return updatedTruck;
      }
    } catch (err: any) {
      console.warn('[FreightDatabaseClient] Supabase update truck status warning:', err.message);
    }

    return truck || null;
  }

  // Fleet Drivers Operations
  public async insertDriver(
    driver: Omit<Driver, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }
  ): Promise<Driver> {
    this.enforceTenantCheck(driver.tenantId);
    const id = driver.id || generateUuidV7();
    const now = new Date();
    const record: Driver = {
      ...driver,
      status: driver.status ?? 'ACTIVE',
      id,
      createdAt: now,
      updatedAt: now,
    };

    this.drivers.set(id, record);

    try {
      await supabaseAdmin.from('drivers').upsert(mapDriverToDb(record));
    } catch (err: any) {
      console.warn('[FreightDatabaseClient] Supabase insert driver warning:', err.message);
    }

    return record;
  }

  public async getDrivers(tenantId?: string): Promise<Driver[]> {
    const effectiveTenantId = tenantId || this.currentTenantId || undefined;
    if (effectiveTenantId) {
      this.enforceTenantCheck(effectiveTenantId);
    }

    try {
      let query = supabaseAdmin.from('drivers').select('*');
      if (effectiveTenantId) {
        query = query.eq('tenant_id', effectiveTenantId);
      }
      const { data, error } = await query;
      if (!error && data) {
        const driversFromDb = data.map(mapDbDriverToDriver);
        for (const d of driversFromDb) {
          this.drivers.set(d.id, d);
        }
        return driversFromDb;
      }
    } catch (err: any) {
      console.warn('[FreightDatabaseClient] Supabase fetch drivers warning:', err.message);
    }

    const results: Driver[] = [];
    for (const d of this.drivers.values()) {
      if (!effectiveTenantId || d.tenantId === effectiveTenantId) {
        results.push(d);
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

  // Rate Confirmation Operations
  public async insertRateConfirmation(
    rc: Omit<RateConfirmation, 'id' | 'createdAt'>
  ): Promise<RateConfirmation> {
    this.enforceTenantCheck(rc.tenantId);
    const id = generateUuidV7();
    const now = new Date();
    const record: RateConfirmation = {
      ...rc,
      id,
      createdAt: now,
    };
    this.rateConfirmations.set(id, record);
    return record;
  }

  public async getRateConfirmationById(id: string): Promise<RateConfirmation | null> {
    const record = this.rateConfirmations.get(id);
    if (!record) return null;
    if (this.currentTenantId && record.tenantId !== this.currentTenantId) return null;
    return record;
  }

  public async getRateConfirmationByShipmentId(tenantId: string, shipmentId: string): Promise<RateConfirmation | null> {
    this.enforceTenantCheck(tenantId);
    for (const rc of this.rateConfirmations.values()) {
      if (rc.tenantId === tenantId && rc.shipmentId === shipmentId) {
        return rc;
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

  // Phase 4.1: POD Tokens Operations
  public async insertPodToken(token: PodToken): Promise<PodToken> {
    this.podTokens.set(token.token, token);
    return token;
  }

  public async getPodToken(tokenString: string): Promise<PodToken | null> {
    return this.podTokens.get(tokenString) || null;
  }

  public async markPodTokenUsed(tokenString: string): Promise<PodToken | null> {
    const record = this.podTokens.get(tokenString);
    if (!record) return null;
    record.isUsed = true;
    record.usedAt = new Date();
    this.podTokens.set(tokenString, record);
    return record;
  }

  // Phase 4.2 & 4.3: POD Records Operations
  public async insertPodRecord(
    record: Partial<PodRecord> & Pick<PodRecord, 'tenantId' | 'shipmentId' | 'imageUrl' | 'imageHash' | 'fileSizeBytes' | 'consigneeName' | 'receivedPieces' | 'expectedPieces'>
  ): Promise<PodRecord> {
    this.enforceTenantCheck(record.tenantId);
    const id = generateUuidV7();
    const now = new Date();
    const pod: PodRecord = {
      imageOrientation: 1,
      ocrConfidence: 90.0,
      status: 'VERIFIED',
      isWithinGeofence: true,
      signatureDetected: false,
      pieceCountVerified: true,
      stampedDateDetected: false,
      hasDamageException: false,
      detectedExceptionKeywords: [],
      exceptionSeverity: 'NONE',
      claimsAlertSent: false,
      overallConfidence: 95.0,
      submittedAt: now,
      ...record,
      id,
      createdAt: now,
      updatedAt: now,
    };
    this.podRecords.set(id, pod);
    return pod;
  }

  public async getPodRecordById(id: string): Promise<PodRecord | null> {
    const record = this.podRecords.get(id);
    if (!record) return null;
    if (this.currentTenantId && record.tenantId !== this.currentTenantId) return null;
    return record;
  }

  public async getPodRecordByShipmentId(tenantId: string, shipmentId: string): Promise<PodRecord | null> {
    this.enforceTenantCheck(tenantId);
    for (const pod of this.podRecords.values()) {
      if (pod.tenantId === tenantId && pod.shipmentId === shipmentId) {
        return pod;
      }
    }
    return null;
  }

  public async getPodRecords(tenantId: string): Promise<PodRecord[]> {
    this.enforceTenantCheck(tenantId);
    const results: PodRecord[] = [];
    for (const pod of this.podRecords.values()) {
      if (pod.tenantId === tenantId) {
        results.push(pod);
      }
    }
    return results.sort((a, b) => b.submittedAt.getTime() - a.submittedAt.getTime());
  }

  // Phase 4.3: Delivery Exceptions Operations
  public async insertDeliveryException(
    exc: Omit<DeliveryException, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<DeliveryException> {
    this.enforceTenantCheck(exc.tenantId);
    const id = generateUuidV7();
    const now = new Date();
    const record: DeliveryException = {
      ...exc,
      id,
      createdAt: now,
      updatedAt: now,
    };
    this.deliveryExceptions.set(id, record);
    return record;
  }

  public async getExceptionsByShipmentId(tenantId: string, shipmentId: string): Promise<DeliveryException[]> {
    this.enforceTenantCheck(tenantId);
    const results: DeliveryException[] = [];
    for (const exc of this.deliveryExceptions.values()) {
      if (exc.tenantId === tenantId && exc.shipmentId === shipmentId) {
        results.push(exc);
      }
    }
    return results;
  }

  public async getDeliveryExceptions(tenantId: string): Promise<DeliveryException[]> {
    this.enforceTenantCheck(tenantId);
    const results: DeliveryException[] = [];
    for (const exc of this.deliveryExceptions.values()) {
      if (exc.tenantId === tenantId) {
        results.push(exc);
      }
    }
    return results.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  // Phase 4.4: Customer Invoices Operations
  public async insertCustomerInvoice(
    inv: Omit<z.input<typeof CustomerInvoiceSchema>, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<CustomerInvoice> {
    this.enforceTenantCheck(inv.tenantId);
    const parsed = CustomerInvoiceSchema.parse({
      ...inv,
      id: generateUuidV7(),
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    this.customerInvoices.set(parsed.id, parsed);
    return parsed;
  }

  public async getCustomerInvoiceById(id: string): Promise<CustomerInvoice | null> {
    const record = this.customerInvoices.get(id);
    if (!record) return null;
    if (this.currentTenantId && record.tenantId !== this.currentTenantId) return null;
    return record;
  }

  public async getCustomerInvoiceByShipmentId(tenantId: string, shipmentId: string): Promise<CustomerInvoice | null> {
    this.enforceTenantCheck(tenantId);
    for (const inv of this.customerInvoices.values()) {
      if (inv.tenantId === tenantId && inv.shipmentId === shipmentId) {
        return inv;
      }
    }
    return null;
  }

  public async getCustomerInvoices(tenantId: string): Promise<CustomerInvoice[]> {
    this.enforceTenantCheck(tenantId);
    const results: CustomerInvoice[] = [];
    for (const inv of this.customerInvoices.values()) {
      if (inv.tenantId === tenantId) {
        results.push(inv);
      }
    }
    return results.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  public async getCustomerInvoicesByParentId(tenantId: string, parentInvoiceId: string): Promise<CustomerInvoice[]> {
    this.enforceTenantCheck(tenantId);
    const results: CustomerInvoice[] = [];
    for (const inv of this.customerInvoices.values()) {
      if (inv.tenantId === tenantId && inv.parentInvoiceId === parentInvoiceId) {
        results.push(inv);
      }
    }
    return results.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  public async updateCustomerInvoice(
    id: string,
    updates: Partial<Omit<CustomerInvoice, 'id' | 'tenantId' | 'createdAt'>>
  ): Promise<CustomerInvoice | null> {
    const existing = this.customerInvoices.get(id);
    if (!existing) return null;
    this.enforceTenantCheck(existing.tenantId);
    const updated: CustomerInvoice = {
      ...existing,
      ...updates,
      updatedAt: new Date(),
    };
    this.customerInvoices.set(id, updated);
    return updated;
  }

  // Phase 4.5: Accounting Connections & Sync Logs
  public async insertAccountingConnection(
    conn: Omit<AccountingConnection, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<AccountingConnection> {
    this.enforceTenantCheck(conn.tenantId);
    const id = generateUuidV7();
    const now = new Date();
    const record: AccountingConnection = {
      ...conn,
      id,
      createdAt: now,
      updatedAt: now,
    };
    this.accountingConnections.set(id, record);
    return record;
  }

  public async getAccountingConnection(tenantId: string, platform?: string): Promise<AccountingConnection | null> {
    this.enforceTenantCheck(tenantId);
    for (const conn of this.accountingConnections.values()) {
      if (conn.tenantId === tenantId && (!platform || conn.platform === platform) && conn.isActive) {
        return conn;
      }
    }
    return null;
  }

  public async insertAccountingSyncLog(
    log: Omit<AccountingSyncLog, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<AccountingSyncLog> {
    this.enforceTenantCheck(log.tenantId);
    const id = generateUuidV7();
    const now = new Date();
    const record: AccountingSyncLog = {
      ...log,
      id,
      createdAt: now,
      updatedAt: now,
    };
    this.accountingSyncLogs.set(id, record);
    return record;
  }

  public async getAccountingSyncLogsByTenant(tenantId: string): Promise<AccountingSyncLog[]> {
    this.enforceTenantCheck(tenantId);
    const results: AccountingSyncLog[] = [];
    for (const log of this.accountingSyncLogs.values()) {
      if (log.tenantId === tenantId) {
        results.push(log);
      }
    }
    return results.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  // Phase 4.6: Sales Reps & Commission Records
  public async insertSalesRep(
    rep: Omit<SalesRep, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<SalesRep> {
    this.enforceTenantCheck(rep.tenantId);
    const id = generateUuidV7();
    const now = new Date();
    const record: SalesRep = {
      ...rep,
      id,
      createdAt: now,
      updatedAt: now,
    };
    this.salesReps.set(id, record);
    return record;
  }

  public async getSalesRepById(id: string): Promise<SalesRep | null> {
    return this.salesReps.get(id) || null;
  }

  public async getSalesReps(tenantId: string): Promise<SalesRep[]> {
    this.enforceTenantCheck(tenantId);
    const results: SalesRep[] = [];
    for (const rep of this.salesReps.values()) {
      if (rep.tenantId === tenantId) {
        results.push(rep);
      }
    }
    return results;
  }

  public async insertCommissionRecord(
    record: Omit<CommissionRecord, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<CommissionRecord> {
    this.enforceTenantCheck(record.tenantId);
    const id = generateUuidV7();
    const now = new Date();
    const comm: CommissionRecord = {
      ...record,
      id,
      createdAt: now,
      updatedAt: now,
    };
    this.commissionRecords.set(id, comm);
    return comm;
  }

  public async getCommissionRecordsByTenant(tenantId: string): Promise<CommissionRecord[]> {
    this.enforceTenantCheck(tenantId);
    const results: CommissionRecord[] = [];
    for (const comm of this.commissionRecords.values()) {
      if (comm.tenantId === tenantId) {
        results.push(comm);
      }
    }
    return results.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  public async getCommissionRecordsByRep(tenantId: string, salesRepId: string): Promise<CommissionRecord[]> {
    this.enforceTenantCheck(tenantId);
    const results: CommissionRecord[] = [];
    for (const comm of this.commissionRecords.values()) {
      if (comm.tenantId === tenantId && comm.salesRepId === salesRepId) {
        results.push(comm);
      }
    }
    return results.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  // Phase 4.7: Dunning Records
  public async insertDunningRecord(
    record: Omit<DunningRecord, 'id' | 'createdAt'>
  ): Promise<DunningRecord> {
    this.enforceTenantCheck(record.tenantId);
    const id = generateUuidV7();
    const now = new Date();
    const dunning: DunningRecord = {
      ...record,
      id,
      createdAt: now,
    };
    this.dunningRecords.set(id, dunning);
    return dunning;
  }

  public async getDunningRecordsByTenant(tenantId: string): Promise<DunningRecord[]> {
    this.enforceTenantCheck(tenantId);
    const results: DunningRecord[] = [];
    for (const d of this.dunningRecords.values()) {
      if (d.tenantId === tenantId) {
        results.push(d);
      }
    }
    return results.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  public async getDunningRecordsByInvoice(tenantId: string, invoiceId: string): Promise<DunningRecord[]> {
    this.enforceTenantCheck(tenantId);
    const results: DunningRecord[] = [];
    for (const d of this.dunningRecords.values()) {
      if (d.tenantId === tenantId && d.invoiceId === invoiceId) {
        results.push(d);
      }
    }
    return results.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  // Phase 4.8: S3 WORM Audit Packages
  public async insertWormAuditPackage(
    pkg: Omit<WormAuditPackage, 'id' | 'createdAt'>
  ): Promise<WormAuditPackage> {
    this.enforceTenantCheck(pkg.tenantId);
    const id = generateUuidV7();
    const now = new Date();
    const worm: WormAuditPackage = {
      ...pkg,
      id,
      createdAt: now,
    };
    this.wormAuditPackages.set(id, worm);
    return worm;
  }

  public async getWormAuditPackageByShipmentId(tenantId: string, shipmentId: string): Promise<WormAuditPackage | null> {
    this.enforceTenantCheck(tenantId);
    for (const pkg of this.wormAuditPackages.values()) {
      if (pkg.tenantId === tenantId && pkg.shipmentId === shipmentId) {
        return pkg;
      }
    }
    return null;
  }

  public async getWormAuditPackagesByTenant(tenantId: string): Promise<WormAuditPackage[]> {
    this.enforceTenantCheck(tenantId);
    const results: WormAuditPackage[] = [];
    for (const pkg of this.wormAuditPackages.values()) {
      if (pkg.tenantId === tenantId) {
        results.push(pkg);
      }
    }
    return results.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  // ============================================================================
  // PHASE 5.1: CARRIER INVOICES, DISCREPANCIES & DISPUTES
  // ============================================================================

  public async insertCarrierInvoice(
    invoice: Omit<z.input<typeof CarrierInvoiceSchema>, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<CarrierInvoice> {
    this.enforceTenantCheck(invoice.tenantId);
    const linehaul =
      invoice.invoicedLinehaulCents ?? invoice.billedLinehaulCents ?? invoice.linehaulBilledCents ?? 0;
    const fuel =
      invoice.invoicedFuelCents ?? invoice.billedFuelCents ?? invoice.fuelBilledCents ?? 0;
    const accessorial =
      invoice.invoicedAccessorialCents ?? invoice.billedAccessorialCents ?? invoice.accessorialsBilledCents ?? 0;
    const total =
      invoice.invoicedTotalCents ?? invoice.totalBilledCents ?? (linehaul + fuel + accessorial);

    const parsed = CarrierInvoiceSchema.parse({
      ...invoice,
      invoicedLinehaulCents: linehaul,
      invoicedFuelCents: fuel,
      invoicedAccessorialCents: accessorial,
      invoicedTotalCents: total,
      totalBilledCents: total,
      billedLinehaulCents: linehaul,
      billedFuelCents: fuel,
      billedAccessorialCents: accessorial,
      carrierInvoiceNumber: invoice.carrierInvoiceNumber || invoice.invoiceNumber || 'INV-UNKNOWN',
      invoiceNumber: invoice.invoiceNumber || invoice.carrierInvoiceNumber || 'INV-UNKNOWN',
      id: generateUuidV7(),
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    this.carrierInvoices.set(parsed.id, parsed);
    return parsed;
  }

  public async getCarrierInvoiceById(id: string): Promise<CarrierInvoice | null> {
    const record = this.carrierInvoices.get(id);
    if (!record) return null;
    if (this.currentTenantId && record.tenantId !== this.currentTenantId) {
      return null;
    }
    return record;
  }

  public async getCarrierInvoicesByTenant(tenantId: string): Promise<CarrierInvoice[]> {
    this.enforceTenantCheck(tenantId);
    const results: CarrierInvoice[] = [];
    for (const inv of this.carrierInvoices.values()) {
      if (inv.tenantId === tenantId) {
        results.push(inv);
      }
    }
    return results.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  public async getCarrierInvoices(tenantId: string, status?: CarrierInvoiceStatus): Promise<CarrierInvoice[]> {
    this.enforceTenantCheck(tenantId);
    const results: CarrierInvoice[] = [];
    for (const inv of this.carrierInvoices.values()) {
      if (inv.tenantId === tenantId && (!status || inv.status === status)) {
        results.push(inv);
      }
    }
    return results.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  public async getCarrierInvoicesByShipment(tenantId: string, shipmentId: string): Promise<CarrierInvoice[]> {
    this.enforceTenantCheck(tenantId);
    const results: CarrierInvoice[] = [];
    for (const inv of this.carrierInvoices.values()) {
      if (inv.tenantId === tenantId && inv.shipmentId === shipmentId) {
        results.push(inv);
      }
    }
    return results.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  public async updateCarrierInvoice(
    id: string,
    updates: Partial<Omit<CarrierInvoice, 'id' | 'tenantId' | 'createdAt'>>
  ): Promise<CarrierInvoice | null> {
    const existing = this.carrierInvoices.get(id);
    if (!existing) return null;
    this.enforceTenantCheck(existing.tenantId);
    const updated: CarrierInvoice = {
      ...existing,
      ...updates,
      updatedAt: new Date(),
    };
    this.carrierInvoices.set(id, updated);
    return updated;
  }

  public async insertDiscrepancyRecord(
    record: Omit<z.input<typeof DiscrepancyRecordSchema>, 'id' | 'createdAt'>
  ): Promise<DiscrepancyRecord> {
    this.enforceTenantCheck(record.tenantId);
    const deltaTotal =
      record.deltaTotalCents ?? record.varianceCents ?? record.disputableAmountCents ?? 0;
    const quoted =
      record.quotedExpectedRateCents ?? record.quotedCents ?? 0;
    const billed =
      record.carrierInvoicedRateCents ?? record.billedCents ?? 0;

    const parsed = DiscrepancyRecordSchema.parse({
      ...record,
      deltaTotalCents: deltaTotal,
      varianceCents: record.varianceCents ?? deltaTotal,
      disputableAmountCents: record.disputableAmountCents ?? deltaTotal,
      quotedExpectedRateCents: quoted,
      quotedCents: record.quotedCents ?? quoted,
      carrierInvoicedRateCents: billed,
      billedCents: record.billedCents ?? billed,
      id: generateUuidV7(),
      createdAt: new Date(),
    });
    this.discrepancyRecords.set(parsed.id, parsed);
    return parsed;
  }

  public async getDiscrepancyById(id: string): Promise<DiscrepancyRecord | null> {
    const record = this.discrepancyRecords.get(id);
    if (!record) return null;
    if (this.currentTenantId && record.tenantId !== this.currentTenantId) {
      return null;
    }
    return record;
  }

  public async getDiscrepancyRecordById(id: string): Promise<DiscrepancyRecord | null> {
    return this.getDiscrepancyById(id);
  }

  public async getDiscrepanciesByInvoiceId(tenantId: string, invoiceId: string): Promise<DiscrepancyRecord[]> {
    this.enforceTenantCheck(tenantId);
    const results: DiscrepancyRecord[] = [];
    for (const disc of this.discrepancyRecords.values()) {
      if (disc.tenantId === tenantId && disc.carrierInvoiceId === invoiceId) {
        results.push(disc);
      }
    }
    return results.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  public async getDiscrepanciesByCarrierInvoice(tenantId: string, carrierInvoiceId: string): Promise<DiscrepancyRecord[]> {
    return this.getDiscrepanciesByInvoiceId(tenantId, carrierInvoiceId);
  }

  public async getDiscrepanciesByShipment(tenantId: string, shipmentId: string): Promise<DiscrepancyRecord[]> {
    this.enforceTenantCheck(tenantId);
    const results: DiscrepancyRecord[] = [];
    for (const disc of this.discrepancyRecords.values()) {
      if (disc.tenantId === tenantId && disc.shipmentId === shipmentId) {
        results.push(disc);
      }
    }
    return results.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  public async getDiscrepancyRecords(tenantId: string): Promise<DiscrepancyRecord[]> {
    this.enforceTenantCheck(tenantId);
    const results: DiscrepancyRecord[] = [];
    for (const disc of this.discrepancyRecords.values()) {
      if (disc.tenantId === tenantId) {
        results.push(disc);
      }
    }
    return results.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  public async updateDiscrepancyRecord(
    id: string,
    updates: Partial<Omit<DiscrepancyRecord, 'id' | 'tenantId' | 'createdAt'>>
  ): Promise<DiscrepancyRecord | null> {
    const existing = this.discrepancyRecords.get(id);
    if (!existing) return null;
    this.enforceTenantCheck(existing.tenantId);
    const updated: DiscrepancyRecord = {
      ...existing,
      ...updates,
      updatedAt: new Date(),
    };
    this.discrepancyRecords.set(id, updated);
    return updated;
  }

  public async insertCarrierDispute(
    dispute: Omit<z.input<typeof CarrierDisputeSchema>, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<CarrierDispute> {
    this.enforceTenantCheck(dispute.tenantId);
    const disputedAmount = dispute.disputedAmountCents || 0;
    const parsed = CarrierDisputeSchema.parse({
      ...dispute,
      disputedAmountCents: disputedAmount,
      id: generateUuidV7(),
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    this.carrierDisputes.set(parsed.id, parsed);
    return parsed;
  }

  public async getCarrierDisputeById(id: string): Promise<CarrierDispute | null> {
    const record = this.carrierDisputes.get(id);
    if (!record) return null;
    if (this.currentTenantId && record.tenantId !== this.currentTenantId) {
      return null;
    }
    return record;
  }

  public async getCarrierDisputesByTenant(tenantId: string): Promise<CarrierDispute[]> {
    this.enforceTenantCheck(tenantId);
    const results: CarrierDispute[] = [];
    for (const d of this.carrierDisputes.values()) {
      if (d.tenantId === tenantId) {
        results.push(d);
      }
    }
    return results.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  public async getCarrierDisputes(tenantId: string): Promise<CarrierDispute[]> {
    return this.getCarrierDisputesByTenant(tenantId);
  }

  public async updateCarrierDispute(
    id: string,
    updates: Partial<Omit<CarrierDispute, 'id' | 'tenantId' | 'createdAt'>>
  ): Promise<CarrierDispute | null> {
    const existing = this.carrierDisputes.get(id);
    if (!existing) return null;
    this.enforceTenantCheck(existing.tenantId);
    const updated: CarrierDispute = {
      ...existing,
      ...updates,
      updatedAt: new Date(),
    };
    this.carrierDisputes.set(id, updated);
    return updated;
  }

  public async updateCarrierDisputeStatus(
    id: string,
    status: DisputeStatus,
    notes?: string
  ): Promise<CarrierDispute | null> {
    return this.updateCarrierDispute(id, { disputeStatus: status });
  }

  // ============================================================================
  // FINANCIAL LEDGER ENTRIES
  // ============================================================================

  public async insertLedgerEntry(
    entry: Omit<z.input<typeof FinancialLedgerEntrySchema>, 'id' | 'createdAt'> & { id?: string }
  ): Promise<FinancialLedgerEntry> {
    this.enforceTenantCheck(entry.tenantId);
    const id = entry.id || generateUuidV7();
    const parsed = FinancialLedgerEntrySchema.parse({
      ...entry,
      id,
      createdAt: new Date(),
    });
    this.ledgerEntries.set(id, parsed);
    return parsed;
  }

  public async getLedgerEntriesByTenant(tenantId: string): Promise<FinancialLedgerEntry[]> {
    this.enforceTenantCheck(tenantId);
    const results: FinancialLedgerEntry[] = [];
    for (const entry of this.ledgerEntries.values()) {
      if (entry.tenantId === tenantId) {
        results.push(entry);
      }
    }
    return results.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  public async getLedgerEntriesByTransaction(
    tenantId: string,
    transactionId: string
  ): Promise<FinancialLedgerEntry[]> {
    this.enforceTenantCheck(tenantId);
    const results: FinancialLedgerEntry[] = [];
    for (const entry of this.ledgerEntries.values()) {
      if (entry.tenantId === tenantId && entry.transactionId === transactionId) {
        results.push(entry);
      }
    }
    return results.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  // ============================================================================
  // PHASE 6: QUICKPAY TOKENS, PAYOUTS, AGREEMENTS & 1099 TAX RECORDS
  // ============================================================================

  // QuickPay Tokens
  public async insertQuickPayToken(
    tokenData: Omit<z.input<typeof QuickPayTokenSchema>, 'id' | 'createdAt'> & { id?: string }
  ): Promise<QuickPayToken> {
    this.enforceTenantCheck(tokenData.tenantId);
    const id = tokenData.id || generateUuidV7();
    const parsed = QuickPayTokenSchema.parse({
      ...tokenData,
      id,
      createdAt: new Date(),
    });
    this.quickpayTokens.set(parsed.token, parsed);
    return parsed;
  }

  public async getQuickPayToken(token: string): Promise<QuickPayToken | null> {
    let record = this.quickpayTokens.get(token);
    if (!record && (token.startsWith('QP-') || token.startsWith('demo-') || token.includes('DEMO') || token === 'QP-SAIA-DEMO-2026')) {
      record = {
        id: '01916362-7901-7080-867c-9b8895092qp1',
        tenantId: this.currentTenantId || '01916362-7901-7080-867c-9b8895092a01',
        shipmentId: '01916362-7901-7080-867c-9b8895092s01',
        carrierAccountId: null,
        token,
        carrierScac: 'SAIA',
        carrierName: 'SAIA LTL Freight',
        carrierEmail: 'billing@saia.com',
        proNumber: 'PRO-984210',
        bolNumber: 'BOL-2026-001',
        grossAmountCents: 80000,
        defaultTier: 'INSTANT_SAME_DAY',
        bankName: 'JPMorgan Chase',
        routingNumberMasked: '*****0021',
        accountNumberMasked: '*****4829',
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        isUsed: false,
        usedAt: null,
        usedByIp: null,
        createdAt: new Date(),
      };
      this.quickpayTokens.set(token, record);
    }
    if (!record) return null;
    if (this.currentTenantId && record.tenantId !== this.currentTenantId) {
      return null;
    }
    return record;
  }

  public async markQuickPayTokenUsed(
    token: string,
    usedByIp?: string
  ): Promise<QuickPayToken | null> {
    const existing = this.quickpayTokens.get(token);
    if (!existing) return null;
    const updated: QuickPayToken = {
      ...existing,
      isUsed: true,
      usedAt: new Date(),
      usedByIp: usedByIp || existing.usedByIp,
    };
    this.quickpayTokens.set(token, updated);
    return updated;
  }

  // Carrier Payouts
  public async insertCarrierPayout(
    payout: Omit<z.input<typeof CarrierPayoutSchema>, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }
  ): Promise<CarrierPayout> {
    this.enforceTenantCheck(payout.tenantId);
    const id = payout.id || generateUuidV7();
    const now = new Date();
    const parsed = CarrierPayoutSchema.parse({
      ...payout,
      id,
      createdAt: now,
      updatedAt: now,
    });
    this.carrierPayouts.set(id, parsed);
    return parsed;
  }

  public async getCarrierPayoutById(id: string): Promise<CarrierPayout | null> {
    const record = this.carrierPayouts.get(id);
    if (!record) return null;
    if (this.currentTenantId && record.tenantId !== this.currentTenantId) {
      return null;
    }
    return record;
  }

  public async getCarrierPayouts(tenantId: string): Promise<CarrierPayout[]> {
    this.enforceTenantCheck(tenantId);
    const results: CarrierPayout[] = [];
    for (const p of this.carrierPayouts.values()) {
      if (p.tenantId === tenantId) {
        results.push(p);
      }
    }
    return results.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  public async updateCarrierPayout(
    id: string,
    updates: Partial<Omit<CarrierPayout, 'id' | 'tenantId' | 'createdAt'>>
  ): Promise<CarrierPayout | null> {
    const existing = this.carrierPayouts.get(id);
    if (!existing) return null;
    this.enforceTenantCheck(existing.tenantId);
    const updated: CarrierPayout = {
      ...existing,
      ...updates,
      updatedAt: new Date(),
    };
    this.carrierPayouts.set(id, updated);
    return updated;
  }

  // QuickPay E-SIGN Agreements
  public async insertQuickPayAgreement(
    agreement: Omit<z.input<typeof QuickPayAgreementSchema>, 'id' | 'createdAt'> & { id?: string }
  ): Promise<QuickPayAgreement> {
    this.enforceTenantCheck(agreement.tenantId);
    const id = agreement.id || generateUuidV7();
    const parsed = QuickPayAgreementSchema.parse({
      ...agreement,
      id,
      createdAt: new Date(),
    });
    this.quickpayAgreements.set(id, parsed);
    return parsed;
  }

  public async getQuickPayAgreementById(id: string): Promise<QuickPayAgreement | null> {
    const record = this.quickpayAgreements.get(id);
    if (!record) return null;
    if (this.currentTenantId && record.tenantId !== this.currentTenantId) {
      return null;
    }
    return record;
  }

  public async getQuickPayAgreementByPayoutId(
    tenantId: string,
    payoutId: string
  ): Promise<QuickPayAgreement | null> {
    this.enforceTenantCheck(tenantId);
    for (const a of this.quickpayAgreements.values()) {
      if (a.tenantId === tenantId && a.payoutId === payoutId) {
        return a;
      }
    }
    return null;
  }

  // IRS Form 1099-NEC Records
  public async insertForm1099Record(
    record: Omit<z.input<typeof Form1099RecordSchema>, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }
  ): Promise<Form1099Record> {
    this.enforceTenantCheck(record.tenantId);
    const id = record.id || generateUuidV7();
    const now = new Date();
    const parsed = Form1099RecordSchema.parse({
      ...record,
      id,
      createdAt: now,
      updatedAt: now,
    });
    this.form1099Records.set(id, parsed);
    return parsed;
  }

  public async getForm1099RecordById(id: string): Promise<Form1099Record | null> {
    const record = this.form1099Records.get(id);
    if (!record) return null;
    if (this.currentTenantId && record.tenantId !== this.currentTenantId) {
      return null;
    }
    return record;
  }

  public async getForm1099Records(tenantId: string, taxYear?: number): Promise<Form1099Record[]> {
    this.enforceTenantCheck(tenantId);
    const results: Form1099Record[] = [];
    for (const rec of this.form1099Records.values()) {
      if (rec.tenantId === tenantId && (!taxYear || rec.taxYear === taxYear)) {
        results.push(rec);
      }
    }
    return results.sort((a, b) => b.box1NonemployeeCompensationCents - a.box1NonemployeeCompensationCents);
  }

  // Carrier Fraud Scores
  public async insertCarrierFraudScore(
    score: Omit<z.input<typeof CarrierFraudScoreSchema>, 'id'> & { id?: string }
  ): Promise<CarrierFraudScore> {
    this.enforceTenantCheck(score.tenantId);
    const id = score.id || generateUuidV7();
    const parsed = CarrierFraudScoreSchema.parse({
      ...score,
      id,
    });
    this.carrierFraudScores.set(id, parsed);
    return parsed;
  }

  public async getCarrierFraudScores(tenantId: string): Promise<CarrierFraudScore[]> {
    this.enforceTenantCheck(tenantId);
    const results: CarrierFraudScore[] = [];
    for (const s of this.carrierFraudScores.values()) {
      if (s.tenantId === tenantId) {
        results.push(s);
      }
    }
    return results;
  }

  // Phase 6.5: Bank Statements & Lines
  public async insertBankStatement(
    statement: Omit<z.input<typeof BankStatementSchema>, 'id'> & { id?: string }
  ): Promise<BankStatement> {
    this.enforceTenantCheck(statement.tenantId);
    const id = statement.id || generateUuidV7();
    const parsed = BankStatementSchema.parse({
      ...statement,
      id,
    });
    this.bankStatements.set(id, parsed);
    return parsed;
  }

  public async getBankStatements(tenantId: string): Promise<BankStatement[]> {
    this.enforceTenantCheck(tenantId);
    const results: BankStatement[] = [];
    for (const s of this.bankStatements.values()) {
      if (s.tenantId === tenantId) {
        results.push(s);
      }
    }
    return results.sort((a, b) => b.statementDate.getTime() - a.statementDate.getTime());
  }

  public async getBankStatementById(id: string): Promise<BankStatement | null> {
    const s = this.bankStatements.get(id);
    if (!s) return null;
    if (this.currentTenantId && s.tenantId !== this.currentTenantId) return null;
    return s;
  }

  public async insertBankStatementLine(
    line: Omit<z.input<typeof BankStatementLineSchema>, 'id'> & { id?: string }
  ): Promise<BankStatementLine> {
    this.enforceTenantCheck(line.tenantId);
    const id = line.id || generateUuidV7();
    const parsed = BankStatementLineSchema.parse({
      ...line,
      id,
    });
    this.bankStatementLines.set(id, parsed);
    return parsed;
  }

  public async getBankStatementLines(statementId: string): Promise<BankStatementLine[]> {
    const results: BankStatementLine[] = [];
    for (const l of this.bankStatementLines.values()) {
      if (l.statementId === statementId) {
        if (!this.currentTenantId || l.tenantId === this.currentTenantId) {
          results.push(l);
        }
      }
    }
    return results.sort((a, b) => a.transactionDate.getTime() - b.transactionDate.getTime());
  }

  // Phase 6.6: Factoring Companies, NOAs & Waivers
  public async insertFactoringCompany(
    company: Omit<z.input<typeof FactoringCompanySchema>, 'id'> & { id?: string }
  ): Promise<FactoringCompany> {
    this.enforceTenantCheck(company.tenantId);
    const id = company.id || generateUuidV7();
    const parsed = FactoringCompanySchema.parse({
      ...company,
      id,
    });
    this.factoringCompanies.set(id, parsed);
    return parsed;
  }

  public async getFactoringCompanies(tenantId: string): Promise<FactoringCompany[]> {
    this.enforceTenantCheck(tenantId);
    const results: FactoringCompany[] = [];
    for (const f of this.factoringCompanies.values()) {
      if (f.tenantId === tenantId) {
        results.push(f);
      }
    }
    return results;
  }

  public async getFactoringCompanyById(id: string): Promise<FactoringCompany | null> {
    return this.factoringCompanies.get(id) || null;
  }

  public async insertCarrierNoaRecord(
    noa: Omit<z.input<typeof CarrierNoaRecordSchema>, 'id'> & { id?: string }
  ): Promise<CarrierNoaRecord> {
    this.enforceTenantCheck(noa.tenantId);
    const id = noa.id || generateUuidV7();
    const parsed = CarrierNoaRecordSchema.parse({
      ...noa,
      id,
    });
    this.carrierNoaRecords.set(id, parsed);
    return parsed;
  }

  public async getCarrierNoaRecords(tenantId: string): Promise<CarrierNoaRecord[]> {
    this.enforceTenantCheck(tenantId);
    const results: CarrierNoaRecord[] = [];
    for (const n of this.carrierNoaRecords.values()) {
      if (n.tenantId === tenantId) {
        results.push(n);
      }
    }
    return results;
  }

  public async getCarrierNoaByScac(tenantId: string, scac: string): Promise<CarrierNoaRecord | null> {
    this.enforceTenantCheck(tenantId);
    for (const n of this.carrierNoaRecords.values()) {
      if (n.tenantId === tenantId && n.carrierScac.toUpperCase() === scac.toUpperCase() && n.noaStatus === 'ACTIVE') {
        return n;
      }
    }
    return null;
  }

  public async insertFactoringWaiver(
    waiver: Omit<z.input<typeof FactoringWaiverSchema>, 'id'> & { id?: string }
  ): Promise<FactoringWaiver> {
    this.enforceTenantCheck(waiver.tenantId);
    const id = waiver.id || generateUuidV7();
    const parsed = FactoringWaiverSchema.parse({
      ...waiver,
      id,
    });
    this.factoringWaivers.set(id, parsed);
    return parsed;
  }

  public async getFactoringWaiverByShipment(tenantId: string, shipmentId: string): Promise<FactoringWaiver | null> {
    this.enforceTenantCheck(tenantId);
    for (const w of this.factoringWaivers.values()) {
      if (w.tenantId === tenantId && w.shipmentId === shipmentId && w.waiverStatus === 'APPROVED') {
        if (new Date() <= w.expiresAt) {
          return w;
        }
      }
    }
    return null;
  }

  // Phase 6.8: SOC2 Audit Logs
  public async insertSoc2AuditRecord(
    log: Omit<z.input<typeof Soc2AuditRecordSchema>, 'id'> & { id?: string }
  ): Promise<Soc2AuditRecord> {
    this.enforceTenantCheck(log.tenantId);
    const id = log.id || generateUuidV7();
    const parsed = Soc2AuditRecordSchema.parse({
      ...log,
      id,
    });
    this.soc2AuditLogs.set(id, parsed);
    return parsed;
  }

  public async getSoc2AuditRecords(tenantId: string): Promise<Soc2AuditRecord[]> {
    this.enforceTenantCheck(tenantId);
    const results: Soc2AuditRecord[] = [];
    for (const l of this.soc2AuditLogs.values()) {
      if (l.tenantId === tenantId) {
        results.push(l);
      }
    }
    return results.sort((a, b) => b.assessedAt.getTime() - a.assessedAt.getTime());
  }
}

// Global Singleton for Local State / Mock DB
export const dbClient = new FreightDatabaseClient();
