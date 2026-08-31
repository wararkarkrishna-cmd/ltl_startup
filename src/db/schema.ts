import { z } from 'zod';

// ============================================================================
// ENUMS & CONSTANTS
// ============================================================================

export const USER_ROLES = [
  'OWNER',
  'BROKER_AGENT',
  'DISPATCHER',
  'BILLING_SPECIALIST',
  'READ_ONLY_AUDITOR',
] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const ACCOUNT_TYPES = ['SHIPPER', 'CARRIER', '3PL', 'FACTORING'] as const;
export type AccountType = (typeof ACCOUNT_TYPES)[number];

export const SHIPMENT_STATUSES = [
  'DRAFT',
  'EXTRACTED',
  'QUOTED',
  'TENDERED',
  'DISPATCHED',
  'PICKED_UP',
  'IN_TRANSIT',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
  'INVOICED',
  'SETTLED',
  'EXCEPTION',
  'DISPUTED',
] as const;
export type ShipmentStatus = (typeof SHIPMENT_STATUSES)[number];

export const PACKAGING_TYPES = [
  'PALLET',
  'CRATE',
  'BOX',
  'DRUM',
  'ROLL',
  'BUNDLE',
  'OTHER',
] as const;
export type PackagingType = (typeof PACKAGING_TYPES)[number];

export const NMFC_CLASSES = [
  '50',
  '55',
  '60',
  '65',
  '70',
  '77.5',
  '85',
  '92.5',
  '100',
  '110',
  '125',
  '150',
  '175',
  '200',
  '250',
  '300',
  '400',
  '500',
] as const;
export type NmfcClass = (typeof NMFC_CLASSES)[number];

export const ACCESSORIAL_CODES = [
  'LG_PU',       // Liftgate Pickup
  'LG_DEL',      // Liftgate Delivery
  'RES_PU',      // Residential Pickup
  'RES_DEL',     // Residential Delivery
  'LIM_ACC',     // Limited Access (School, Church, Site)
  'INS_DEL',     // Inside Delivery
  'NOTIFY',      // Call / Appointment Before Delivery
  'HAZMAT',      // Hazardous Materials
  'TRADESHOW',   // Convention / Tradeshow Delivery
  'SORT_SEG',    // Sort and Segregate
  'LAYOVER',     // Driver Layover / Delay
  'DETENTION',   // Detention Time at Dock
  'REDELIVERY',  // Redelivery Attempt
] as const;
export type AccessorialCode = (typeof ACCESSORIAL_CODES)[number];

export const DISCREPANCY_TYPES = [
  'UNAUTHORIZED_REWEIGH',
  'RECLASSIFICATION_DISPUTE',
  'BOGUS_ACCESSORIAL',
  'FUEL_INDEX_MISMATCH',
  'DUPLICATE_BILLING',
] as const;
export type DiscrepancyType = (typeof DISCREPANCY_TYPES)[number];

export const DISPUTE_STATUSES = [
  'FLAGGED',
  'DISPUTE_GENERATED',
  'SUBMITTED',
  'IN_REVIEW',
  'CREDIT_ISSUED',
  'DENIED',
  'ESCALATED',
] as const;
export type DisputeStatus = (typeof DISPUTE_STATUSES)[number];

export const PAYOUT_RAILS = [
  'INSTANT_RTP',
  'FEDNOW',
  'SAME_DAY_ACH',
  'STANDARD_ACH',
  'CHECK',
] as const;
export type PayoutRail = (typeof PAYOUT_RAILS)[number];

export const LEDGER_ACCOUNT_TYPES = [
  'CARRIER_PAYABLE',
  'SHIPPER_RECEIVABLE',
  'QUICKPAY_REVENUE',
  'CASH_ESCROW',
  'DISPUTE_RECOVERY',
] as const;
export type LedgerAccountType = (typeof LEDGER_ACCOUNT_TYPES)[number];

export const LEDGER_ENTRY_TYPES = ['DEBIT', 'CREDIT'] as const;
export type LedgerEntryType = (typeof LEDGER_ENTRY_TYPES)[number];

export const INGESTION_SOURCE_CHANNELS = [
  'UPLOAD',
  'EMAIL_WEBHOOK',
  'RAW_TEXT',
  'API',
] as const;
export type IngestionSourceChannel = (typeof INGESTION_SOURCE_CHANNELS)[number];

export const EXTRACTION_STATUSES = [
  'PENDING',
  'PROCESSING',
  'COMPLETED',
  'FAILED',
] as const;
export type ExtractionStatus = (typeof EXTRACTION_STATUSES)[number];

