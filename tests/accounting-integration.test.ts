import { describe, it, expect, beforeEach, vi } from 'vitest';
import { dbClient } from '../src/db/client';
import {
  GL_CHART_OF_ACCOUNTS,
  GlAccountMappingSchema,
  QboInvoicePayloadSchema,
  QboBillPayloadSchema,
  QboCustomerPayloadSchema,
  QboVendorPayloadSchema,
  QboPaymentPayloadSchema,
  XeroInvoicePayloadSchema,
  XeroBillPayloadSchema,
  XeroContactPayloadSchema,
} from '../src/lib/accounting/types';
import { QuickBooksAdapter } from '../src/lib/accounting/quickbooks-adapter';
import { XeroAdapter } from '../src/lib/accounting/xero-adapter';
import { AccountingSyncEngine } from '../src/lib/accounting/accounting-sync-engine';
import { AccountingConnection, CustomerInvoice, Shipment, CarrierTender, Quote, Account } from '../src/db/schema';

describe('Phase 4.5: Accounting System Integration Engine (QuickBooks, Xero, ERP)', () => {
  const tenantId = '01916362-7901-7080-867c-9b8895092a01';
  let qboConnection: AccountingConnection;
  let xeroConnection: AccountingConnection;
  let customerAccount: Account;
  let testShipment: Shipment;
  let testQuote: Quote;
  let testTender: CarrierTender;
  let testInvoice: CustomerInvoice;

  let qboAdapter: QuickBooksAdapter;
  let xeroAdapter: XeroAdapter;
  let syncEngine: AccountingSyncEngine;

  beforeEach(async () => {
    dbClient.setTenantContext(tenantId);
    dbClient.accountingConnections.clear();
    dbClient.accountingSyncLogs.clear();
    dbClient.customerInvoices.clear();
    dbClient.shipments.clear();
    dbClient.tenders.clear();
    dbClient.quotes.clear();
    dbClient.accounts.clear();

    qboAdapter = new QuickBooksAdapter();
    xeroAdapter = new XeroAdapter();
    syncEngine = new AccountingSyncEngine(qboAdapter, xeroAdapter);

    // 1. Seed Customer Account
    customerAccount = {
      id: '01916362-7901-7080-867c-acc000000001',
      tenantId,
      name: 'Acme Industrial Supplies Inc',
      accountType: 'SHIPPER',
      contactName: 'Sarah Jenkins',
      contactEmail: 'ap@acmeindustrial.com',
      contactPhone: '312-555-0199',
      billingAddressLine1: '500 W Madison St Ste 2400',
      billingCity: 'Chicago',
      billingState: 'IL',
      billingZip: '60661',
      creditLimitCents: 10000000,
      paymentTermsDays: 30,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    dbClient.accounts.set(customerAccount.id, customerAccount);

    // 2. Seed Active QuickBooks Online Connection
    qboConnection = await dbClient.insertAccountingConnection({
      tenantId,
      platform: 'QUICKBOOKS_ONLINE',
      realmId: '4620816365289100',
      companyName: 'Apex Logistics LLC - QBO Sandbox',
      accessToken: 'eyJuYmYiOjE3NTY3MDAwMDB9.qbo_mock_access_token_123',
      refreshToken: 'qbo_mock_refresh_token_456',
      tokenExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // Valid for 24h
      isActive: true,
      glFreightRevenueAccountId: '4000',
      glCarrierExpenseAccountId: '5000',
      glAccountsReceivableAccountId: '1200',
      glAccountsPayableAccountId: '2000',
      syncSettings: { autoSyncOnInvoiceIssued: true },
      lastSyncAt: null,
    });

    // 3. Seed Active Xero Connection
    xeroConnection = {
      id: '01916362-7901-7080-867c-xero00000001',
      tenantId,
      platform: 'XERO',
      realmId: 'xero-tenant-uuid-9842',
      companyName: 'Apex Logistics LLC - Xero Demo Org',
      accessToken: 'xero_mock_bearer_token_789',
      refreshToken: 'xero_mock_refresh_token_101',
      tokenExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      isActive: true,
      glFreightRevenueAccountId: '4000',
      glCarrierExpenseAccountId: '5000',
      glAccountsReceivableAccountId: '1200',
      glAccountsPayableAccountId: '2000',
      syncSettings: {},
      lastSyncAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // 4. Seed Shipment
    testShipment = await dbClient.insertShipment({
      tenantId,
      shipperAccountId: customerAccount.id,
      referenceNumber: 'SHP-2026-984210',
      status: 'DELIVERED',
      originName: 'Acme Chicago Warehouse',
      originAddress1: '500 W Madison St',
      originCity: 'Chicago',
      originState: 'IL',
      originZip: '60661',
      originCountry: 'US',
      destName: 'Apex Dallas Distribution',
      destAddress1: '1400 Logistics Blvd',
      destCity: 'Dallas',
      destState: 'TX',
      destZip: '75201',
      destCountry: 'US',
      totalPallets: 4,
      totalWeightLbs: 3800,
      pickupDateReady: '2026-09-01',
      deliveryDateTarget: '2026-09-04',
    });

    // 5. Seed Quote
    testQuote = await dbClient.insertQuote({
      tenantId,
      shipmentId: testShipment.id,
      carrierCode: 'ESTES',
      carrierName: 'Estes Express Lines',
      carrierScac: 'EXLA',
      accountType: 'DIRECT_BYOC',
      sourceTag: 'ESTES_DIRECT_API',
      quoteNumber: 'Q-ESTES-984210',
      linehaulCostCents: 95000,
      fuelSurchargeCents: 14250,
      accessorialCostCents: 15000,
      totalCarrierCostCents: 124250,
      appliedMarginPercent: 18,
      appliedMarginCents: 27335,
      quotedCustomerPriceCents: 151585,
      grossProfitCents: 27335,
      grossMarginPercent: 18.03,
      transitDays: 3,
      isGuaranteed: false,
      isSelected: true,
      accessorialFees: {
        LG_DEL: 7500,
        INS_DEL: 7500,
      },
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });

    // 6. Seed Carrier Tender
    testTender = await dbClient.insertTender({
      tenantId,
      shipmentId: testShipment.id,
      quoteId: testQuote.id,
      carrierCode: 'ESTES',
      carrierName: 'Estes Express Lines',
      carrierScac: 'EXLA',
      tenderMethod: 'REST_API',
      tenderStatus: 'TENDER_ACCEPTED',
      proNumber: 'EXLA-09823412',
      pickupNumber: 'PU-89421',
      tenderSentAt: new Date(),
      tenderRespondedAt: new Date(),
    });

    // 7. Seed Customer Invoice
    testInvoice = await dbClient.insertCustomerInvoice({
      tenantId,
      shipmentId: testShipment.id,
      customerAccountId: customerAccount.id,
      invoiceNumber: 'INV-2026-98421',
      customerPoNumber: 'PO-ACME-8842',
      shipperName: customerAccount.name,
      shipperEmail: customerAccount.contactEmail!,
      shipperAddress: `${customerAccount.billingAddressLine1}, ${customerAccount.billingCity}, ${customerAccount.billingState} ${customerAccount.billingZip}`,
      linehaulAmountCents: 122335, // $1,223.35
      fuelSurchargeCents: 14250,   // $142.50
      accessorialAmountCents: 15000, // $150.00 (Liftgate $75 + Inside $75)
      accessorialBreakdown: {
        LG_DEL: 7500,
        INS_DEL: 7500,
      },
      totalAmountCents: 151585, // $1,515.85
      currency: 'USD',
      paymentTermsDays: 30,
      invoiceDate: '2026-09-04',
      dueDate: '2026-10-04',
      remitInstructions: {
        bankName: 'JPMorgan Chase Bank, N.A.',
        routingNumber: '021000021',
        accountNumber: '984021984210',
        remitEmail: 'ap-billing@apexfreightos.com',
        remitAddress: 'Apex Freight Solutions LLC, 1000 Logistics Blvd, Chicago, IL',
      },
      status: 'ISSUED',
      pdfUrl: '/api/v1/invoices/INV-2026-98421/pdf',
      emailSentTo: customerAccount.contactEmail!,
      emailSentAt: new Date(),
      paidAt: null,
    });
  });

  // ============================================================================
  // 1. CHART OF ACCOUNTS & TYPES TESTS
  // ============================================================================
  describe('General Ledger Standard Chart of Accounts & Schemas', () => {
    it('provides standard GAAP freight Chart of Accounts mapping constants', () => {
      expect(GL_CHART_OF_ACCOUNTS.FREIGHT_REVENUE).toBe('4000');
      expect(GL_CHART_OF_ACCOUNTS.CARRIER_FREIGHT_EXPENSE).toBe('5000');
      expect(GL_CHART_OF_ACCOUNTS.ACCOUNTS_RECEIVABLE).toBe('1200');
      expect(GL_CHART_OF_ACCOUNTS.ACCOUNTS_PAYABLE).toBe('2000');

      const mapping = GlAccountMappingSchema.parse({
        freightRevenueAccountId: '4000',
        carrierExpenseAccountId: '5000',
        accountsReceivableAccountId: '1200',
        accountsPayableAccountId: '2000',
      });
      expect(mapping.freightRevenueAccountId).toBe('4000');
    });

    it('validates QuickBooks Online & Xero Zod schemas with valid payloads', () => {
      // QBO Customer Schema
      const qboCustomer = QboCustomerPayloadSchema.parse({
        DisplayName: 'Acme Industrial',
        CompanyName: 'Acme Industrial LLC',
        PrimaryEmailAddr: { Address: 'billing@acme.com' },
        Active: true,
      });
      expect(qboCustomer.DisplayName).toBe('Acme Industrial');

      // QBO Vendor Schema
      const qboVendor = QboVendorPayloadSchema.parse({
        DisplayName: 'Estes Express Lines',
        AcctNum: 'EXLA-9921',
        Active: true,
      });
      expect(qboVendor.DisplayName).toBe('Estes Express Lines');

      // QBO Payment Schema
      const qboPayment = QboPaymentPayloadSchema.parse({
        CustomerRef: { value: 'CUST-100' },
        TotalAmt: 1515.85,
        Line: [{ Amount: 1515.85, LinkedTxn: [{ TxnId: 'QBO-INV-98421', TxnType: 'Invoice' }] }],
      });
      expect(qboPayment.TotalAmt).toBe(1515.85);

      // Xero Contact Schema
      const xeroContact = XeroContactPayloadSchema.parse({
        Name: 'Acme Industrial Supplies',
        EmailAddress: 'billing@acme.com',
        IsCustomer: true,
      });
      expect(xeroContact.Name).toBe('Acme Industrial Supplies');
    });
  });

  // ============================================================================
  // 2. QUICKBOOKS ADAPTER TESTS
  // ============================================================================
  describe('QuickBooks Online REST API Adapter (QuickBooksAdapter)', () => {
    it('verifies OAuth2 connection liveness and catches expired or inactive tokens', async () => {
      // 1. Valid connection
      const validCheck = await qboAdapter.verifyConnection(qboConnection);
      expect(validCheck.isValid).toBe(true);
      expect(validCheck.isExpired).toBe(false);
      expect(validCheck.realmId).toBe('4620816365289100');

      // 2. Inactive connection
      const inactiveConn = { ...qboConnection, isActive: false };
      const inactiveCheck = await qboAdapter.verifyConnection(inactiveConn);
      expect(inactiveCheck.isValid).toBe(false);
      expect(inactiveCheck.errorMessage).toContain('inactive');

      // 3. Expired token
      const expiredConn = { ...qboConnection, tokenExpiresAt: new Date(Date.now() - 10000) };
      const expiredCheck = await qboAdapter.verifyConnection(expiredConn);
      expect(expiredCheck.isValid).toBe(false);
      expect(expiredCheck.isExpired).toBe(true);
      expect(expiredCheck.errorMessage).toContain('expired');

      // 4. Missing access token
      const missingTokenConn = { ...qboConnection, accessToken: '' };
      const missingCheck = await qboAdapter.verifyConnection(missingTokenConn);
      expect(missingCheck.isValid).toBe(false);
      expect(missingCheck.errorMessage).toContain('Missing OAuth2 Access Token');
    });

    it('creates QBO Accounts Receivable Invoice with itemized Linehaul, Fuel, and Accessorial lines', async () => {
      const result = await qboAdapter.createInvoice(qboConnection, testInvoice, customerAccount);

      expect(result.qboInvoiceId).toBe('QBO-INV-2026-98421');
      expect(result.docNumber).toBe('INV-2026-98421');

      const payload = result.payload;
      expect(payload.DocNumber).toBe('INV-2026-98421');
      expect(payload.TxnDate).toBe('2026-09-04');
      expect(payload.DueDate).toBe('2026-10-04');
      expect(payload.CustomerRef.name).toBe('Acme Industrial Supplies Inc');
      expect(payload.ARAccountRef?.value).toBe('1200');
      expect(payload.TotalAmt).toBe(1515.85);

      // Verify Itemized Lines: Linehaul, Fuel, Liftgate Delivery, Inside Delivery
      expect(payload.Line.length).toBe(4);
      expect(payload.Line[0].Description).toContain('Freight Linehaul');
      expect(payload.Line[0].Amount).toBe(1223.35);
      expect(payload.Line[0].SalesItemLineDetail?.ItemAccountRef?.value).toBe('4000');

      expect(payload.Line[1].Description).toContain('Fuel Surcharge');
      expect(payload.Line[1].Amount).toBe(142.50);

      expect(payload.Line[2].Description).toContain('Liftgate Delivery Service');
      expect(payload.Line[2].Amount).toBe(75.00);

      expect(payload.Line[3].Description).toContain('Inside Delivery Service');
      expect(payload.Line[3].Amount).toBe(75.00);
    });

    it('creates QBO Accounts Payable Bill for carrier settlement', async () => {
      const result = await qboAdapter.createBill(qboConnection, testShipment, testTender, testQuote);

      expect(result.qboBillId).toBe('QBO-BILL-EXLA-SHP-2026-984210');
      expect(result.docNumber).toBe('BILL-EXLA-09823412');

      const payload = result.payload;
      expect(payload.VendorRef.value).toBe('EXLA');
      expect(payload.VendorRef.name).toBe('Estes Express Lines');
      expect(payload.APAccountRef?.value).toBe('2000');
      expect(payload.TotalAmt).toBe(1242.50); // Total Carrier Cost: $1,242.50

      // Verify itemized Carrier expense lines
      expect(payload.Line.length).toBe(4);
      expect(payload.Line[0].Description).toContain('Carrier Linehaul');
      expect(payload.Line[0].Amount).toBe(950.00);
      expect(payload.Line[0].AccountBasedExpenseLineDetail?.AccountRef.value).toBe('5000');

      expect(payload.Line[1].Description).toContain('Carrier Fuel Surcharge');
      expect(payload.Line[1].Amount).toBe(142.50);

      expect(payload.Line[2].Description).toContain('Liftgate Delivery Service');
      expect(payload.Line[2].Amount).toBe(75.00);

      expect(payload.Line[3].Description).toContain('Inside Delivery Service');
      expect(payload.Line[3].Amount).toBe(75.00);
    });

    it('creates QBO Customer, Vendor, and checks Payment status', async () => {
      // Customer
      const cust = await qboAdapter.createCustomer(qboConnection, {
        DisplayName: 'Acme Supplies',
        CompanyName: 'Acme Supplies LLC',
        PrimaryEmailAddr: { Address: 'acme@example.com' },
        Active: true,
      });
      expect(cust.qboCustomerId).toBe('QBO-CUST-ACME_SUPPLIES');

      // Vendor
      const vend = await qboAdapter.createVendor(qboConnection, {
        DisplayName: 'Estes Express Lines',
        AcctNum: 'EXLA-8821',
        Active: true,
      });
      expect(vend.qboVendorId).toBe('QBO-VEND-ESTES_EXPRESS_LINES');

      // Payment Status
      const payStatus = await qboAdapter.syncPaymentStatus(qboConnection, 'QBO-INV-98421');
      expect(payStatus.isPaid).toBe(false);
      expect(payStatus.status).toBe('UNPAID');
    });
  });

  // ============================================================================
  // 3. XERO ADAPTER TESTS
  // ============================================================================
  describe('Xero Accounting REST API Adapter (XeroAdapter)', () => {
    it('verifies Xero connection validity and token expiration', async () => {
      const validCheck = await xeroAdapter.verifyConnection(xeroConnection);
      expect(validCheck.isValid).toBe(true);
      expect(validCheck.platform).toBe('XERO');

      const expiredConn = { ...xeroConnection, tokenExpiresAt: new Date(Date.now() - 5000) };
      const expiredCheck = await xeroAdapter.verifyConnection(expiredConn);
      expect(expiredCheck.isValid).toBe(false);
      expect(expiredCheck.isExpired).toBe(true);
    });

    it('creates Xero ACCREC (Accounts Receivable) Invoice with itemized line items', async () => {
      const result = await xeroAdapter.createInvoice(xeroConnection, testInvoice, customerAccount);

      expect(result.xeroInvoiceId).toBe('XERO-INV-2026-98421');
      expect(result.invoiceNumber).toBe('INV-2026-98421');

      const payload = result.payload;
      expect(payload.Type).toBe('ACCREC');
      expect(payload.Status).toBe('AUTHORISED');
      expect(payload.Contact.Name).toBe('Acme Industrial Supplies Inc');
      expect(payload.Total).toBe(1515.85);

      expect(payload.LineItems.length).toBe(4);
      expect(payload.LineItems[0].Description).toContain('Freight Linehaul');
      expect(payload.LineItems[0].UnitAmount).toBe(1223.35);
      expect(payload.LineItems[0].AccountCode).toBe('4000');

      expect(payload.LineItems[1].Description).toContain('Fuel Surcharge');
      expect(payload.LineItems[1].UnitAmount).toBe(142.50);

      expect(payload.LineItems[2].Description).toContain('Liftgate Delivery Service');
      expect(payload.LineItems[2].UnitAmount).toBe(75.00);

      expect(payload.LineItems[3].Description).toContain('Inside Delivery Service');
      expect(payload.LineItems[3].UnitAmount).toBe(75.00);
    });

    it('creates Xero ACCPAY (Accounts Payable) Bill for Carrier settlement', async () => {
      const result = await xeroAdapter.createBill(xeroConnection, testShipment, testTender, testQuote);

      expect(result.xeroBillId).toBe('XERO-BILL-EXLA-SHP-2026-984210');
      expect(result.invoiceNumber).toBe('BILL-EXLA-09823412');

      const payload = result.payload;
      expect(payload.Type).toBe('ACCPAY');
      expect(payload.Contact.Name).toBe('Estes Express Lines');
      expect(payload.Contact.IsSupplier).toBe(true);
      expect(payload.Total).toBe(1242.50);

      expect(payload.LineItems.length).toBe(4);
      expect(payload.LineItems[0].Description).toContain('Carrier Linehaul');
      expect(payload.LineItems[0].UnitAmount).toBe(950.00);
      expect(payload.LineItems[0].AccountCode).toBe('5000');
    });

    it('creates Xero Contact and queries payment status', async () => {
      const contactRes = await xeroAdapter.createContact(xeroConnection, {
        Name: 'Global Shippers Inc',
        EmailAddress: 'ap@globalshippers.com',
        IsCustomer: true,
      });
      expect(contactRes.xeroContactId).toBe('XERO-CNT-GLOBAL_SHIPPERS_INC');

      const payRes = await xeroAdapter.syncPaymentStatus(xeroConnection, 'XERO-INV-98421');
      expect(payRes.isPaid).toBe(false);
      expect(payRes.status).toBe('AUTHORISED');
    });
  });

  // ============================================================================
  // 4. ACCOUNTING SYNC ENGINE ORCHESTRATION & IDEMPOTENCY TESTS
  // ============================================================================
  describe('Accounting Sync Engine (AccountingSyncEngine)', () => {
    it('synchronizes Customer Invoice to QuickBooks Online and records immutable ledger log in dbClient', async () => {
      const response = await syncEngine.syncCustomerInvoice(tenantId, testInvoice.id);

      expect(response.success).toBe(true);
      expect(response.status).toBe('SUCCESS');
      expect(response.platform).toBe('QUICKBOOKS_ONLINE');
      expect(response.syncType).toBe('AR_INVOICE');
      expect(response.entityId).toBe(testInvoice.id);
      expect(response.referenceNumber).toBe('INV-2026-98421');
      expect(response.externalPlatformId).toBe('QBO-INV-2026-98421');
      expect(response.amountCents).toBe(151585);

      // Verify dbClient log inserted
      const logs = await dbClient.getAccountingSyncLogsByTenant(tenantId);
      expect(logs.length).toBe(1);
      expect(logs[0].entityId).toBe(testInvoice.id);
      expect(logs[0].syncType).toBe('AR_INVOICE');
      expect(logs[0].status).toBe('SUCCESS');
      expect(logs[0].externalPlatformId).toBe('QBO-INV-2026-98421');
      expect(logs[0].amountCents).toBe(151585);

      // Verify connection lastSyncAt updated
      const updatedConn = await dbClient.getAccountingConnection(tenantId);
      expect(updatedConn?.lastSyncAt).toBeDefined();
    });

    it('enforces strict Idempotency: duplicate invoice sync returns SKIPPED unless force is specified', async () => {
      // First sync
      const firstSync = await syncEngine.syncCustomerInvoice(tenantId, testInvoice.id);
      expect(firstSync.status).toBe('SUCCESS');

      // Second sync without force -> SKIPPED
      const secondSync = await syncEngine.syncCustomerInvoice(tenantId, testInvoice.id);
      expect(secondSync.success).toBe(true);
      expect(secondSync.status).toBe('SKIPPED');
      expect(secondSync.externalPlatformId).toBe('QBO-INV-2026-98421');

      // Still only 1 log entry
      let logs = await dbClient.getAccountingSyncLogsByTenant(tenantId);
      expect(logs.length).toBe(1);

      // Third sync WITH force: true -> SUCCESS and adds second log
      const forcedSync = await syncEngine.syncCustomerInvoice(tenantId, testInvoice.id, { force: true });
      expect(forcedSync.status).toBe('SUCCESS');

      logs = await dbClient.getAccountingSyncLogsByTenant(tenantId);
      expect(logs.length).toBe(2);
    });

    it('synchronizes Carrier Bill to QuickBooks Online for Accounts Payable settlement', async () => {
      const response = await syncEngine.syncCarrierBill(tenantId, testShipment.id);

      expect(response.success).toBe(true);
      expect(response.status).toBe('SUCCESS');
      expect(response.syncType).toBe('AP_BILL');
      expect(response.entityId).toBe(testShipment.id);
      expect(response.referenceNumber).toBe(testShipment.referenceNumber);
      expect(response.externalPlatformId).toBe('QBO-BILL-EXLA-SHP-2026-984210');
      expect(response.amountCents).toBe(124250); // $1,242.50 Carrier Cost

      // Second sync -> SKIPPED idempotency
      const duplicateBill = await syncEngine.syncCarrierBill(tenantId, testShipment.id);
      expect(duplicateBill.status).toBe('SKIPPED');
    });

    it('synchronizes to Xero when Xero platform connection is active', async () => {
      // Switch active connection to Xero
      dbClient.accountingConnections.clear();
      await dbClient.insertAccountingConnection(xeroConnection);

      // Sync Invoice to Xero
      const invResponse = await syncEngine.syncCustomerInvoice(tenantId, testInvoice.id, { platform: 'XERO' });
      expect(invResponse.success).toBe(true);
      expect(invResponse.platform).toBe('XERO');
      expect(invResponse.externalPlatformId).toBe('XERO-INV-2026-98421');

      // Sync Bill to Xero
      const billResponse = await syncEngine.syncCarrierBill(tenantId, testShipment.id, { platform: 'XERO' });
      expect(billResponse.success).toBe(true);
      expect(billResponse.platform).toBe('XERO');
      expect(billResponse.externalPlatformId).toBe('XERO-BILL-EXLA-SHP-2026-984210');
    });

    it('handles transient adapter errors with automated exponential backoff retries', async () => {
      let callCount = 0;
      const failingQboAdapter = new QuickBooksAdapter();

      // Spy on createInvoice to fail 2 times then succeed
      vi.spyOn(failingQboAdapter, 'createInvoice').mockImplementation(async (conn, inv, acc) => {
        callCount++;
        if (callCount < 3) {
          throw new Error(`Transient 503 Service Unavailable (Attempt ${callCount})`);
        }
        return {
          qboInvoiceId: 'QBO-INV-RETRY-SUCCESS',
          docNumber: inv.invoiceNumber,
          payload: failingQboAdapter.buildInvoicePayload(conn, inv, acc),
          rawResponse: { Invoice: { Id: 'QBO-INV-RETRY-SUCCESS' } },
        };
      });

      const retryEngine = new AccountingSyncEngine(failingQboAdapter, xeroAdapter);
      const result = await retryEngine.syncCustomerInvoice(tenantId, testInvoice.id, {
        maxRetries: 3,
        initialDelayMs: 10,
      });

      expect(callCount).toBe(3);
      expect(result.success).toBe(true);
      expect(result.retryCount).toBe(2);
      expect(result.externalPlatformId).toBe('QBO-INV-RETRY-SUCCESS');
    });

    it('records failed sync log when error persists beyond max retries or connection is missing', async () => {
      // Clear connections
      dbClient.accountingConnections.clear();

      const result = await syncEngine.syncCustomerInvoice(tenantId, testInvoice.id);
      expect(result.success).toBe(false);
      expect(result.status).toBe('FAILED');
      expect(result.errorMessage).toContain('No active accounting connection');

      const logs = await dbClient.getAccountingSyncLogsByTenant(tenantId);
      expect(logs.length).toBe(1);
      expect(logs[0].status).toBe('FAILED');
    });

    it('performs batch synchronization of un-synced issued invoices', async () => {
      // Create a second issued invoice
      const invoice2 = await dbClient.insertCustomerInvoice({
        tenantId,
        shipmentId: testShipment.id,
        invoiceNumber: 'INV-2026-98422',
        shipperName: 'Acme Supplies',
        shipperEmail: 'ap@acme.com',
        shipperAddress: '500 W Madison St, Chicago, IL',
        linehaulAmountCents: 85000,
        fuelSurchargeCents: 12000,
        accessorialAmountCents: 0,
        accessorialBreakdown: {},
        totalAmountCents: 97000,
        currency: 'USD',
        paymentTermsDays: 30,
        invoiceDate: '2026-09-04',
        dueDate: '2026-10-04',
        remitInstructions: {
          bankName: 'Chase',
          routingNumber: '021000021',
          accountNumber: '984021984210',
          remitEmail: 'ap@apex.com',
          remitAddress: 'Chicago IL',
        },
        status: 'ISSUED',
      });

      const batchResults = await syncEngine.batchSyncPendingInvoices(tenantId);
      expect(batchResults.length).toBe(2);
      expect(batchResults[0].status).toBe('SUCCESS');
      expect(batchResults[1].status).toBe('SUCCESS');

      // Running batch again -> no new pending invoices to sync
      const secondBatch = await syncEngine.batchSyncPendingInvoices(tenantId);
      expect(secondBatch.length).toBe(0);
    });

    it('reconciles payment status and updates customer invoice when marked paid', async () => {
      // First sync invoice
      await syncEngine.syncCustomerInvoice(tenantId, testInvoice.id);

      // Mock payment reconciliation as PAID
      vi.spyOn(qboAdapter, 'syncPaymentStatus').mockResolvedValueOnce({
        isPaid: true,
        amountPaidCents: 151585,
        remainingBalanceCents: 0,
        status: 'PAID',
        paymentDate: '2026-09-15',
        paymentReference: 'ACH-CHASE-99281',
      });

      const reconResult = await syncEngine.syncPaymentReconciliation(tenantId, testInvoice.id);
      expect(reconResult.success).toBe(true);
      expect(reconResult.paymentResult?.isPaid).toBe(true);
      expect(reconResult.paymentResult?.amountPaidCents).toBe(151585);

      // Check Customer Invoice status updated to PAID
      const updatedInv = await dbClient.getCustomerInvoiceById(testInvoice.id);
      expect(updatedInv?.status).toBe('PAID');
      expect(updatedInv?.paidAt).toBeDefined();
    });
  });
});
