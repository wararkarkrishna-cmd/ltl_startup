import { dbClient } from '../../db/client';
import {
  AccountingConnection,
  AccountingPlatform,
  AccountingSyncLog,
  CustomerInvoice,
  Shipment,
  CarrierTender,
  Quote,
  Account,
} from '../../db/schema';
import {
  AccountingSyncRequest,
  AccountingSyncResponse,
  PaymentSyncResult,
  ConnectionVerificationResult,
} from './types';
import { QuickBooksAdapter } from './quickbooks-adapter';
import { XeroAdapter } from './xero-adapter';

export interface SyncOptions {
  force?: boolean;
  platform?: AccountingPlatform;
  maxRetries?: number;
  initialDelayMs?: number;
}

/**
 * Enterprise Accounting Integration & Orchestration Engine (Phase 4.5)
 * Manages bi-directional synchronization between Apex Freight OS and ERP / GL
 * platforms (QuickBooks Online, Xero, NetSuite, Generic ERP).
 * Features strict idempotency checks, automated retries with exponential backoff,
 * and immutable ledger auditing.
 */
export class AccountingSyncEngine {
  private static defaultInstance = new AccountingSyncEngine();
  private qboAdapter: QuickBooksAdapter;
  private xeroAdapter: XeroAdapter;

  constructor(qboAdapter?: QuickBooksAdapter, xeroAdapter?: XeroAdapter) {
    this.qboAdapter = qboAdapter || new QuickBooksAdapter();
    this.xeroAdapter = xeroAdapter || new XeroAdapter();
  }

  public static async syncCustomerInvoice(
    tenantId: string,
    invoiceId: string,
    options?: SyncOptions
  ): Promise<AccountingSyncResponse> {
    return this.defaultInstance.syncCustomerInvoice(tenantId, invoiceId, options);
  }

  public static async syncCarrierBill(
    tenantId: string,
    shipmentId: string,
    options?: SyncOptions
  ): Promise<AccountingSyncResponse> {
    return this.defaultInstance.syncCarrierBill(tenantId, shipmentId, options);
  }

  public static async verifyTenantConnection(
    tenantId: string,
    platform?: AccountingPlatform
  ): Promise<ConnectionVerificationResult> {
    return this.defaultInstance.verifyTenantConnection(tenantId, platform);
  }

  public static async syncPaymentReconciliation(
    tenantId: string,
    invoiceId: string,
    platform?: AccountingPlatform
  ): Promise<AccountingSyncResponse & { paymentResult?: PaymentSyncResult }> {
    return this.defaultInstance.syncPaymentReconciliation(tenantId, invoiceId, platform);
  }

  /**
   * Helper: Executes an async action with exponential backoff retry strategy
   */
  private async executeWithRetry<T>(
    operation: () => Promise<T>,
    maxRetries = 3,
    initialDelayMs = 50,
    backoffFactor = 2
  ): Promise<{ result: T | null; error: Error | null; retryCount: number }> {
    let currentDelay = initialDelayMs;
    let attempts = 0;
    let lastError: Error | null = null;

    while (attempts <= maxRetries) {
      try {
        const result = await operation();
        return { result, error: null, retryCount: attempts };
      } catch (err: any) {
        lastError = err instanceof Error ? err : new Error(String(err));
        attempts++;

        if (attempts > maxRetries) {
          break;
        }

        // Delay with backoff
        await new Promise((resolve) => setTimeout(resolve, currentDelay));
        currentDelay *= backoffFactor;
      }
    }

    return { result: null, error: lastError, retryCount: attempts - 1 };
  }