export const CARRIER_CODES = [
  'XPO',
  'ESTES',
  'SAIA',
  'ABF',
  'RL',
  'CZARLITE_GENERIC',
] as const;
export type CarrierCode = (typeof CARRIER_CODES)[number];

export const CARRIER_ACCOUNT_TYPES = [
  'DIRECT_BYOC',
  'PLATFORM_WHOLESALE',
] as const;
export type CarrierAccountType = (typeof CARRIER_ACCOUNT_TYPES)[number];

export const MARGIN_RULE_TYPES = [
  'CUSTOMER_CONTRACT',
  'LANE',
  'WEIGHT_TIER',
  'GLOBAL_DEFAULT',
] as const;
export type MarginRuleType = (typeof MARGIN_RULE_TYPES)[number];

// ============================================================================
// ZOD SCHEMAS & TYPES FOR DATABASE ENTITIES
// ============================================================================

export const TenantSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(255),
  slug: z.string().min(1).max(64),
  apiKeyHash: z.string().optional().nullable(),
  isActive: z.boolean().default(true),
  createdAt: z.date().default(() => new Date()),
  updatedAt: z.date().default(() => new Date()),
});
export type Tenant = z.infer<typeof TenantSchema>;

export const UserSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  email: z.string().email(),
  fullName: z.string().min(1).max(255),
  role: z.enum(USER_ROLES).default('BROKER_AGENT'),
  isActive: z.boolean().default(true),
  createdAt: z.date().default(() => new Date()),
  updatedAt: z.date().default(() => new Date()),
});
export type User = z.infer<typeof UserSchema>;

export const AccountSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  name: z.string().min(1).max(255),
  accountType: z.enum(ACCOUNT_TYPES).default('SHIPPER'),
  mcNumber: z.string().max(16).optional().nullable(),
  dotNumber: z.string().max(16).optional().nullable(),
  contactName: z.string().max(255).optional().nullable(),
  contactEmail: z.string().email().optional().nullable(),
  contactPhone: z.string().max(32).optional().nullable(),
  billingAddressLine1: z.string().max(255).optional().nullable(),
  billingCity: z.string().max(128).optional().nullable(),
  billingState: z.string().length(2).optional().nullable(),
  billingZip: z.string().max(10).optional().nullable(),
  creditLimitCents: z.number().int().nonnegative().default(1000000),
  paymentTermsDays: z.number().int().positive().default(30),
  createdAt: z.date().default(() => new Date()),
  updatedAt: z.date().default(() => new Date()),
});
export type Account = z.infer<typeof AccountSchema>;

export const ShipmentItemSchema = z.object({
  id: z.string().uuid(),
  shipmentId: z.string().uuid(),
  tenantId: z.string().uuid(),
  quantity: z.number().int().min(1),
  packagingType: z.enum(PACKAGING_TYPES).default('PALLET'),
  lengthIn: z.number().positive(),
  widthIn: z.number().positive(),
  heightIn: z.number().positive(),
  weightLbs: z.number().positive(),
  pcfDensity: z.number().positive().optional().nullable(),
  nmfcClass: z.enum(NMFC_CLASSES).default('70'),
  nmfcCode: z.string().max(16).optional().nullable(),
  commodityDescription: z.string().min(1),
  isStackable: z.boolean().default(false),
  isHazmat: z.boolean().default(false),
  unNumber: z.string().max(16).optional().nullable(),
  createdAt: z.date().default(() => new Date()),
});
export type ShipmentItem = z.infer<typeof ShipmentItemSchema>;

export const ShipmentSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  shipperAccountId: z.string().uuid().optional().nullable(),
  referenceNumber: z.string().min(1).max(64),
  status: z.enum(SHIPMENT_STATUSES).default('DRAFT'),
  
  originName: z.string().max(255).optional().nullable(),
  originAddress1: z.string().min(1).max(255),
  originAddress2: z.string().max(255).optional().nullable(),
  originCity: z.string().min(1).max(128),
  originState: z.string().length(2),
  originZip: z.string().min(5).max(10),
  originCountry: z.string().length(2).default('US'),
  originContactName: z.string().max(255).optional().nullable(),
  originContactPhone: z.string().max(32).optional().nullable(),

  destName: z.string().max(255).optional().nullable(),
  destAddress1: z.string().min(1).max(255),
  destAddress2: z.string().max(255).optional().nullable(),
  destCity: z.string().min(1).max(128),
  destState: z.string().length(2),
  destZip: z.string().min(5).max(10),
  destCountry: z.string().length(2).default('US'),
  destContactName: z.string().max(255).optional().nullable(),
  destContactPhone: z.string().max(32).optional().nullable(),

  totalPallets: z.number().int().min(1).default(1),
  totalWeightLbs: z.number().positive(),
  totalLinearFeet: z.number().positive().optional().nullable(),
  totalCubeCuft: z.number().positive().optional().nullable(),

  pickupDateReady: z.string(), // YYYY-MM-DD
  pickupTimeStart: z.string().optional().nullable(),
  pickupTimeEnd: z.string().optional().nullable(),
  deliveryDateTarget: z.string().optional().nullable(),
  deliveryTimeStart: z.string().optional().nullable(),
  deliveryTimeEnd: z.string().optional().nullable(),

  specialInstructions: z.string().optional().nullable(),
  createdBy: z.string().uuid().optional().nullable(),
  createdAt: z.date().default(() => new Date()),
  updatedAt: z.date().default(() => new Date()),
});
export type Shipment = z.infer<typeof ShipmentSchema>;

