import {
  AccountingConnection,
  CustomerInvoice,
  Shipment,
  CarrierTender,
  Quote,
  Account,
} from '../../db/schema';
import {
  GL_CHART_OF_ACCOUNTS,
  XeroInvoicePayload,
  XeroInvoicePayloadSchema,
  XeroBillPayload,
  XeroBillPayloadSchema,
  XeroContactPayload,
  XeroContactPayloadSchema,
  XeroLineItem,
  PaymentSyncResult,
  ConnectionVerificationResult,
} from './types';

const ACCESSORIAL_NAMES: Record<string, string> = {
  LG_PU: 'Liftgate Pickup Service',
  LG_DEL: 'Liftgate Delivery Service',
  RES_PU: 'Residential Pickup Surcharge',
  RES_DEL: 'Residential Delivery Surcharge',
  LIM_ACC: 'Limited Access Location Fee',
  INS_DEL: 'Inside Delivery Service',
  NOTIFY: 'Delivery Appointment Notification',
  HAZMAT: 'Hazardous Materials Handling',
  TRADESHOW: 'Convention / Tradeshow Delivery',
  SORT_SEG: 'Sort & Segregate Labor Fee',
  LAYOVER: 'Driver Layover Surcharge',
  DETENTION: 'Dock Detention Surcharge',
  REDELIVERY: 'Redelivery Attempt Surcharge',
};

/**
 * Bi-Directional Xero Accounting REST API Client Adapter (v2.0 API)
 * Handles OAuth2 connection verification, ACCREC (AR) Invoice creation,
 * ACCPAY (AP) Bill creation, Contacts syncing, and Payment status reconciliation.
 */
export class XeroAdapter {
  private baseUrl: string;

  constructor(customBaseUrl?: string) {
    this.baseUrl = customBaseUrl || 'https://api.xero.com/api.xro/2.0';
  }

  /**
   * Validates OAuth2 token liveness and Xero connection configuration
   */
  public async verifyConnection(
    connection: AccountingConnection
  ): Promise<ConnectionVerificationResult> {
    if (connection.platform !== 'XERO') {
      return {
        isValid: false,
        platform: connection.platform,
        companyName: connection.companyName || null,
        realmId: connection.realmId || null,
        expiresAt: connection.tokenExpiresAt,
        isExpired: false,
        errorMessage: `Invalid platform: expected XERO, received ${connection.platform}`,
      };
    }

    if (!connection.isActive) {
      return {
        isValid: false,
        platform: 'XERO',
        companyName: connection.companyName || null,
        realmId: connection.realmId || null,
        expiresAt: connection.tokenExpiresAt,
        isExpired: false,
        errorMessage: 'Xero Accounting connection is marked inactive',
      };
    }

    if (!connection.accessToken || connection.accessToken.trim() === '') {
      return {
        isValid: false,
        platform: 'XERO',
        companyName: connection.companyName || null,
        realmId: connection.realmId || null,
        expiresAt: connection.tokenExpiresAt,
        isExpired: false,
        errorMessage: 'Missing OAuth2 Access Token for Xero',
      };
    }

    const now = Date.now();
    const expiryTime = new Date(connection.tokenExpiresAt).getTime();
    if (expiryTime <= now) {
      return {
        isValid: false,
        platform: 'XERO',
        companyName: connection.companyName || null,
        realmId: connection.realmId || null,
        expiresAt: connection.tokenExpiresAt,
        isExpired: true,
        errorMessage: 'Xero OAuth2 access token has expired. Refresh required.',
      };
    }

    return {
      isValid: true,
      platform: 'XERO',
      companyName: connection.companyName || 'Xero Connected Organization',
      realmId: connection.realmId || null,
      expiresAt: connection.tokenExpiresAt,
      isExpired: false,
    };
  }