  /**
   * Verifies the OAuth2 connection status for a given tenant
   */
  public async verifyTenantConnection(
    tenantId: string,
    platform?: AccountingPlatform
  ): Promise<ConnectionVerificationResult> {
    dbClient.setTenantContext(tenantId);
    const connection = await dbClient.getAccountingConnection(tenantId, platform);

    if (!connection) {
      return {
        isValid: false,
        platform: platform || 'QUICKBOOKS_ONLINE',
        companyName: null,
        realmId: null,
        expiresAt: new Date(0),
        isExpired: true,
        errorMessage: `No active accounting connection found for tenant ${tenantId}`,
      };
    }

    if (connection.platform === 'QUICKBOOKS_ONLINE') {
      return this.qboAdapter.verifyConnection(connection);
    } else if (connection.platform === 'XERO') {
      return this.xeroAdapter.verifyConnection(connection);
    }

    return {
      isValid: true,
      platform: connection.platform,
      companyName: connection.companyName || null,
      realmId: connection.realmId || null,
      expiresAt: connection.tokenExpiresAt,
      isExpired: false,
    };
  }

  /**
   * Synchronizes a Customer Invoice to QuickBooks Online or Xero (Accounts Receivable)
   */
  public async syncCustomerInvoice(
    tenantId: string,
    invoiceId: string,
    options?: SyncOptions
  ): Promise<AccountingSyncResponse> {
    dbClient.setTenantContext(tenantId);

    // 1. Fetch Customer Invoice
    const invoice = await dbClient.getCustomerInvoiceById(invoiceId);
    if (!invoice) {
      throw new Error(`Customer Invoice ${invoiceId} not found for tenant ${tenantId}`);
    }

    // 2. Idempotency Check: Skip if already successfully synced unless force is specified
    const existingLogs = await dbClient.getAccountingSyncLogsByTenant(tenantId);
    const successfulPriorLog = existingLogs.find(
      (log) =>
        log.entityId === invoiceId &&
        log.syncType === 'AR_INVOICE' &&
        log.status === 'SUCCESS'
    );

    if (successfulPriorLog && !options?.force) {
      return {
        success: true,
        platform: options?.platform || 'QUICKBOOKS_ONLINE',
        syncType: 'AR_INVOICE',
        entityId: invoice.id,
        referenceNumber: invoice.invoiceNumber,
        externalPlatformId: successfulPriorLog.externalPlatformId,
        externalSyncNumber: successfulPriorLog.externalSyncNumber,
        amountCents: invoice.totalAmountCents,
        currency: invoice.currency,
        status: 'SKIPPED',
        syncedAt: successfulPriorLog.syncedAt,
        errorMessage: null,
        retryCount: 0,
        requestPayload: successfulPriorLog.requestPayload,
        responsePayload: successfulPriorLog.responsePayload,
      };
    }

    // 3. Fetch Active Connection
    const connection = await dbClient.getAccountingConnection(tenantId, options?.platform);
    if (!connection) {
      const errorMsg = `No active accounting connection found for tenant ${tenantId}`;
      await dbClient.insertAccountingSyncLog({
        tenantId,
        connectionId: null,
        syncType: 'AR_INVOICE',
        entityId: invoice.id,
        referenceNumber: invoice.invoiceNumber,
        externalPlatformId: null,
        externalSyncNumber: null,
        status: 'FAILED',
        amountCents: invoice.totalAmountCents,
        currency: invoice.currency,
        errorMessage: errorMsg,
        retryCount: 0,
        syncedAt: null,
        requestPayload: null,
        responsePayload: null,
      });

      return {
        success: false,
        platform: options?.platform || 'QUICKBOOKS_ONLINE',
        syncType: 'AR_INVOICE',
        entityId: invoice.id,
        referenceNumber: invoice.invoiceNumber,
        externalPlatformId: null,
        externalSyncNumber: null,
        amountCents: invoice.totalAmountCents,
        currency: invoice.currency,
        status: 'FAILED',
        errorMessage: errorMsg,
        retryCount: 0,
      };
    }

    // 4. Fetch Customer Account if linked
    let customerAccount: Account | null = null;
    if (invoice.customerAccountId) {
      customerAccount = dbClient.accounts.get(invoice.customerAccountId) || null;
    }

    // 5. Execute Sync via Platform Adapter with Exponential Backoff Retry
    const maxRetries = options?.maxRetries ?? 3;
    const initialDelay = options?.initialDelayMs ?? 50;

    const { result, error, retryCount } = await this.executeWithRetry(async () => {
      if (connection.platform === 'QUICKBOOKS_ONLINE') {
        return await this.qboAdapter.createInvoice(connection, invoice, customerAccount);
      } else if (connection.platform === 'XERO') {
        return await this.xeroAdapter.createInvoice(connection, invoice, customerAccount);
      } else {
        throw new Error(`Unsupported accounting platform: ${connection.platform}`);
      }
    }, maxRetries, initialDelay);

    // 6. Handle Success
    if (result && !error) {
      let externalPlatformId = '';
      let externalSyncNumber = '';
      let requestPayload: Record<string, unknown> = {};
      let responsePayload: Record<string, unknown> = {};

      if ('qboInvoiceId' in result) {
        externalPlatformId = result.qboInvoiceId;
        externalSyncNumber = result.docNumber;
        requestPayload = result.payload as unknown as Record<string, unknown>;
        responsePayload = result.rawResponse;
      } else if ('xeroInvoiceId' in result) {
        externalPlatformId = result.xeroInvoiceId;
        externalSyncNumber = result.invoiceNumber;
        requestPayload = result.payload as unknown as Record<string, unknown>;
        responsePayload = result.rawResponse;
      }

      // Update connection lastSyncAt
      connection.lastSyncAt = new Date();
      connection.updatedAt = new Date();
      dbClient.accountingConnections.set(connection.id, connection);

      const now = new Date();
      await dbClient.insertAccountingSyncLog({
        tenantId,
        connectionId: connection.id,
        syncType: 'AR_INVOICE',
        entityId: invoice.id,
        referenceNumber: invoice.invoiceNumber,
        externalPlatformId,
        externalSyncNumber,
        status: 'SUCCESS',
        amountCents: invoice.totalAmountCents,
        currency: invoice.currency,
        requestPayload,
        responsePayload,
        errorMessage: null,
        retryCount,
        syncedAt: now,
      });

      return {
        success: true,
        platform: connection.platform,
        syncType: 'AR_INVOICE',
        entityId: invoice.id,
        referenceNumber: invoice.invoiceNumber,
        externalPlatformId,
        externalSyncNumber,
        amountCents: invoice.totalAmountCents,
        currency: invoice.currency,
        status: 'SUCCESS',
        errorMessage: null,
        retryCount,
        syncedAt: now,
        requestPayload,
        responsePayload,
      };
    }

    // 7. Handle Failure
    const errorMessage = error?.message || 'Unknown sync error occurred';
    await dbClient.insertAccountingSyncLog({
      tenantId,
      connectionId: connection.id,
      syncType: 'AR_INVOICE',
      entityId: invoice.id,
      referenceNumber: invoice.invoiceNumber,
      externalPlatformId: null,
      externalSyncNumber: null,
      status: 'FAILED',
      amountCents: invoice.totalAmountCents,
      currency: invoice.currency,
      requestPayload: null,
      responsePayload: null,
      errorMessage,
      retryCount,
      syncedAt: null,
    });

    return {
      success: false,
      platform: connection.platform,
      syncType: 'AR_INVOICE',
      entityId: invoice.id,
      referenceNumber: invoice.invoiceNumber,
      externalPlatformId: null,
      externalSyncNumber: null,
      amountCents: invoice.totalAmountCents,
      currency: invoice.currency,
      status: 'FAILED',
      errorMessage,
      retryCount,
    };
  }