export const AccessorialLookupSchema = z.object({
  id: z.string().uuid(),
  code: z.enum(ACCESSORIAL_CODES),
  name: z.string().min(1).max(128),
  description: z.string().optional().nullable(),
  category: z.string().default('DELIVERY'),
  defaultFeeCents: z.number().int().nonnegative().default(7500),
  createdAt: z.date().default(() => new Date()),
});
export type AccessorialLookup = z.infer<typeof AccessorialLookupSchema>;

export const FinancialLedgerEntrySchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  transactionId: z.string().uuid(),
  accountType: z.enum(LEDGER_ACCOUNT_TYPES),
  entryType: z.enum(LEDGER_ENTRY_TYPES),
  amountCents: z.number().int().positive(),
  currency: z.enum(['USD', 'CAD']).default('USD'),
  description: z.string().optional().nullable(),
  createdAt: z.date().default(() => new Date()),
});
export type FinancialLedgerEntry = z.infer<typeof FinancialLedgerEntrySchema>;

export const IngestionDocumentSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  fileName: z.string().min(1).max(255),
  fileSizeBytes: z.number().int().nonnegative(),
  mimeType: z.string().min(1).max(128),
  sha256Hash: z.string().length(64),
  storagePath: z.string().min(1),
  sourceChannel: z.enum(INGESTION_SOURCE_CHANNELS).default('UPLOAD'),
  extractionStatus: z.enum(EXTRACTION_STATUSES).default('PENDING'),
  rawExtractedText: z.string().optional().nullable(),
  extractedJson: z.record(z.unknown()).optional().nullable(),
  createdAt: z.date().default(() => new Date()),
  updatedAt: z.date().default(() => new Date()),
});
export type IngestionDocument = z.infer<typeof IngestionDocumentSchema>;

export const CarrierCredentialSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  carrierCode: z.enum(CARRIER_CODES),
  carrierName: z.string().min(1).max(128),
  carrierScac: z.string().min(2).max(10),
  accountNumber: z.string().min(1).max(64),
  accountType: z.enum(CARRIER_ACCOUNT_TYPES).default('DIRECT_BYOC'),
  encryptedApiKey: z.string().min(1),
  encryptedPassword: z.string().optional().nullable(),
  encryptedClientSecret: z.string().optional().nullable(),
  authTag: z.string().length(32), // 16 bytes in hex = 32 chars
  iv: z.string().length(32), // 16 bytes in hex = 32 chars
  isActive: z.boolean().default(true),
  createdAt: z.date().default(() => new Date()),
  updatedAt: z.date().default(() => new Date()),
});
export type CarrierCredential = z.infer<typeof CarrierCredentialSchema>;

export const MarginRuleSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  name: z.string().min(1).max(128),
  ruleType: z.enum(MARGIN_RULE_TYPES).default('GLOBAL_DEFAULT'),
  priority: z.number().int().min(1).default(4), // 1=Customer, 2=Lane, 3=Weight, 4=Global
  customerId: z.string().uuid().optional().nullable(),
  originState: z.string().length(2).optional().nullable(),
  destState: z.string().length(2).optional().nullable(),
  minWeightLbs: z.number().nonnegative().optional().nullable(),
  maxWeightLbs: z.number().positive().optional().nullable(),
  marginPercentage: z.number().nonnegative().default(15.0), // e.g. 15.0 for 15%
  flatMarkupCents: z.number().int().nonnegative().default(0),
  minimumGrossProfitFloorCents: z.number().int().nonnegative().default(7500), // $75.00 floor
  isActive: z.boolean().default(true),
  createdAt: z.date().default(() => new Date()),
  updatedAt: z.date().default(() => new Date()),
});
export type MarginRule = z.infer<typeof MarginRuleSchema>;

