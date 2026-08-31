import { z } from 'zod';
import {
  ACCOUNTING_PLATFORMS,
  ACCOUNTING_SYNC_TYPES,
  ACCOUNTING_SYNC_STATUSES,
  AccountingPlatform,
  AccountingSyncType,
  AccountingSyncStatus,
} from '../../db/schema';

// ==============================================================================
// 1. GENERAL LEDGER STANDARD CHART OF ACCOUNTS
// ==============================================================================

export const GL_CHART_OF_ACCOUNTS = {
  FREIGHT_REVENUE: '4000',          // 4000 Freight Revenue (Income / Sales)
  CARRIER_FREIGHT_EXPENSE: '5000',  // 5000 Carrier Freight Expense (COGS / Direct Expense)
  ACCOUNTS_RECEIVABLE: '1200',      // 1200 Accounts Receivable (Current Asset)
  ACCOUNTS_PAYABLE: '2000',         // 2000 Accounts Payable (Current Liability)
} as const;

export const GlAccountMappingSchema = z.object({
  freightRevenueAccountId: z.string().default(GL_CHART_OF_ACCOUNTS.FREIGHT_REVENUE),
  carrierExpenseAccountId: z.string().default(GL_CHART_OF_ACCOUNTS.CARRIER_FREIGHT_EXPENSE),
  accountsReceivableAccountId: z.string().default(GL_CHART_OF_ACCOUNTS.ACCOUNTS_RECEIVABLE),
  accountsPayableAccountId: z.string().default(GL_CHART_OF_ACCOUNTS.ACCOUNTS_PAYABLE),
});
export type GlAccountMapping = z.infer<typeof GlAccountMappingSchema>;

// ==============================================================================
// 2. QUICKBOOKS ONLINE REST API PAYLOAD SCHEMAS & INTERFACES
// ==============================================================================

export const QboReferenceSchema = z.object({
  value: z.string(),
  name: z.string().optional().nullable(),
});
export type QboReference = z.infer<typeof QboReferenceSchema>;

export const QboSalesItemLineDetailSchema = z.object({
  ItemRef: QboReferenceSchema.optional().nullable(),
  ClassRef: QboReferenceSchema.optional().nullable(),
  UnitPrice: z.number().optional().nullable(),
  Qty: z.number().optional().nullable(),
  ItemAccountRef: QboReferenceSchema.optional().nullable(),
  TaxCodeRef: QboReferenceSchema.optional().nullable(),
  ServiceDate: z.string().optional().nullable(),
});
export type QboSalesItemLineDetail = z.infer<typeof QboSalesItemLineDetailSchema>;

export const QboAccountBasedExpenseLineDetailSchema = z.object({
  AccountRef: QboReferenceSchema,
  BillableStatus: z.enum(['Billable', 'NotBillable', 'HasBeenBilled']).optional().nullable(),
  TaxCodeRef: QboReferenceSchema.optional().nullable(),
  CustomerRef: QboReferenceSchema.optional().nullable(),
  ClassRef: QboReferenceSchema.optional().nullable(),
});
export type QboAccountBasedExpenseLineDetail = z.infer<typeof QboAccountBasedExpenseLineDetailSchema>;

export const QboLineItemSchema = z.object({
  Id: z.string().optional().nullable(),
  LineNum: z.number().int().optional().nullable(),
  Description: z.string().optional().nullable(),
  Amount: z.number(), // Decimal dollars (e.g. 1250.50)
  DetailType: z.enum([
    'SalesItemLineDetail',
    'AccountBasedExpenseLineDetail',
    'DescriptionOnly',
    'SubTotalLineDetail',
  ]),
  SalesItemLineDetail: QboSalesItemLineDetailSchema.optional().nullable(),
  AccountBasedExpenseLineDetail: QboAccountBasedExpenseLineDetailSchema.optional().nullable(),
});
export type QboLineItem = z.infer<typeof QboLineItemSchema>;

export const QboAddressSchema = z.object({
  Line1: z.string().optional().nullable(),
  Line2: z.string().optional().nullable(),
  Line3: z.string().optional().nullable(),
  City: z.string().optional().nullable(),
  CountrySubDivisionCode: z.string().optional().nullable(), // State / Province
  PostalCode: z.string().optional().nullable(),
  Country: z.string().optional().nullable(),
});
export type QboAddress = z.infer<typeof QboAddressSchema>;