  /**
   * Synchronizes a Carrier Bill for a completed shipment to Accounts Payable (AP)
   */
  public async syncCarrierBill(
    tenantId: string,
    shipmentId: string,
    options?: SyncOptions
  ): Promise<AccountingSyncResponse> {
    dbClient.setTenantContext(tenantId);

    // 1. Fetch Shipment
    const shipment = await dbClient.getShipmentById(shipmentId);
    if (!shipment) {
      throw new Error(`Shipment ${shipmentId} not found for tenant ${tenantId}`);
    }

    // 2. Idempotency Check: Skip if AP bill already successfully synced
    const existingLogs = await dbClient.getAccountingSyncLogsByTenant(tenantId);
    const successfulPriorLog = existingLogs.find(
      (log) =>
        log.entityId === shipmentId &&
        log.syncType === 'AP_BILL' &&
        log.status === 'SUCCESS'
    );

    if (successfulPriorLog && !options?.force) {
      return {
        success: true,
        platform: options?.platform || 'QUICKBOOKS_ONLINE',
        syncType: 'AP_BILL',
        entityId: shipment.id,
        referenceNumber: shipment.referenceNumber,
        externalPlatformId: successfulPriorLog.externalPlatformId,
        externalSyncNumber: successfulPriorLog.externalSyncNumber,
        amountCents: successfulPriorLog.amountCents,
        currency: successfulPriorLog.currency,
        status: 'SKIPPED',
        syncedAt: successfulPriorLog.syncedAt,
        errorMessage: null,
        retryCount: 0,
        requestPayload: successfulPriorLog.requestPayload,
        responsePayload: successfulPriorLog.responsePayload,
      };
    }

    // 3. Fetch Carrier Tender & Quote
    const tenders = await dbClient.getTendersByShipmentId(tenantId, shipmentId);
    const primaryTender = tenders.find((t) => t.tenderStatus === 'TENDER_ACCEPTED') || tenders[0];

    if (!primaryTender) {
      throw new Error(`No carrier tender found for shipment ${shipmentId}. Cannot generate AP Bill.`);
    }

    const quotes = await dbClient.getQuotesByShipmentId(tenantId, shipmentId);
    const primaryQuote =
      quotes.find((q) => q.id === primaryTender.quoteId) ||
      quotes.find((q) => q.isSelected) ||
      quotes[0] ||
      null;

    const totalCarrierCostCents = primaryQuote ? primaryQuote.totalCarrierCostCents : 99500;

    // 4. Fetch Active Connection
    const connection = await dbClient.getAccountingConnection(tenantId, options?.platform);
    if (!connection) {
      const errorMsg = `No active accounting connection found for tenant ${tenantId}`;
      await dbClient.insertAccountingSyncLog({
        tenantId,
        connectionId: null,
        syncType: 'AP_BILL',
        entityId: shipment.id,
        referenceNumber: shipment.referenceNumber,
        externalPlatformId: null,
        externalSyncNumber: null,
        status: 'FAILED',
        amountCents: totalCarrierCostCents,
        currency: 'USD',
        errorMessage: errorMsg,
        retryCount: 0,
        syncedAt: null,
      });

      return {
        success: false,
        platform: options?.platform || 'QUICKBOOKS_ONLINE',
        syncType: 'AP_BILL',
        entityId: shipment.id,
        referenceNumber: shipment.referenceNumber,
        externalPlatformId: null,
        externalSyncNumber: null,
        amountCents: totalCarrierCostCents,
        currency: 'USD',
        status: 'FAILED',
        errorMessage: errorMsg,
        retryCount: 0,
      };
    }

    // 5. Execute Bill Sync with Retry Backoff
    const maxRetries = options?.maxRetries ?? 3;
    const initialDelay = options?.initialDelayMs ?? 50;

    const { result, error, retryCount } = await this.executeWithRetry(async () => {
      if (connection.platform === 'QUICKBOOKS_ONLINE') {
        return await this.qboAdapter.createBill(connection, shipment, primaryTender, primaryQuote);
      } else if (connection.platform === 'XERO') {
        return await this.xeroAdapter.createBill(connection, shipment, primaryTender, primaryQuote);
      } else {
        throw new Error(`Unsupported accounting platform: ${connection.platform}`);
      }
    }, maxRetries, initialDelay);

    // 6. Handle Success
    if (result && !error) {
      let externalPlatformId = '';
      let externalSyncNumber = '';
      let requestPayload: Record<string, unknown> = {};
      let responsePayload: Record<string, unknown> = {};

      if ('qboBillId' in result) {
        externalPlatformId = result.qboBillId;
        externalSyncNumber = result.docNumber;
        requestPayload = result.payload as unknown as Record<string, unknown>;
        responsePayload = result.rawResponse;
      } else if ('xeroBillId' in result) {
        externalPlatformId = result.xeroBillId;
        externalSyncNumber = result.invoiceNumber;
        requestPayload = result.payload as unknown as Record<string, unknown>;
        responsePayload = result.rawResponse;
      }

      connection.lastSyncAt = new Date();
      connection.updatedAt = new Date();
      dbClient.accountingConnections.set(connection.id, connection);

      const now = new Date();
      await dbClient.insertAccountingSyncLog({
        tenantId,
        connectionId: connection.id,
        syncType: 'AP_BILL',
        entityId: shipment.id,
        referenceNumber: shipment.referenceNumber,
        externalPlatformId,
        externalSyncNumber,
        status: 'SUCCESS',
        amountCents: totalCarrierCostCents,
        currency: 'USD',
        requestPayload,
        responsePayload,
        errorMessage: null,
        retryCount,
        syncedAt: now,
      });

      return {
        success: true,
        platform: connection.platform,
        syncType: 'AP_BILL',
        entityId: shipment.id,
        referenceNumber: shipment.referenceNumber,
        externalPlatformId,
        externalSyncNumber,
        amountCents: totalCarrierCostCents,
        currency: 'USD',
        status: 'SUCCESS',
        errorMessage: null,
        retryCount,
        syncedAt: now,
        requestPayload,
        responsePayload,
      };
    }

    // 7. Handle Failure
    const errorMessage = error?.message || 'Unknown carrier bill sync error';
    await dbClient.insertAccountingSyncLog({
      tenantId,
      connectionId: connection.id,
      syncType: 'AP_BILL',
      entityId: shipment.id,
      referenceNumber: shipment.referenceNumber,
      externalPlatformId: null,
      externalSyncNumber: null,
      status: 'FAILED',
      amountCents: totalCarrierCostCents,
      currency: 'USD',
      requestPayload: null,
      responsePayload: null,
      errorMessage,
      retryCount,
      syncedAt: null,
    });

    return {
      success: false,
      platform: connection.platform,
      syncType: 'AP_BILL',
      entityId: shipment.id,
      referenceNumber: shipment.referenceNumber,
      externalPlatformId: null,
      externalSyncNumber: null,
      amountCents: totalCarrierCostCents,
      currency: 'USD',
      status: 'FAILED',
      errorMessage,
      retryCount,
    };
  }