export const QuoteSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  shipmentId: z.string().uuid().optional().nullable(),
  carrierCode: z.enum(CARRIER_CODES),
  carrierName: z.string().min(1).max(128),
  carrierScac: z.string().min(2).max(10),
  accountType: z.enum(CARRIER_ACCOUNT_TYPES).default('DIRECT_BYOC'),
  sourceTag: z.string().min(1).max(128),
  quoteNumber: z.string().min(1).max(64),
  
  linehaulCostCents: z.number().int().nonnegative(),
  fuelSurchargeCents: z.number().int().nonnegative(),
  accessorialCostCents: z.number().int().nonnegative(),
  totalCarrierCostCents: z.number().int().positive(),
  
  appliedMarginPercent: z.number().nonnegative(),
  appliedMarginCents: z.number().int().nonnegative(),
  quotedCustomerPriceCents: z.number().int().positive(),
  grossProfitCents: z.number().int(),
  grossMarginPercent: z.number(),
  
  transitDays: z.number().int().min(1).default(3),
  isGuaranteed: z.boolean().default(false),
  isSelected: z.boolean().default(false),
  
  accessorialFees: z.record(z.number().int()).default({}),
  rawCarrierResponse: z.record(z.unknown()).optional().nullable(),
  expiresAt: z.date().default(() => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)),
  createdAt: z.date().default(() => new Date()),
});
export type Quote = z.infer<typeof QuoteSchema>;

// Phase 3: Electronic Carrier Tenders & EDI 204/990
export const TENDER_METHODS = ['REST_API', 'EDI_204', 'EMAIL'] as const;
export type TenderMethod = (typeof TENDER_METHODS)[number];

export const TENDER_STATUSES = [
  'TENDER_SENT',
  'TENDER_ACCEPTED',
  'TENDER_DECLINED',
  'TENDER_CANCELLED',
] as const;
export type TenderStatus = (typeof TENDER_STATUSES)[number];

export const CarrierTenderSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  shipmentId: z.string().uuid(),
  quoteId: z.string().uuid(),
  carrierCode: z.enum(CARRIER_CODES),
  carrierName: z.string().min(1).max(128),
  carrierScac: z.string().min(2).max(10),
  tenderMethod: z.enum(TENDER_METHODS).default('REST_API'),
  tenderStatus: z.enum(TENDER_STATUSES).default('TENDER_SENT'),
  proNumber: z.string().optional().nullable(),
  pickupNumber: z.string().optional().nullable(),
  edi204Payload: z.string().optional().nullable(),
  edi990Response: z.string().optional().nullable(),
  tenderSentAt: z.date().default(() => new Date()),
  tenderRespondedAt: z.date().optional().nullable(),
  createdAt: z.date().default(() => new Date()),
  updatedAt: z.date().default(() => new Date()),
});
export type CarrierTender = z.infer<typeof CarrierTenderSchema>;

// Phase 3: Standardized VICS Digital BOL (eBOL)
export const FREIGHT_CHARGE_TERMS = ['PREPAID', 'COLLECT', 'THIRD_PARTY'] as const;
export type FreightChargeTerm = (typeof FREIGHT_CHARGE_TERMS)[number];

export const DigitalBolSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  shipmentId: z.string().uuid(),
  bolNumber: z.string().min(1).max(64),
  masterBolNumber: z.string().min(1).max(64),
  proNumber: z.string().optional().nullable(),
  carrierCode: z.enum(CARRIER_CODES),
  carrierScac: z.string().min(2).max(10),
  trailerNumber: z.string().optional().nullable(),
  sealNumber: z.string().optional().nullable(),
  specialInstructions: z.string().optional().nullable(),
  freightChargeTerm: z.enum(FREIGHT_CHARGE_TERMS).default('PREPAID'),
  shipperSignature: z.string().optional().nullable(),
  carrierSignature: z.string().optional().nullable(),
  emergencyContact: z.string().default('CHEMTREC: 1-800-424-9300'),
  barcodeData: z.string().min(1),
  pdfUrl: z.string().optional().nullable(),
  createdAt: z.date().default(() => new Date()),
  updatedAt: z.date().default(() => new Date()),
});
export type DigitalBol = z.infer<typeof DigitalBolSchema>;

// Phase 3: 1-Click Quote Action Token
export const QuoteActionTokenSchema = z.object({
  token: z.string().min(32),
  tenantId: z.string().uuid(),
  quoteId: z.string().uuid(),
  shipmentId: z.string().uuid(),
  customerId: z.string().optional().nullable(),
  quotedPriceCents: z.number().int().positive(),
  expiresAt: z.date(),
  isUsed: z.boolean().default(false),
  usedAt: z.date().optional().nullable(),
  bookedByIp: z.string().optional().nullable(),
  poNumber: z.string().optional().nullable(),
});
export type QuoteActionToken = z.infer<typeof QuoteActionTokenSchema>;