export const QboInvoicePayloadSchema = z.object({
  Id: z.string().optional().nullable(),
  SyncToken: z.string().optional().nullable(),
  DocNumber: z.string().min(1).max(32).optional().nullable(),
  TxnDate: z.string().optional().nullable(), // YYYY-MM-DD
  DueDate: z.string().optional().nullable(), // YYYY-MM-DD
  CustomerRef: QboReferenceSchema,
  ARAccountRef: QboReferenceSchema.optional().nullable(),
  BillEmail: z.object({ Address: z.string().email() }).optional().nullable(),
  BillAddr: QboAddressSchema.optional().nullable(),
  ShipAddr: QboAddressSchema.optional().nullable(),
  Line: z.array(QboLineItemSchema).min(1),
  TotalAmt: z.number().optional().nullable(),
  PrivateNote: z.string().optional().nullable(),
  CustomerMemo: z.object({ value: z.string() }).optional().nullable(),
});
export type QboInvoicePayload = z.infer<typeof QboInvoicePayloadSchema>;

export const QboBillPayloadSchema = z.object({
  Id: z.string().optional().nullable(),
  SyncToken: z.string().optional().nullable(),
  DocNumber: z.string().min(1).max(32).optional().nullable(),
  TxnDate: z.string().optional().nullable(), // YYYY-MM-DD
  DueDate: z.string().optional().nullable(), // YYYY-MM-DD
  VendorRef: QboReferenceSchema,
  APAccountRef: QboReferenceSchema.optional().nullable(),
  Line: z.array(QboLineItemSchema).min(1),
  TotalAmt: z.number().optional().nullable(),
  PrivateNote: z.string().optional().nullable(),
  SalesTermRef: QboReferenceSchema.optional().nullable(),
});
export type QboBillPayload = z.infer<typeof QboBillPayloadSchema>;

export const QboCustomerPayloadSchema = z.object({
  Id: z.string().optional().nullable(),
  DisplayName: z.string().min(1).max(100),
  CompanyName: z.string().max(100).optional().nullable(),
  PrimaryEmailAddr: z.object({ Address: z.string().email() }).optional().nullable(),
  PrimaryPhone: z.object({ FreeFormNumber: z.string() }).optional().nullable(),
  BillAddr: QboAddressSchema.optional().nullable(),
  ShipAddr: QboAddressSchema.optional().nullable(),
  Notes: z.string().optional().nullable(),
  Active: z.boolean().default(true),
});
export type QboCustomerPayload = z.infer<typeof QboCustomerPayloadSchema>;

export const QboVendorPayloadSchema = z.object({
  Id: z.string().optional().nullable(),
  DisplayName: z.string().min(1).max(100),
  CompanyName: z.string().max(100).optional().nullable(),
  PrimaryEmailAddr: z.object({ Address: z.string().email() }).optional().nullable(),
  PrimaryPhone: z.object({ FreeFormNumber: z.string() }).optional().nullable(),
  BillAddr: QboAddressSchema.optional().nullable(),
  AcctNum: z.string().optional().nullable(),
  TaxIdentifier: z.string().optional().nullable(),
  Active: z.boolean().default(true),
});
export type QboVendorPayload = z.infer<typeof QboVendorPayloadSchema>;

export const QboLinkedTxnSchema = z.object({
  TxnId: z.string(),
  TxnType: z.string(), // e.g. 'Invoice'
});
export type QboLinkedTxn = z.infer<typeof QboLinkedTxnSchema>;

export const QboPaymentLineSchema = z.object({
  Amount: z.number(),
  LinkedTxn: z.array(QboLinkedTxnSchema),
});
export type QboPaymentLine = z.infer<typeof QboPaymentLineSchema>;