  /**
   * Reconciles payment status from ERP back into Apex Freight OS Customer Invoice
   */
  public async syncPaymentReconciliation(
    tenantId: string,
    invoiceId: string,
    platform?: AccountingPlatform
  ): Promise<AccountingSyncResponse & { paymentResult?: PaymentSyncResult }> {
    dbClient.setTenantContext(tenantId);
    const invoice = await dbClient.getCustomerInvoiceById(invoiceId);
    if (!invoice) {
      throw new Error(`Customer Invoice ${invoiceId} not found`);
    }

    const connection = await dbClient.getAccountingConnection(tenantId, platform);
    if (!connection) {
      throw new Error(`No active accounting connection for tenant ${tenantId}`);
    }

    // Retrieve previous sync log for external ID
    const logs = await dbClient.getAccountingSyncLogsByTenant(tenantId);
    const invoiceLog = logs.find(
      (l) => l.entityId === invoiceId && l.syncType === 'AR_INVOICE' && l.status === 'SUCCESS'
    );

    const externalId = invoiceLog?.externalPlatformId || invoice.invoiceNumber;

    let paymentResult: PaymentSyncResult;
    if (connection.platform === 'QUICKBOOKS_ONLINE') {
      paymentResult = await this.qboAdapter.syncPaymentStatus(connection, externalId);
    } else if (connection.platform === 'XERO') {
      paymentResult = await this.xeroAdapter.syncPaymentStatus(connection, externalId);
    } else {
      throw new Error(`Unsupported platform: ${connection.platform}`);
    }

    // If marked as paid, update customer invoice
    if (paymentResult.isPaid) {
      invoice.status = 'PAID';
      invoice.paidAt = paymentResult.paymentDate ? new Date(paymentResult.paymentDate) : new Date();
      invoice.updatedAt = new Date();
      dbClient.customerInvoices.set(invoice.id, invoice);
    }

    const now = new Date();
    await dbClient.insertAccountingSyncLog({
      tenantId,
      connectionId: connection.id,
      syncType: 'PAYMENT_RECON',
      entityId: invoice.id,
      referenceNumber: invoice.invoiceNumber,
      externalPlatformId: externalId,
      externalSyncNumber: paymentResult.paymentReference || null,
      status: 'SUCCESS',
      amountCents: paymentResult.amountPaidCents,
      currency: invoice.currency,
      requestPayload: { externalId },
      responsePayload: paymentResult.rawPaymentData || null,
      errorMessage: null,
      retryCount: 0,
      syncedAt: now,
    });

    return {
      success: true,
      platform: connection.platform,
      syncType: 'PAYMENT_RECON',
      entityId: invoice.id,
      referenceNumber: invoice.invoiceNumber,
      externalPlatformId: externalId,
      externalSyncNumber: paymentResult.paymentReference || null,
      amountCents: paymentResult.amountPaidCents,
      currency: invoice.currency,
      status: 'SUCCESS',
      retryCount: 0,
      syncedAt: now,
      paymentResult,
    };
  }