// Phase 3.5: Canonical Kanban Dispatch Board Columns
export const DISPATCH_BOARD_COLUMNS = [
  'UNASSIGNED',
  'TENDER_SENT',
  'TENDER_ACCEPTED',
  'DISPATCHED',
  'AT_PICKUP',
  'IN_TRANSIT',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
  'INVOICED',
  'SETTLED',
] as const;
export type DispatchBoardColumn = (typeof DISPATCH_BOARD_COLUMNS)[number];

// Phase 3.6: Rate Confirmation Document Record
export const RateConfirmationSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  shipmentId: z.string().uuid(),
  rateConfirmationNumber: z.string().min(1).max(64),
  carrierCode: z.enum(CARRIER_CODES),
  carrierName: z.string().min(1),
  carrierScac: z.string().min(2).max(10),
  agreedLinehaulCents: z.number().int().nonnegative(),
  agreedFuelCents: z.number().int().nonnegative(),
  agreedAccessorialCents: z.number().int().nonnegative(),
  totalAgreedRateCents: z.number().int().positive(),
  pickupNumber: z.string().min(1),
  pickupDate: z.string(),
  deliveryDateEst: z.string(),
  specialInstructions: z.string().optional().nullable(),
  pdfUrl: z.string().optional().nullable(),
  createdAt: z.date().default(() => new Date()),
});
export type RateConfirmation = z.infer<typeof RateConfirmationSchema>;

// Phase 3.7: Port Transload & Deconsolidation Manifest Record
export const TransloadContainerSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  containerNumber: z.string().min(4).max(32), // e.g. MSKU1984201
  vesselName: z.string().min(1).max(128),
  portOfDischarge: z.string().min(2).max(64), // e.g. USLAX
  steamshipLine: z.string().min(1).max(64),   // e.g. MAERSK
  lastFreeDay: z.string(),                     // YYYY-MM-DD
  stagingLane: z.string().min(1).max(32),      // e.g. STAGING-A4
  sealNumber: z.string().min(1).max(64),
  totalCartons: z.number().int().positive(),
  totalPalletsDevanned: z.number().int().positive(),
  totalGrossWeightLbs: z.number().positive(),
  outboundShipmentIds: z.array(z.string().uuid()).default([]),
  status: z.enum(['IN_BOUND', 'DEVANNED', 'DECONSOLIDATED', 'DISPATCHED']).default('IN_BOUND'),
  createdAt: z.date().default(() => new Date()),
  updatedAt: z.date().default(() => new Date()),
});
export type TransloadContainer = z.infer<typeof TransloadContainerSchema>;

// Phase 3.8: Carrier Vetting & FMCSA Safety Validation Record
export const CarrierVettingRecordSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  carrierCode: z.string().min(1),
  carrierScac: z.string().min(2).max(10),
  carrierName: z.string().min(1),
  dotNumber: z.string().min(1),
  mcNumber: z.string().min(1),
  operatingAuthorityStatus: z.enum(['ACTIVE', 'REVOKED', 'INACTIVE']).default('ACTIVE'),
  safetyRating: z.enum(['SATISFACTORY', 'CONDITIONAL', 'UNSATISFACTORY', 'NONE']).default('SATISFACTORY'),
  autoLiabilityCoverageCents: z.number().int().nonnegative(),
  cargoInsuranceCoverageCents: z.number().int().nonnegative(),
  driverOosRatePercent: z.number().nonnegative(),
  vehicleOosRatePercent: z.number().nonnegative(),
  isApprovedForDispatch: z.boolean().default(true),
  rejectionReasons: z.array(z.string()).default([]),
  vettedAt: z.date().default(() => new Date()),
  expiresAt: z.date().default(() => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)),
});
export type CarrierVettingRecord = z.infer<typeof CarrierVettingRecordSchema>;

// ============================================================================
// PHASE 4: GEOTAGGED POD CAPTURE, SETTLEMENT & CUSTOMER INVOICING
// ============================================================================

export const POD_STATUSES = [
  'PENDING',
  'VERIFIED',
  'FLAGGED_EXCEPTION',
  'REJECTED',
] as const;
export type PodStatus = (typeof POD_STATUSES)[number];

export const EXCEPTION_SEVERITIES = [
  'NONE',
  'LOW',
  'MEDIUM',
  'HIGH',
  'CRITICAL',
] as const;
export type ExceptionSeverity = (typeof EXCEPTION_SEVERITIES)[number];