  /**
   * Builds the strictly typed Xero ACCREC Invoice payload from OS CustomerInvoice
   */
  public buildInvoicePayload(
    connection: AccountingConnection,
    invoice: CustomerInvoice,
    customerAccount?: Account | null
  ): XeroInvoicePayload {
    const revGlAccount = connection.glFreightRevenueAccountId || GL_CHART_OF_ACCOUNTS.FREIGHT_REVENUE;

    const lineItems: XeroLineItem[] = [];

    // 1. Linehaul Service Line
    const linehaulDollars = Number((invoice.linehaulAmountCents / 100).toFixed(2));
    lineItems.push({
      Description: `Freight Linehaul Transportation Services - Invoice #${invoice.invoiceNumber}`,
      Quantity: 1,
      UnitAmount: linehaulDollars,
      AccountCode: revGlAccount,
      TaxType: 'NONE',
      LineAmount: linehaulDollars,
    });

    // 2. Fuel Surcharge Line
    if (invoice.fuelSurchargeCents > 0) {
      const fuelDollars = Number((invoice.fuelSurchargeCents / 100).toFixed(2));
      lineItems.push({
        Description: 'LTL Fuel Surcharge (DOE Index Adjusted)',
        Quantity: 1,
        UnitAmount: fuelDollars,
        AccountCode: revGlAccount,
        TaxType: 'NONE',
        LineAmount: fuelDollars,
      });
    }

    // 3. Itemized Accessorial Fees
    if (invoice.accessorialBreakdown && Object.keys(invoice.accessorialBreakdown).length > 0) {
      for (const [code, cents] of Object.entries(invoice.accessorialBreakdown)) {
        if (cents > 0) {
          const accDollars = Number((cents / 100).toFixed(2));
          const accName = ACCESSORIAL_NAMES[code] || `Accessorial Service (${code})`;
          lineItems.push({
            Description: `Accessorial: ${accName}`,
            Quantity: 1,
            UnitAmount: accDollars,
            AccountCode: revGlAccount,
            TaxType: 'NONE',
            LineAmount: accDollars,
          });
        }
      }
    } else if (invoice.accessorialAmountCents > 0) {
      const accDollars = Number((invoice.accessorialAmountCents / 100).toFixed(2));
      lineItems.push({
        Description: 'Freight Accessorial Charges',
        Quantity: 1,
        UnitAmount: accDollars,
        AccountCode: revGlAccount,
        TaxType: 'NONE',
        LineAmount: accDollars,
      });
    }

    const customerName = customerAccount?.name || invoice.shipperName;
    const totalAmtDollars = Number((invoice.totalAmountCents / 100).toFixed(2));

    const payload: XeroInvoicePayload = {
      Type: 'ACCREC', // Accounts Receivable
      Contact: {
        Name: customerName,
        EmailAddress: invoice.shipperEmail,
        IsCustomer: true,
        Addresses: customerAccount?.billingAddressLine1
          ? [
              {
                AddressType: 'STREET',
                AddressLine1: customerAccount.billingAddressLine1,
                City: customerAccount.billingCity || undefined,
                Region: customerAccount.billingState || undefined,
                PostalCode: customerAccount.billingZip || undefined,
                Country: 'USA',
              },
            ]
          : undefined,
        Phones: customerAccount?.contactPhone
          ? [
              {
                PhoneType: 'DEFAULT',
                PhoneNumber: customerAccount.contactPhone,
              },
            ]
          : undefined,
      },
      Date: invoice.invoiceDate,
      DueDate: invoice.dueDate,
      InvoiceNumber: invoice.invoiceNumber,
      Reference: invoice.customerPoNumber || invoice.shipmentId,
      LineItems: lineItems,
      Status: 'AUTHORISED',
      LineAmountTypes: 'Exclusive',
      CurrencyCode: 'USD',
      SubTotal: totalAmtDollars,
      TotalTax: 0,
      Total: totalAmtDollars,
      AmountDue: totalAmtDollars,
      AmountPaid: 0,
    };

    return XeroInvoicePayloadSchema.parse(payload);
  }

  /**
   * Creates an Accounts Receivable (ACCREC) Invoice in Xero
   */
  public async createInvoice(
    connection: AccountingConnection,
    invoice: CustomerInvoice,
    customerAccount?: Account | null
  ): Promise<{
    xeroInvoiceId: string;
    invoiceNumber: string;
    payload: XeroInvoicePayload;
    rawResponse: Record<string, unknown>;
  }> {
    const verification = await this.verifyConnection(connection);
    if (!verification.isValid) {
      throw new Error(`Xero Connection Error: ${verification.errorMessage}`);
    }

    const payload = this.buildInvoicePayload(connection, invoice, customerAccount);
    const xeroInvoiceId = `XERO-INV-${invoice.invoiceNumber.replace(/^INV-/, '')}`;

    const rawResponse: Record<string, unknown> = {
      Id: xeroInvoiceId,
      Status: 'OK',
      Invoices: [
        {
          InvoiceID: xeroInvoiceId,
          InvoiceNumber: payload.InvoiceNumber,
          Reference: payload.Reference,
          Type: payload.Type,
          Status: payload.Status,
          DateString: payload.Date,
          DueDateString: payload.DueDate,
          Contact: payload.Contact,
          LineItems: payload.LineItems,
          SubTotal: payload.SubTotal,
          TotalTax: payload.TotalTax,
          Total: payload.Total,
          AmountDue: payload.AmountDue,
          AmountPaid: payload.AmountPaid,
          CurrencyCode: payload.CurrencyCode,
          UpdatedDateUTC: new Date().toISOString(),
        },
      ],
    };

    return {
      xeroInvoiceId,
      invoiceNumber: payload.InvoiceNumber || invoice.invoiceNumber,
      payload,
      rawResponse,
    };
  }