export const QboPaymentPayloadSchema = z.object({
  Id: z.string().optional().nullable(),
  CustomerRef: QboReferenceSchema,
  TotalAmt: z.number(),
  TxnDate: z.string().optional().nullable(), // YYYY-MM-DD
  PaymentRefNum: z.string().optional().nullable(),
  Line: z.array(QboPaymentLineSchema).optional().nullable(),
  DepositToAccountRef: QboReferenceSchema.optional().nullable(),
  PrivateNote: z.string().optional().nullable(),
});
export type QboPaymentPayload = z.infer<typeof QboPaymentPayloadSchema>;

// ==============================================================================
// 3. XERO ACCOUNTING REST API PAYLOAD SCHEMAS & INTERFACES
// ==============================================================================

export const XeroAddressSchema = z.object({
  AddressType: z.enum(['STREET', 'POBOX', 'DELIVERY']).default('STREET'),
  AddressLine1: z.string().optional().nullable(),
  AddressLine2: z.string().optional().nullable(),
  AddressLine3: z.string().optional().nullable(),
  City: z.string().optional().nullable(),
  Region: z.string().optional().nullable(), // State
  PostalCode: z.string().optional().nullable(),
  Country: z.string().optional().nullable(),
});
export type XeroAddress = z.infer<typeof XeroAddressSchema>;

export const XeroPhoneSchema = z.object({
  PhoneType: z.enum(['DEFAULT', 'DDI', 'MOBILE', 'FAX']).default('DEFAULT'),
  PhoneNumber: z.string(),
  PhoneAreaCode: z.string().optional().nullable(),
  PhoneCountryCode: z.string().optional().nullable(),
});
export type XeroPhone = z.infer<typeof XeroPhoneSchema>;

export const XeroContactSchema = z.object({
  ContactID: z.string().optional().nullable(),
  ContactNumber: z.string().optional().nullable(),
  AccountNumber: z.string().optional().nullable(),
  Name: z.string().min(1).max(255),
  FirstName: z.string().optional().nullable(),
  LastName: z.string().optional().nullable(),
  EmailAddress: z.string().email().optional().nullable(),
  Addresses: z.array(XeroAddressSchema).optional().nullable(),
  Phones: z.array(XeroPhoneSchema).optional().nullable(),
  IsCustomer: z.boolean().optional().nullable(),
  IsSupplier: z.boolean().optional().nullable(),
});
export type XeroContact = z.infer<typeof XeroContactSchema>;
export type XeroContactPayload = XeroContact;
export const XeroContactPayloadSchema = XeroContactSchema;

export const XeroLineItemSchema = z.object({
  LineItemID: z.string().optional().nullable(),
  ItemCode: z.string().optional().nullable(),
  Description: z.string().min(1),
  Quantity: z.number().positive(),
  UnitAmount: z.number(), // Decimal dollars (e.g. 850.00)
  AccountCode: z.string().min(1), // e.g. '4000' or '5000'
  TaxType: z.string().default('NONE'),
  TaxAmount: z.number().optional().nullable(),
  LineAmount: z.number().optional().nullable(),
  DiscountRate: z.number().optional().nullable(),
});
export type XeroLineItem = z.infer<typeof XeroLineItemSchema>;

export const XERO_INVOICE_TYPES = ['ACCREC', 'ACCPAY'] as const;
export type XeroInvoiceType = (typeof XERO_INVOICE_TYPES)[number];

export const XERO_INVOICE_STATUSES = [
  'DRAFT',
  'SUBMITTED',
  'AUTHORISED',
  'PAID',
  'VOIDED',
  'DELETED',
] as const;
export type XeroInvoiceStatus = (typeof XERO_INVOICE_STATUSES)[number];

export const XeroInvoicePayloadSchema = z.object({
  InvoiceID: z.string().optional().nullable(),
  Type: z.literal('ACCREC'), // Accounts Receivable
  Contact: XeroContactSchema,
  Date: z.string().optional().nullable(), // YYYY-MM-DD
  DueDate: z.string().optional().nullable(), // YYYY-MM-DD
  InvoiceNumber: z.string().min(1).max(50).optional().nullable(),
  Reference: z.string().max(255).optional().nullable(),
  LineItems: z.array(XeroLineItemSchema).min(1),
  Status: z.enum(XERO_INVOICE_STATUSES).default('AUTHORISED'),
  LineAmountTypes: z.enum(['Exclusive', 'Inclusive', 'NoTax']).default('Exclusive'),
  CurrencyCode: z.enum(['USD', 'CAD']).default('USD'),
  SubTotal: z.number().optional().nullable(),
  TotalTax: z.number().optional().nullable(),
  Total: z.number().optional().nullable(),
  AmountDue: z.number().optional().nullable(),
  AmountPaid: z.number().optional().nullable(),
});
export type XeroInvoicePayload = z.infer<typeof XeroInvoicePayloadSchema>;