export const INVOICE_STATUSES = [
  'DRAFT',
  'ISSUED',
  'SENT',
  'PAID',
  'OVERDUE',
  'DISPUTED',
] as const;
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

// Phase 4.1: Driver Mobile POD Action Token
export const PodTokenSchema = z.object({
  token: z.string().min(16),
  tenantId: z.string().uuid(),
  shipmentId: z.string().uuid(),
  carrierCode: z.string().optional().nullable(),
  driverPhone: z.string().optional().nullable(),
  expiresAt: z.date(),
  isUsed: z.boolean().default(false),
  usedAt: z.date().optional().nullable(),
  createdAt: z.date().default(() => new Date()),
});
export type PodToken = z.infer<typeof PodTokenSchema>;

// Phase 4.2 & 4.3: Proof of Delivery (POD) Master Record
export const PodRecordSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  shipmentId: z.string().uuid(),
  podToken: z.string().optional().nullable(),
  
  // Image & File
  imageUrl: z.string().min(1),
  imageHash: z.string().length(64), // SHA-256
  fileSizeBytes: z.number().int().nonnegative(),
  
  // Consignee Delivery Signature
  consigneeName: z.string().min(1).max(255),
  consigneeSignatureDataUrl: z.string().optional().nullable(),
  receivedPieces: z.number().int().nonnegative(),
  expectedPieces: z.number().int().positive(),
  
  // EXIF Metadata
  gpsLatitude: z.number().optional().nullable(),
  gpsLongitude: z.number().optional().nullable(),
  photoTimestamp: z.date().optional().nullable(),
  deviceModel: z.string().optional().nullable(),
  imageOrientation: z.number().int().default(1),
  
  // Geofence Evaluation
  destLatitude: z.number().optional().nullable(),
  destLongitude: z.number().optional().nullable(),
  geofenceDistanceMiles: z.number().nonnegative().optional().nullable(),
  isWithinGeofence: z.boolean().default(true),
  geofenceWarning: z.string().optional().nullable(),
  
  // OCR & Document Authenticity
  ocrRawText: z.string().optional().nullable(),
  ocrConfidence: z.number().nonnegative().default(90.0),
  signatureDetected: z.boolean().default(false),
  pieceCountVerified: z.boolean().default(true),
  pieceCountFound: z.number().int().optional().nullable(),
  stampedDateDetected: z.boolean().default(false),
  stampedDate: z.string().optional().nullable(),
  
  // Damage & Shortage Detection
  hasDamageException: z.boolean().default(false),
  detectedExceptionKeywords: z.array(z.string()).default([]),
  exceptionSeverity: z.enum(EXCEPTION_SEVERITIES).default('NONE'),
  exceptionNotes: z.string().optional().nullable(),
  claimsAlertSent: z.boolean().default(false),
  
  // Status & Scores
  status: z.enum(POD_STATUSES).default('VERIFIED'),
  overallConfidence: z.number().nonnegative().default(95.0),
  
  submittedAt: z.date().default(() => new Date()),
  reviewedBy: z.string().uuid().optional().nullable(),
  reviewedAt: z.date().optional().nullable(),
  createdAt: z.date().default(() => new Date()),
  updatedAt: z.date().default(() => new Date()),
});
export type PodRecord = z.infer<typeof PodRecordSchema>;

// Phase 4.3: Delivery Exception / Damage Claims Record
export const DeliveryExceptionSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  shipmentId: z.string().uuid(),
  podId: z.string().uuid().optional().nullable(),
  severity: z.enum(EXCEPTION_SEVERITIES).default('HIGH'),
  keywordsDetected: z.array(z.string()).default([]),
  notationSnippets: z.array(z.string()).default([]),
  description: z.string().min(1),
  reportedPiecesShort: z.number().int().default(0),
  claimAmountCents: z.number().int().default(0),
  alertSentTo: z.string().optional().nullable(),
  alertSentAt: z.date().default(() => new Date()),
  status: z.enum(['OPEN', 'INVESTIGATING', 'CLAIM_FILED', 'SETTLED', 'RESOLVED', 'DISMISSED']).default('OPEN'),
  createdAt: z.date().default(() => new Date()),
  updatedAt: z.date().default(() => new Date()),
});
export type DeliveryException = z.infer<typeof DeliveryExceptionSchema>;