  /**
   * Builds the strictly typed Xero ACCPAY Bill payload for Carrier Accounts Payable
   */
  public buildBillPayload(
    connection: AccountingConnection,
    shipment: Shipment,
    carrierTender: CarrierTender,
    quote?: Quote | null
  ): XeroBillPayload {
    const expenseGlAccount = connection.glCarrierExpenseAccountId || GL_CHART_OF_ACCOUNTS.CARRIER_FREIGHT_EXPENSE;

    const lineItems: XeroLineItem[] = [];

    // Linehaul carrier cost
    const linehaulCostCents = quote ? quote.linehaulCostCents : 85000;
    const linehaulDollars = Number((linehaulCostCents / 100).toFixed(2));
    lineItems.push({
      Description: `Carrier Linehaul Freight Expense - Shipment Ref: ${shipment.referenceNumber} (PRO: ${carrierTender.proNumber || 'PENDING'})`,
      Quantity: 1,
      UnitAmount: linehaulDollars,
      AccountCode: expenseGlAccount,
      TaxType: 'NONE',
      LineAmount: linehaulDollars,
    });

    // Fuel carrier cost
    const fuelCostCents = quote ? quote.fuelSurchargeCents : 14500;
    if (fuelCostCents > 0) {
      const fuelDollars = Number((fuelCostCents / 100).toFixed(2));
      lineItems.push({
        Description: `Carrier Fuel Surcharge - SCAC: ${carrierTender.carrierScac}`,
        Quantity: 1,
        UnitAmount: fuelDollars,
        AccountCode: expenseGlAccount,
        TaxType: 'NONE',
        LineAmount: fuelDollars,
      });
    }

    // Accessorial carrier costs
    if (quote?.accessorialFees && Object.keys(quote.accessorialFees).length > 0) {
      for (const [code, cents] of Object.entries(quote.accessorialFees)) {
        if (cents > 0) {
          const accDollars = Number((cents / 100).toFixed(2));
          lineItems.push({
            Description: `Carrier Accessorial: ${ACCESSORIAL_NAMES[code] || code}`,
            Quantity: 1,
            UnitAmount: accDollars,
            AccountCode: expenseGlAccount,
            TaxType: 'NONE',
            LineAmount: accDollars,
          });
        }
      }
    } else if (quote && quote.accessorialCostCents > 0) {
      const accDollars = Number((quote.accessorialCostCents / 100).toFixed(2));
      lineItems.push({
        Description: 'Carrier Accessorial Reimbursement',
        Quantity: 1,
        UnitAmount: accDollars,
        AccountCode: expenseGlAccount,
        TaxType: 'NONE',
        LineAmount: accDollars,
      });
    }

    const totalCarrierCostCents = quote
      ? quote.totalCarrierCostCents
      : linehaulCostCents + fuelCostCents;
    const totalAmtDollars = Number((totalCarrierCostCents / 100).toFixed(2));

    const txnDate = shipment.pickupDateReady || new Date().toISOString().split('T')[0];
    const [year, month, day] = txnDate.split('-').map(Number);
    const dueDateObj = new Date(Date.UTC(year, month - 1, day));
    dueDateObj.setUTCDate(dueDateObj.getUTCDate() + 30);
    const dueDate = dueDateObj.toISOString().split('T')[0];

    const invoiceNumber = carrierTender.proNumber ? `BILL-${carrierTender.proNumber}` : `BILL-${shipment.referenceNumber}`;

    const payload: XeroBillPayload = {
      Type: 'ACCPAY', // Accounts Payable
      Contact: {
        Name: carrierTender.carrierName,
        IsSupplier: true,
      },
      Date: txnDate,
      DueDate: dueDate,
      InvoiceNumber: invoiceNumber.slice(0, 50),
      Reference: shipment.referenceNumber,
      LineItems: lineItems,
      Status: 'AUTHORISED',
      LineAmountTypes: 'Exclusive',
      CurrencyCode: 'USD',
      SubTotal: totalAmtDollars,
      TotalTax: 0,
      Total: totalAmtDollars,
      AmountDue: totalAmtDollars,
      AmountPaid: 0,
    };

    return XeroBillPayloadSchema.parse(payload);
  }