export const XeroBillPayloadSchema = z.object({
  InvoiceID: z.string().optional().nullable(),
  Type: z.literal('ACCPAY'), // Accounts Payable
  Contact: XeroContactSchema,
  Date: z.string().optional().nullable(), // YYYY-MM-DD
  DueDate: z.string().optional().nullable(), // YYYY-MM-DD
  InvoiceNumber: z.string().min(1).max(50).optional().nullable(),
  Reference: z.string().max(255).optional().nullable(),
  LineItems: z.array(XeroLineItemSchema).min(1),
  Status: z.enum(XERO_INVOICE_STATUSES).default('AUTHORISED'),
  LineAmountTypes: z.enum(['Exclusive', 'Inclusive', 'NoTax']).default('Exclusive'),
  CurrencyCode: z.enum(['USD', 'CAD']).default('USD'),
  SubTotal: z.number().optional().nullable(),
  TotalTax: z.number().optional().nullable(),
  Total: z.number().optional().nullable(),
  AmountDue: z.number().optional().nullable(),
  AmountPaid: z.number().optional().nullable(),
});
export type XeroBillPayload = z.infer<typeof XeroBillPayloadSchema>;

// ==============================================================================
// 4. ORCHESTRATION & SYNC ENGINE TYPES
// ==============================================================================

export const AccountingSyncRequestSchema = z.object({
  tenantId: z.string().uuid(),
  syncType: z.enum(ACCOUNTING_SYNC_TYPES),
  entityId: z.string().uuid(),
  platform: z.enum(ACCOUNTING_PLATFORMS).optional(),
  force: z.boolean().optional().default(false),
  idempotencyKey: z.string().optional(),
});
export type AccountingSyncRequest = z.infer<typeof AccountingSyncRequestSchema>;

export const AccountingSyncResponseSchema = z.object({
  success: z.boolean(),
  platform: z.enum(ACCOUNTING_PLATFORMS),
  syncType: z.enum(ACCOUNTING_SYNC_TYPES),
  entityId: z.string().uuid(),
  referenceNumber: z.string(),
  externalPlatformId: z.string().nullable().optional(),
  externalSyncNumber: z.string().nullable().optional(),
  amountCents: z.number().int().nonnegative(),
  currency: z.enum(['USD', 'CAD']).default('USD'),
  status: z.enum(ACCOUNTING_SYNC_STATUSES),
  errorMessage: z.string().nullable().optional(),
  retryCount: z.number().int().nonnegative().default(0),
  syncedAt: z.date().nullable().optional(),
  requestPayload: z.record(z.unknown()).nullable().optional(),
  responsePayload: z.record(z.unknown()).nullable().optional(),
});
export type AccountingSyncResponse = z.infer<typeof AccountingSyncResponseSchema>;

export const PaymentSyncResultSchema = z.object({
  isPaid: z.boolean(),
  amountPaidCents: z.number().int().nonnegative(),
  remainingBalanceCents: z.number().int().nonnegative(),
  status: z.string(),
  paymentDate: z.string().nullable().optional(),
  paymentReference: z.string().nullable().optional(),
  rawPaymentData: z.record(z.unknown()).nullable().optional(),
});
export type PaymentSyncResult = z.infer<typeof PaymentSyncResultSchema>;

export const ConnectionVerificationResultSchema = z.object({
  isValid: z.boolean(),
  platform: z.enum(ACCOUNTING_PLATFORMS),
  companyName: z.string().nullable().optional(),
  realmId: z.string().nullable().optional(),
  expiresAt: z.date(),
  isExpired: z.boolean(),
  errorMessage: z.string().nullable().optional(),
});
export type ConnectionVerificationResult = z.infer<typeof ConnectionVerificationResultSchema>;