// Phase 4.4: Customer Invoice Record
export const CustomerInvoiceSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  shipmentId: z.string().uuid(),
  podId: z.string().uuid().optional().nullable(),
  customerAccountId: z.string().uuid().optional().nullable(),
  
  invoiceNumber: z.string().min(1).max(64),
  customerPoNumber: z.string().optional().nullable(),
  shipperName: z.string().min(1).max(255),
  shipperEmail: z.string().email(),
  shipperAddress: z.string().min(1),
  
  // Exact Integer Cents
  linehaulAmountCents: z.number().int().nonnegative(),
  fuelSurchargeCents: z.number().int().nonnegative(),
  accessorialAmountCents: z.number().int().nonnegative().default(0),
  accessorialBreakdown: z.record(z.number().int()).default({}),
  totalAmountCents: z.number().int().positive(),
  currency: z.enum(['USD', 'CAD']).default('USD'),
  
  paymentTermsDays: z.number().int().positive().default(30),
  invoiceDate: z.string(), // YYYY-MM-DD
  dueDate: z.string(),     // YYYY-MM-DD
  
  remitInstructions: z.object({
    bankName: z.string(),
    routingNumber: z.string(),
    accountNumber: z.string(),
    remitEmail: z.string(),
    remitAddress: z.string(),
  }),
  
  pdfUrl: z.string().optional().nullable(),
  status: z.enum(INVOICE_STATUSES).default('ISSUED'),
  emailSentTo: z.string().optional().nullable(),
  emailSentAt: z.date().optional().nullable(),
  paidAt: z.date().optional().nullable(),
  
  createdAt: z.date().default(() => new Date()),
  updatedAt: z.date().default(() => new Date()),
});
export type CustomerInvoice = z.infer<typeof CustomerInvoiceSchema>;

// ==============================================================================
// PHASE 4.5: ACCOUNTING SYSTEM INTEGRATION (QUICKBOOKS, XERO, ERP)
// ==============================================================================
export const ACCOUNTING_PLATFORMS = ['QUICKBOOKS_ONLINE', 'XERO', 'NETSUITE', 'GENERIC_ERP'] as const;
export type AccountingPlatform = (typeof ACCOUNTING_PLATFORMS)[number];

export const ACCOUNTING_SYNC_TYPES = [
  'AR_INVOICE',
  'AP_BILL',
  'PAYMENT_RECON',
  'CUSTOMER_SYNC',
  'VENDOR_SYNC',
] as const;
export type AccountingSyncType = (typeof ACCOUNTING_SYNC_TYPES)[number];

export const ACCOUNTING_SYNC_STATUSES = ['PENDING', 'SUCCESS', 'FAILED', 'SKIPPED'] as const;
export type AccountingSyncStatus = (typeof ACCOUNTING_SYNC_STATUSES)[number];

export const AccountingConnectionSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  platform: z.enum(ACCOUNTING_PLATFORMS),
  realmId: z.string().optional().nullable(),
  companyName: z.string().optional().nullable(),
  accessToken: z.string().min(1),
  refreshToken: z.string().optional().nullable(),
  tokenExpiresAt: z.date(),
  isActive: z.boolean().default(true),
  glFreightRevenueAccountId: z.string().default('4000'),
  glCarrierExpenseAccountId: z.string().default('5000'),
  glAccountsReceivableAccountId: z.string().default('1200'),
  glAccountsPayableAccountId: z.string().default('2000'),
  syncSettings: z.record(z.unknown()).default({}),
  lastSyncAt: z.date().optional().nullable(),
  createdAt: z.date().default(() => new Date()),
  updatedAt: z.date().default(() => new Date()),
});
export type AccountingConnection = z.infer<typeof AccountingConnectionSchema>;

export const AccountingSyncLogSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  connectionId: z.string().uuid().optional().nullable(),
  syncType: z.enum(ACCOUNTING_SYNC_TYPES),
  entityId: z.string().uuid(),
  referenceNumber: z.string().min(1).max(64),
  externalPlatformId: z.string().optional().nullable(),
  externalSyncNumber: z.string().optional().nullable(),
  status: z.enum(ACCOUNTING_SYNC_STATUSES).default('PENDING'),
  amountCents: z.number().int().nonnegative(),
  currency: z.enum(['USD', 'CAD']).default('USD'),
  requestPayload: z.record(z.unknown()).optional().nullable(),
  responsePayload: z.record(z.unknown()).optional().nullable(),
  errorMessage: z.string().optional().nullable(),
  retryCount: z.number().int().nonnegative().default(0),
  syncedAt: z.date().optional().nullable(),
  createdAt: z.date().default(() => new Date()),
  updatedAt: z.date().default(() => new Date()),
});
export type AccountingSyncLog = z.infer<typeof AccountingSyncLogSchema>;

// ==============================================================================
// PHASE 4.6: BROKER GROSS MARGIN & COMMISSION CALCULATION
// ==============================================================================
export const COMMISSION_STATUSES = ['ACCRUED', 'APPROVED', 'PAID', 'CLAWED_BACK'] as const;
export type CommissionStatus = (typeof COMMISSION_STATUSES)[number];