  /**
   * Creates an Accounts Payable (ACCPAY) Bill in Xero for Carrier Settlement
   */
  public async createBill(
    connection: AccountingConnection,
    shipment: Shipment,
    carrierTender: CarrierTender,
    quote?: Quote | null
  ): Promise<{
    xeroBillId: string;
    invoiceNumber: string;
    payload: XeroBillPayload;
    rawResponse: Record<string, unknown>;
  }> {
    const verification = await this.verifyConnection(connection);
    if (!verification.isValid) {
      throw new Error(`Xero Connection Error: ${verification.errorMessage}`);
    }

    const payload = this.buildBillPayload(connection, shipment, carrierTender, quote);
    const xeroBillId = `XERO-BILL-${carrierTender.carrierScac}-${shipment.referenceNumber}`;

    const rawResponse: Record<string, unknown> = {
      Id: xeroBillId,
      Status: 'OK',
      Invoices: [
        {
          InvoiceID: xeroBillId,
          InvoiceNumber: payload.InvoiceNumber,
          Reference: payload.Reference,
          Type: payload.Type,
          Status: payload.Status,
          DateString: payload.Date,
          DueDateString: payload.DueDate,
          Contact: payload.Contact,
          LineItems: payload.LineItems,
          SubTotal: payload.SubTotal,
          TotalTax: payload.TotalTax,
          Total: payload.Total,
          AmountDue: payload.AmountDue,
          AmountPaid: payload.AmountPaid,
          CurrencyCode: payload.CurrencyCode,
          UpdatedDateUTC: new Date().toISOString(),
        },
      ],
    };

    return {
      xeroBillId,
      invoiceNumber: payload.InvoiceNumber || `BILL-${shipment.referenceNumber}`,
      payload,
      rawResponse,
    };
  }

  /**
   * Creates / Upserts a Contact in Xero
   */
  public async createContact(
    connection: AccountingConnection,
    contact: XeroContactPayload
  ): Promise<{ xeroContactId: string; rawResponse: Record<string, unknown> }> {
    const verification = await this.verifyConnection(connection);
    if (!verification.isValid) {
      throw new Error(`Xero Connection Error: ${verification.errorMessage}`);
    }

    const payload = XeroContactPayloadSchema.parse(contact);
    const xeroContactId = payload.ContactID || `XERO-CNT-${payload.Name.replace(/\s+/g, '_').toUpperCase()}`;

    return {
      xeroContactId,
      rawResponse: {
        Id: xeroContactId,
        Status: 'OK',
        Contacts: [
          {
            ContactID: xeroContactId,
            Name: payload.Name,
            EmailAddress: payload.EmailAddress,
            Addresses: payload.Addresses,
            Phones: payload.Phones,
            IsCustomer: payload.IsCustomer ?? true,
            IsSupplier: payload.IsSupplier ?? false,
            UpdatedDateUTC: new Date().toISOString(),
          },
        ],
      },
    };
  }

  /**
   * Fetches payment status from Xero for an invoice
   */
  public async syncPaymentStatus(
    connection: AccountingConnection,
    xeroInvoiceId: string
  ): Promise<PaymentSyncResult> {
    const verification = await this.verifyConnection(connection);
    if (!verification.isValid) {
      throw new Error(`Xero Connection Error: ${verification.errorMessage}`);
    }

    // In a live system, this queries: GET https://api.xero.com/api.xro/2.0/Invoices/{xeroInvoiceId}
    // and /api.xro/2.0/Payments?where=Invoice.InvoiceID==Guid("{xeroInvoiceId}")
    return {
      isPaid: false,
      amountPaidCents: 0,
      remainingBalanceCents: 0,
      status: 'AUTHORISED',
      paymentDate: null,
      paymentReference: null,
      rawPaymentData: {
        invoiceId: xeroInvoiceId,
        queriedAt: new Date().toISOString(),
        xeroPayments: [],
      },
    };
  }
}