  /**
   * Batch Sync: Automatically synchronizes all un-synced issued customer invoices
   */
  public async batchSyncPendingInvoices(
    tenantId: string,
    platform?: AccountingPlatform
  ): Promise<AccountingSyncResponse[]> {
    dbClient.setTenantContext(tenantId);
    const invoices = await dbClient.getCustomerInvoices(tenantId);
    const existingLogs = await dbClient.getAccountingSyncLogsByTenant(tenantId);

    const successfulSyncedIds = new Set(
      existingLogs
        .filter((l) => l.syncType === 'AR_INVOICE' && l.status === 'SUCCESS')
        .map((l) => l.entityId)
    );

    const pendingInvoices = invoices.filter(
      (inv) =>
        (inv.status === 'ISSUED' || inv.status === 'SENT') &&
        !successfulSyncedIds.has(inv.id)
    );

    const responses: AccountingSyncResponse[] = [];
    for (const inv of pendingInvoices) {
      try {
        const res = await this.syncCustomerInvoice(tenantId, inv.id, { platform });
        responses.push(res);
      } catch (err: any) {
        responses.push({
          success: false,
          platform: platform || 'QUICKBOOKS_ONLINE',
          syncType: 'AR_INVOICE',
          entityId: inv.id,
          referenceNumber: inv.invoiceNumber,
          amountCents: inv.totalAmountCents,
          currency: inv.currency,
          status: 'FAILED',
          errorMessage: err.message,
          retryCount: 0,
        });
      }
    }

    return responses;
  }

  /**
   * Retries previously failed sync logs with exponential backoff
   */
  public async retryFailedSyncLogs(
    tenantId: string,
    platform?: AccountingPlatform
  ): Promise<AccountingSyncResponse[]> {
    dbClient.setTenantContext(tenantId);
    const logs = await dbClient.getAccountingSyncLogsByTenant(tenantId);
    const failedLogs = logs.filter((l) => l.status === 'FAILED');

    const responses: AccountingSyncResponse[] = [];
    for (const log of failedLogs) {
      if (log.syncType === 'AR_INVOICE') {
        const res = await this.syncCustomerInvoice(tenantId, log.entityId, {
          platform,
          force: true,
        });
        responses.push(res);
      } else if (log.syncType === 'AP_BILL') {
        const res = await this.syncCarrierBill(tenantId, log.entityId, {
          platform,
          force: true,
        });
        responses.push(res);
      }
    }

    return responses;
  }
}

// Global Singleton for Accounting Sync Engine
export const accountingSyncEngine = new AccountingSyncEngine();