export const SalesRepSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  name: z.string().min(1).max(128),
  email: z.string().email(),
  phone: z.string().optional().nullable(),
  defaultCommissionTierId: z.string().default('STANDARD_TIER'),
  baseCommissionPercent: z.number().nonnegative().default(10.0),
  monthlyProfitQuotaCents: z.number().int().nonnegative().default(1000000), // $10,000.00
  isActive: z.boolean().default(true),
  createdAt: z.date().default(() => new Date()),
  updatedAt: z.date().default(() => new Date()),
});
export type SalesRep = z.infer<typeof SalesRepSchema>;

export const CommissionRecordSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  shipmentId: z.string().uuid(),
  invoiceId: z.string().uuid().optional().nullable(),
  salesRepId: z.string().uuid(),
  customerInvoicedCents: z.number().int().nonnegative(),
  carrierSettlementCents: z.number().int().nonnegative(),
  realizedGrossProfitCents: z.number().int(),
  realizedMarginPercent: z.number(),
  appliedCommissionPercent: z.number().nonnegative(),
  commissionEarnedCents: z.number().int().nonnegative(),
  status: z.enum(COMMISSION_STATUSES).default('ACCRUED'),
  notes: z.string().optional().nullable(),
  paidAt: z.date().optional().nullable(),
  createdAt: z.date().default(() => new Date()),
  updatedAt: z.date().default(() => new Date()),
});
export type CommissionRecord = z.infer<typeof CommissionRecordSchema>;

// ==============================================================================
// PHASE 4.7: ACCOUNTS RECEIVABLE (AR) AGING & AUTOMATED DUNNING
// ==============================================================================
export const AR_AGING_BUCKETS = [
  'CURRENT',
  'PAST_DUE_1_30',
  'PAST_DUE_31_60',
  'PAST_DUE_61_90',
  'PAST_DUE_90_PLUS',
] as const;
export type ArAgingBucket = (typeof AR_AGING_BUCKETS)[number];

export const DUNNING_STAGES = [
  'REMINDER_T_MINUS_5',
  'DUE_TODAY_T_0',
  'PAST_DUE_T_PLUS_7',
  'URGENT_T_PLUS_14',
  'FINAL_DEMAND_T_PLUS_30',
] as const;
export type DunningStage = (typeof DUNNING_STAGES)[number];

export const DUNNING_STATUSES = ['QUEUED', 'DISPATCHED', 'FAILED', 'PAUSED_DISPUTE'] as const;
export type DunningStatus = (typeof DUNNING_STATUSES)[number];

export const DunningRecordSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  invoiceId: z.string().uuid(),
  customerAccountId: z.string().uuid().optional().nullable(),
  dunningStage: z.enum(DUNNING_STAGES),
  daysPastDue: z.number().int(),
  recipientEmail: z.string().email(),
  subject: z.string().min(1).max(255),
  bodySnippet: z.string().optional().nullable(),
  status: z.enum(DUNNING_STATUSES).default('DISPATCHED'),
  creditHoldTriggered: z.boolean().default(false),
  dispatchedAt: z.date().default(() => new Date()),
  createdAt: z.date().default(() => new Date()),
});
export type DunningRecord = z.infer<typeof DunningRecordSchema>;

// ==============================================================================
// PHASE 4.8: SETTLEMENT DOCUMENT VAULT & S3 WORM COMPLIANCE
// ==============================================================================
export const RETENTION_MODES = ['COMPLIANCE', 'GOVERNANCE'] as const;
export type RetentionMode = (typeof RETENTION_MODES)[number];

export const WormAuditPackageSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  shipmentId: z.string().uuid(),
  invoiceId: z.string().uuid().optional().nullable(),
  packageReference: z.string().min(1).max(64),
  bundleManifest: z.array(
    z.object({
      documentType: z.string(),
      documentName: z.string(),
      fileHashSha256: z.string(),
      sizeBytes: z.number().int().nonnegative(),
    })
  ),
  merkleRootHash: z.string().length(64),
  s3Bucket: z.string().min(1),
  s3ObjectKey: z.string().min(1),
  s3VersionId: z.string().optional().nullable(),
  retentionMode: z.enum(RETENTION_MODES).default('COMPLIANCE'),
  retainUntilDate: z.date(),
  isLegalHoldActive: z.boolean().default(false),
  sealedAt: z.date().default(() => new Date()),
  createdAt: z.date().default(() => new Date()),
});
export type WormAuditPackage = z.infer<typeof WormAuditPackageSchema>;
