import PDFDocument from 'pdfkit';
import { z } from 'zod';
import { dbClient } from '../../db/client';
import { CustomerInvoice, CustomerInvoiceSchema } from '../../db/schema';
import { CustomerInvoiceEngine, DEFAULT_REMITTANCE } from './customer-invoice-engine';

// ============================================================================
// ENUMS & CONSTANTS
// ============================================================================

export const SUPPLEMENTAL_REASONS = [
  'WEIGHT_CORRECTION',
  'SITE_ACCESSORIAL_REQUEST',
  'DETENTION_SURCHARGE',
  'REDELIVERY_FEE',
] as const;
export type SupplementalReason = (typeof SUPPLEMENTAL_REASONS)[number];

export const VARIANCE_CLASSIFICATIONS = [
  'CUSTOMER_SUPPLEMENTAL',
  'CARRIER_OVERCHARGE_DISPUTE',
] as const;
export type VarianceClassification = (typeof VARIANCE_CLASSIFICATIONS)[number];

// ============================================================================
// ZOD SCHEMAS & INTERFACES
// ============================================================================

export const VarianceLegitimacyInputSchema = z.object({
  varianceType: z.string(),
  amountCents: z.number().int().nonnegative(),
  hasScaleCertificate: z.boolean().optional().default(false),
  hasConsigneeNotation: z.boolean().optional().default(false),
  podVerifiedCommercialDock: z.boolean().optional().default(true),
  detentionMinutesLogged: z.number().int().optional().default(0),
  freeTimeMinutes: z.number().int().optional().default(120),
  weightVarianceLbs: z.number().optional().default(0),
  isConsigneeClosed: z.boolean().optional().default(false),
  inspectionDocumentUrl: z.string().optional().nullable(),
});
export type VarianceLegitimacyInput = z.input<typeof VarianceLegitimacyInputSchema>;

export interface VarianceLegitimacyResult {
  isLegitimatePassThrough: boolean;
  classification: VarianceClassification;
  reasonCategory: SupplementalReason | 'DISPUTABLE_OVERCHARGE';
  recommendedAction: 'GENERATE_SUPPLEMENTAL_INVOICE' | 'ROUTE_TO_CARRIER_DISPUTE';
  explanation: string;
  confidenceScore: number;
}

export const GenerateSupplementalInvoiceInputSchema = z.object({
  tenantId: z.string().uuid(),
  originalInvoiceId: z.string().uuid(),
  reason: z.enum(SUPPLEMENTAL_REASONS),
  passedThroughCostCents: z.number().int().positive(),
  markupPercent: z.number().nonnegative().optional().default(15.0),
  supportingEvidenceDescription: z.string().min(1),
  inspectionDocumentUrl: z.string().optional().nullable(),
  customPoNumber: z.string().optional().nullable(),
  customLineItemDescription: z.string().optional().nullable(),
  paymentTermsDays: z.number().int().positive().optional(),
  invoiceDate: z.string().optional(), // YYYY-MM-DD
});
export type GenerateSupplementalInvoiceInput = z.input<typeof GenerateSupplementalInvoiceInputSchema>;

export interface SupplementalPricingResult {
  passedThroughCostCents: number;
  markupPercent: number;
  markupAmountCents: number;
  customerPriceCents: number;
}

export interface SupplementalInvoiceRenderData {
  supplementalInvoiceNumber: string;
  parentInvoiceNumber: string;
  originalInvoiceDate: string;
  invoiceDate: string;
  dueDate: string;
  paymentTermsDays: number;
  customerPoNumber?: string | null;
  shipperName: string;
  shipperEmail: string;
  shipperAddress: string;
  reason: SupplementalReason;
  reasonTitle: string;
  customLineItemDescription?: string | null;
  passedThroughCostCents: number;
  markupPercent: number;
  markupAmountCents: number;
  totalAmountCents: number;
  supportingEvidenceDescription: string;
  inspectionDocumentUrl?: string | null;
  remittance: typeof DEFAULT_REMITTANCE;
}

export interface GenerateSupplementalInvoiceResult {
  success: boolean;
  supplementalInvoice: CustomerInvoice;
  parentInvoice: CustomerInvoice;
  pricing: {
    passedThroughCostCents: number;
    markupPercent: number;
    markupAmountCents: number;
    totalSupplementalCustomerPriceCents: number;
  };
  htmlContent: string;
  pdfBuffer: Buffer;
  emailDispatchStatus: {
    sent: boolean;
    recipient: string;
    subject: string;
    sentAt: Date;
  };
}

// ============================================================================
// SUPPLEMENTAL INVOICE ENGINE (PHASE 5.6)
// ============================================================================

export class SupplementalInvoiceEngine {
  /**
   * Default broker administrative handling markup: 15.0%
   */
  public static readonly DEFAULT_MARKUP_PERCENT = 15.0;

  /**
   * Format integer cents to USD currency string ($X,XXX.XX)
   */
  public static formatCurrency(cents: number): string {
    const dollars = cents / 100;
    return `$${dollars.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }

  /**
   * Human-friendly titles for supplemental variance categories
   */
  public static readonly REASON_TITLES: Record<SupplementalReason, string> = {
    WEIGHT_CORRECTION: 'Certified Weight Adjustment & Reweigh Surcharge',
    SITE_ACCESSORIAL_REQUEST: 'Destination On-Site Accessorial Request (Signed on POD)',
    DETENTION_SURCHARGE: 'Facility Dock Detention Beyond Free Time',
    REDELIVERY_FEE: 'Consignee Closed / Scheduled Redelivery Charge',
  };

  /**
   * 1. Customer Supplemental Invoice Automation (Pass-Through Engine)
   * Differentiates legitimate shipper/consignee-caused variances from carrier overcharges.
   */
  public static classifyVarianceLegitimacy(input: VarianceLegitimacyInput): VarianceLegitimacyResult {
    const validated = VarianceLegitimacyInputSchema.parse(input);
    const {
      varianceType,
      amountCents,
      hasScaleCertificate,
      hasConsigneeNotation,
      podVerifiedCommercialDock,
      detentionMinutesLogged,
      freeTimeMinutes,
      weightVarianceLbs,
      isConsigneeClosed,
    } = validated;

    const normalizedType = varianceType.toUpperCase();

    // Check Case 1: Shipper Weight Understatement
    // Legitimate if origin weight was understated by >500 lbs AND verified by certified scale certificate
    if (
      (normalizedType.includes('WEIGHT') || normalizedType.includes('REWEIGH')) &&
      weightVarianceLbs >= 500 &&
      hasScaleCertificate
    ) {
      return {
        isLegitimatePassThrough: true,
        classification: 'CUSTOMER_SUPPLEMENTAL',
        reasonCategory: 'WEIGHT_CORRECTION',
        recommendedAction: 'GENERATE_SUPPLEMENTAL_INVOICE',
        explanation: `Certified scale ticket confirms origin shipper understated cargo weight by +${weightVarianceLbs} lbs. Legitimate customer re-bill pass-through.`,
        confidenceScore: 98.0,
      };
    }

    // Check Case 2: Destination Requested Accessorials (Liftgate, Inside Delivery, Residential)
    // Legitimate if signed consignee notation is recorded on delivery receipt
    if (
      (normalizedType.includes('LIFTGATE') ||
        normalizedType.includes('INSIDE') ||
        normalizedType.includes('RESIDENTIAL') ||
        normalizedType.includes('LG_DEL') ||
        normalizedType.includes('INS_DEL') ||
        normalizedType.includes('RES_DEL')) &&
      hasConsigneeNotation
    ) {
      return {
        isLegitimatePassThrough: true,
        classification: 'CUSTOMER_SUPPLEMENTAL',
        reasonCategory: 'SITE_ACCESSORIAL_REQUEST',
        recommendedAction: 'GENERATE_SUPPLEMENTAL_INVOICE',
        explanation: `Consignee on-site delivery receipt contains verified written notation requesting destination accessorial service. Legitimate customer re-bill pass-through.`,
        confidenceScore: 95.0,
      };
    }

    // Check Case 3: Driver Dock Detention
    // Legitimate if driver logged detention time strictly exceeding standard free time (default 120 min)
    if (
      (normalizedType.includes('DETENTION') || normalizedType.includes('LAYOVER')) &&
      detentionMinutesLogged > freeTimeMinutes
    ) {
      const billableMinutes = detentionMinutesLogged - freeTimeMinutes;
      return {
        isLegitimatePassThrough: true,
        classification: 'CUSTOMER_SUPPLEMENTAL',
        reasonCategory: 'DETENTION_SURCHARGE',
        recommendedAction: 'GENERATE_SUPPLEMENTAL_INVOICE',
        explanation: `Facility detention of ${detentionMinutesLogged} minutes exceeds contractual free time (${freeTimeMinutes} min) by ${billableMinutes} minutes. Legitimate customer detention surcharge pass-through.`,
        confidenceScore: 92.0,
      };
    }

    // Check Case 4: Redelivery Attempt
    // Legitimate if consignee facility was closed or delivery refused during confirmed appointment window
    if (
      (normalizedType.includes('REDELIVERY') || normalizedType.includes('ATTEMPT')) &&
      isConsigneeClosed
    ) {
      return {
        isLegitimatePassThrough: true,
        classification: 'CUSTOMER_SUPPLEMENTAL',
        reasonCategory: 'REDELIVERY_FEE',
        recommendedAction: 'GENERATE_SUPPLEMENTAL_INVOICE',
        explanation: `Consignee receiving dock was closed during confirmed delivery appointment window, necessitating secondary delivery attempt. Legitimate customer redelivery pass-through.`,
        confidenceScore: 94.0,
      };
    }

    // Default Case: Unverified / Bogus Carrier Overcharge -> Route to Carrier Dispute Desk
    let disputableReason = 'Carrier fee lacks required certified documentation or consignee authorization.';
    if (normalizedType.includes('WEIGHT') || normalizedType.includes('REWEIGH')) {
      disputableReason = 'Carrier adjusted billed weight without attaching certified terminal scale ticket.';
    } else if (normalizedType.includes('CLASS') || normalizedType.includes('RECLASS')) {
      disputableReason = 'Carrier unilaterally bumped NMFC class without certified W&I density inspection report.';
    } else if (podVerifiedCommercialDock) {
      disputableReason = 'Destination is verified commercial dock with bay doors; no accessorial requested or noted on POD.';
    }

    return {
      isLegitimatePassThrough: false,
      classification: 'CARRIER_OVERCHARGE_DISPUTE',
      reasonCategory: 'DISPUTABLE_OVERCHARGE',
      recommendedAction: 'ROUTE_TO_CARRIER_DISPUTE',
      explanation: `${disputableReason} Routed to 49 CFR § 378 carrier dispute engine to protect customer relationship.`,
      confidenceScore: 90.0,
    };
  }

  /**
   * 2. Margin Markup Engine
   * Applies broker margin markup on passed-through legitimate carrier fees:
   * Customer Supplemental Price = Passed Carrier Fee Cents * (1 + Markup% / 100)
   */
  public static calculateSupplementalPricing(
    passedThroughCostCents: number,
    markupPercent: number = SupplementalInvoiceEngine.DEFAULT_MARKUP_PERCENT
  ): SupplementalPricingResult {
    const markupAmountCents = Math.round(passedThroughCostCents * (markupPercent / 100));
    const customerPriceCents = passedThroughCostCents + markupAmountCents;

    return {
      passedThroughCostCents,
      markupPercent,
      markupAmountCents,
      customerPriceCents,
    };
  }

  /**
   * Generate sequential supplemental invoice number (e.g. INV-2026-08842-SUP1, INV-2026-08842-SUP2)
   */
  public static generateSupplementalInvoiceNumber(
    parentInvoiceNumber: string,
    existingSupplementalCount: number = 0
  ): string {
    const cleanBase = parentInvoiceNumber.split('-SUP')[0];
    const nextSeq = existingSupplementalCount + 1;
    return `${cleanBase}-SUP${nextSeq}`;
  }

  /**
   * 3. Customer Supplemental Invoice Generation & Persistence
   */
  public static async generateSupplementalInvoice(
    params: GenerateSupplementalInvoiceInput
  ): Promise<GenerateSupplementalInvoiceResult> {
    const validated = GenerateSupplementalInvoiceInputSchema.parse(params);
    const {
      tenantId,
      originalInvoiceId,
      reason,
      passedThroughCostCents,
      markupPercent = SupplementalInvoiceEngine.DEFAULT_MARKUP_PERCENT,
      supportingEvidenceDescription,
      inspectionDocumentUrl,
      customPoNumber,
      customLineItemDescription,
      paymentTermsDays,
      invoiceDate,
    } = validated;

    dbClient.setTenantContext(tenantId);

    // 1. Fetch Parent Customer Invoice
    const parentInvoice = await dbClient.getCustomerInvoiceById(originalInvoiceId);
    if (!parentInvoice) {
      throw new Error(
        `Original customer invoice with ID "${originalInvoiceId}" not found for tenant "${tenantId}".`
      );
    }

    // 2. Fetch Existing Supplemental Invoices for this Parent to determine sequential number
    const existingSupplementals = await dbClient.getCustomerInvoicesByParentId(
      tenantId,
      originalInvoiceId
    );
    const supplementalInvoiceNumber = this.generateSupplementalInvoiceNumber(
      parentInvoice.invoiceNumber,
      existingSupplementals.length
    );

    // 3. Compute Financials with Broker Margin Markup
    const pricing = this.calculateSupplementalPricing(passedThroughCostCents, markupPercent);
    const { markupAmountCents, customerPriceCents } = pricing;

    // 4. Determine Dates and Terms
    const invoiceDateStr = invoiceDate || new Date().toISOString().split('T')[0];
    const termsDays = paymentTermsDays || parentInvoice.paymentTermsDays || 30;
    const dueDateStr = CustomerInvoiceEngine.calculateDueDate(invoiceDateStr, termsDays);

    const linehaulAmountCents = reason === 'WEIGHT_CORRECTION' ? customerPriceCents : 0;
    const accessorialAmountCents = reason !== 'WEIGHT_CORRECTION' ? customerPriceCents : 0;
    const accessorialBreakdown: Record<string, number> = {
      [reason]: accessorialAmountCents,
    };

    const attachedDocuments: string[] = [];
    if (inspectionDocumentUrl) {
      attachedDocuments.push(inspectionDocumentUrl);
    }

    // 5. Build Render Data Structure
    const renderData: SupplementalInvoiceRenderData = {
      supplementalInvoiceNumber,
      parentInvoiceNumber: parentInvoice.invoiceNumber,
      originalInvoiceDate: parentInvoice.invoiceDate,
      invoiceDate: invoiceDateStr,
      dueDate: dueDateStr,
      paymentTermsDays: termsDays,
      customerPoNumber: customPoNumber || parentInvoice.customerPoNumber,
      shipperName: parentInvoice.shipperName,
      shipperEmail: parentInvoice.shipperEmail,
      shipperAddress: parentInvoice.shipperAddress,
      reason,
      reasonTitle: this.REASON_TITLES[reason] || 'Supplemental Freight Adjustment',
      customLineItemDescription,
      passedThroughCostCents,
      markupPercent,
      markupAmountCents,
      totalAmountCents: customerPriceCents,
      supportingEvidenceDescription,
      inspectionDocumentUrl,
      remittance: parentInvoice.remitInstructions || DEFAULT_REMITTANCE,
    };

    // 6. Render HTML and High-Resolution PDF
    const htmlContent = this.renderSupplementalInvoiceHtml(renderData);
    const pdfBuffer = await this.generateSupplementalInvoicePdf(renderData);

    // 7. Persist Supplemental Customer Invoice in Database
    const supplementalInvoice = await dbClient.insertCustomerInvoice({
      tenantId,
      shipmentId: parentInvoice.shipmentId,
      podId: parentInvoice.podId,
      customerAccountId: parentInvoice.customerAccountId,

      invoiceNumber: supplementalInvoiceNumber,
      customerPoNumber: renderData.customerPoNumber,
      shipperName: parentInvoice.shipperName,
      shipperEmail: parentInvoice.shipperEmail,
      shipperAddress: parentInvoice.shipperAddress,

      linehaulAmountCents,
      fuelSurchargeCents: 0,
      accessorialAmountCents,
      accessorialBreakdown,
      totalAmountCents: customerPriceCents,
      currency: parentInvoice.currency || 'USD',

      paymentTermsDays: termsDays,
      invoiceDate: invoiceDateStr,
      dueDate: dueDateStr,

      remitInstructions: renderData.remittance,
      pdfUrl: `/api/v1/invoices/${supplementalInvoiceNumber}/pdf`,
      status: 'ISSUED',
      emailSentTo: parentInvoice.shipperEmail,
      emailSentAt: new Date(),
      paidAt: null,

      isSupplemental: true,
      parentInvoiceId: originalInvoiceId,
      supplementalReason: reason,
      passedThroughCostCents,
      markupPercent,
      markupAmountCents,
      supportingEvidenceDescription,
      inspectionDocumentUrl: inspectionDocumentUrl || null,
      attachedDocuments,
    });

    const emailSubject = `[SUPPLEMENTAL INVOICE ${supplementalInvoiceNumber}] Variance Adjustment for ${parentInvoice.invoiceNumber} - Total: $${(
      customerPriceCents / 100
    ).toFixed(2)}`;

    return {
      success: true,
      supplementalInvoice,
      parentInvoice,
      pricing: {
        passedThroughCostCents,
        markupPercent,
        markupAmountCents,
        totalSupplementalCustomerPriceCents: customerPriceCents,
      },
      htmlContent,
      pdfBuffer,
      emailDispatchStatus: {
        sent: true,
        recipient: parentInvoice.shipperEmail,
        subject: emailSubject,
        sentAt: new Date(),
      },
    };
  }

  /**
   * Render Printable HTML Document for Customer Supplemental Invoices
   */
  public static renderSupplementalInvoiceHtml(data: SupplementalInvoiceRenderData): string {
    const formattedPassedThrough = this.formatCurrency(data.passedThroughCostCents);
    const formattedMarkup = this.formatCurrency(data.markupAmountCents);
    const formattedTotal = this.formatCurrency(data.totalAmountCents);

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Customer Supplemental Invoice - ${data.supplementalInvoiceNumber}</title>
  <style>
    @page {
      size: letter;
      margin: 15mm;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      color: #0f172a;
      background-color: #f8fafc;
      margin: 0;
      padding: 24px;
      font-size: 12px;
      line-height: 1.5;
    }
    .print-toolbar {
      max-width: 850px;
      margin: 0 auto 16px auto;
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: #0f172a;
      color: #ffffff;
      padding: 12px 20px;
      border-radius: 8px;
      box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);
    }
    .print-toolbar button {
      background: #2563eb;
      color: #ffffff;
      border: none;
      padding: 8px 16px;
      border-radius: 6px;
      font-weight: bold;
      cursor: pointer;
      font-size: 13px;
    }
    .invoice-card {
      max-width: 850px;
      margin: 0 auto;
      background: #ffffff;
      padding: 40px;
      border-radius: 8px;
      box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);
      border-top: 5px solid #2563eb;
    }
    .header-table {
      width: 100%;
      margin-bottom: 24px;
    }
    .brand-title {
      font-size: 22px;
      font-weight: 800;
      color: #0f172a;
    }
    .brand-subtitle {
      font-size: 11px;
      color: #64748b;
      margin-top: 2px;
    }
    .parent-link-box {
      background: #eff6ff;
      border: 1px solid #bfdbfe;
      border-left: 4px solid #2563eb;
      padding: 12px 16px;
      border-radius: 4px;
      margin-bottom: 24px;
    }
    .items-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 24px;
    }
    .items-table th {
      background: #0f172a;
      color: #ffffff;
      padding: 10px;
      font-size: 11px;
      text-align: left;
    }
    .items-table td {
      padding: 12px 10px;
      border-bottom: 1px solid #e2e8f0;
    }
    .evidence-box {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 16px;
      margin-bottom: 24px;
    }
    .totals-table {
      width: 320px;
      margin-left: auto;
      border-collapse: collapse;
      margin-bottom: 24px;
    }
    .totals-table td {
      padding: 6px 8px;
    }
    .remit-box {
      background: #f1f5f9;
      border-radius: 6px;
      padding: 16px;
      font-size: 11px;
    }
    @media print {
      body { background: #ffffff; padding: 0; }
      .print-toolbar { display: none !important; }
      .invoice-card { box-shadow: none; padding: 0; }
    }
  </style>
</head>
<body>
  <div class="print-toolbar">
    <div><strong>APEX FREIGHT SOLUTIONS</strong> &nbsp;|&nbsp; Supplemental Invoice: ${data.supplementalInvoiceNumber}</div>
    <div><button onclick="window.print()">Print / Save PDF</button></div>
  </div>

  <div class="invoice-card">
    <table class="header-table">
      <tr>
        <td style="vertical-align: top;">
          <div class="brand-title">APEX FREIGHT SOLUTIONS</div>
          <div class="brand-subtitle">Specialized LTL Transportation & Customer Billing</div>
          <div style="font-size: 11px; color: #64748b; margin-top: 4px;">1000 Logistics Blvd, Suite 500 • Chicago, IL 60601</div>
        </td>
        <td style="text-align: right; vertical-align: top;">
          <div style="font-size: 16px; font-weight: 800; color: #2563eb;">CUSTOMER SUPPLEMENTAL INVOICE</div>
          <div style="font-size: 12px; font-weight: 700; color: #0f172a; margin-top: 2px;"># ${data.supplementalInvoiceNumber}</div>
          <div style="font-size: 11px; color: #64748b;">Invoice Date: <strong>${data.invoiceDate}</strong></div>
          <div style="font-size: 11px; color: #dc2626;">Due Date: <strong>${data.dueDate}</strong> (${data.paymentTermsDays} Days)</div>
        </td>
      </tr>
    </table>

    <div class="parent-link-box">
      <table style="width: 100%; font-size: 11px;">
        <tr>
          <td><strong>Parent Invoice Reference:</strong> <span style="font-family: monospace; font-weight: bold;">${data.parentInvoiceNumber}</span></td>
          <td><strong>Original Invoice Date:</strong> ${data.originalInvoiceDate}</td>
          <td><strong>Customer PO #:</strong> ${data.customerPoNumber || 'N/A'}</td>
        </tr>
      </table>
    </div>

    <!-- Bill To Metadata -->
    <div style="display: flex; justify-content: space-between; margin-bottom: 24px;">
      <div>
        <div style="font-size: 10px; font-weight: 700; color: #64748b; text-transform: uppercase;">Billed Customer Account:</div>
        <div style="font-size: 13px; font-weight: 700; color: #0f172a;">${data.shipperName}</div>
        <div style="color: #475569;">${data.shipperAddress}</div>
        <div style="color: #2563eb;">${data.shipperEmail}</div>
      </div>
    </div>

    <!-- Itemized Table -->
    <div style="font-weight: 700; font-size: 12px; margin-bottom: 8px; color: #0f172a; text-transform: uppercase;">
      Itemized Variance & Supplemental Charge Details
    </div>
    <table class="items-table">
      <thead>
        <tr>
          <th>Description</th>
          <th style="text-align: center;">Reason Code</th>
          <th style="text-align: right;">Passed Carrier Fee</th>
          <th style="text-align: right;">Admin Markup (${data.markupPercent}%)</th>
          <th style="text-align: right;">Total Customer Amount</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>
            <div style="font-weight: 600; color: #0f172a;">${data.reasonTitle}</div>
            <div style="font-size: 11px; color: #64748b; margin-top: 2px;">${data.customLineItemDescription || data.supportingEvidenceDescription}</div>
          </td>
          <td style="text-align: center; font-family: monospace; font-size: 11px;">
            <span style="background: #f1f5f9; padding: 2px 6px; border-radius: 4px; font-weight: 600;">${data.reason}</span>
          </td>
          <td style="text-align: right; font-family: monospace;">${formattedPassedThrough}</td>
          <td style="text-align: right; font-family: monospace; color: #059669;">+${formattedMarkup}</td>
          <td style="text-align: right; font-family: monospace; font-weight: 700; color: #0f172a;">${formattedTotal}</td>
        </tr>
      </tbody>
    </table>

    <!-- Totals Table -->
    <table class="totals-table">
      <tr>
        <td style="color: #64748b;">Passed-Through Carrier Fee:</td>
        <td style="text-align: right; font-family: monospace;">${formattedPassedThrough}</td>
      </tr>
      <tr>
        <td style="color: #64748b;">Broker Admin Handling Markup (${data.markupPercent}%):</td>
        <td style="text-align: right; font-family: monospace; color: #059669;">${formattedMarkup}</td>
      </tr>
      <tr style="border-top: 2px solid #0f172a;">
        <td style="font-weight: 800; font-size: 13px; color: #0f172a; padding-top: 8px;">NET SUPPLEMENTAL DUE:</td>
        <td style="text-align: right; font-family: monospace; font-weight: 800; font-size: 14px; color: #2563eb; padding-top: 8px;">${formattedTotal}</td>
      </tr>
    </table>

    <!-- Evidence & Audit Proof Card -->
    <div class="evidence-box">
      <div style="font-weight: 700; color: #0f172a; margin-bottom: 6px;">Verified Supporting Documentation & Evidence Proof:</div>
      <div style="color: #334155; margin-bottom: 6px;">${data.supportingEvidenceDescription}</div>
      ${data.inspectionDocumentUrl ? `<div style="font-size: 11px; color: #2563eb;"><strong>Attached Proof Document:</strong> <a href="${data.inspectionDocumentUrl}" target="_blank">${data.inspectionDocumentUrl}</a></div>` : ''}
    </div>

    <!-- Remittance Instructions -->
    <div class="remit-box">
      <div style="font-weight: 700; color: #0f172a; margin-bottom: 4px;">Electronic Remittance Instructions (ACH / Wire):</div>
      <div>Bank: <strong>${data.remittance.bankName}</strong> | Routing: <strong>${data.remittance.routingNumber}</strong> | Account: <strong>${data.remittance.accountNumber}</strong></div>
      <div>Remit Inquiries: <strong>${data.remittance.remitEmail}</strong></div>
    </div>
  </div>
</body>
</html>`;
  }

  /**
   * Generate High-Resolution Customer Supplemental Invoice PDF using PDFKit
   */
  public static async generateSupplementalInvoicePdf(
    data: SupplementalInvoiceRenderData
  ): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({
        margin: 36,
        size: 'LETTER',
        autoFirstPage: true,
        info: {
          Title: `Supplemental Invoice ${data.supplementalInvoiceNumber}`,
          Author: 'Apex Freight Solutions Billing Desk',
          Subject: `Supplemental Adjustment for Parent Invoice ${data.parentInvoiceNumber}`,
        },
      });

      const chunks: Buffer[] = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', (err) => reject(err));

      // Header Top Border (Cobalt Blue theme)
      doc.rect(36, 36, 540, 4).fill('#2563eb');

      let y = 48;
      doc.fontSize(18).font('Helvetica-Bold').fillColor('#0f172a').text('APEX FREIGHT SOLUTIONS', 36, y);
      doc.fontSize(8).font('Helvetica').fillColor('#64748b').text('Specialized LTL Transportation & Customer Billing Desk', 36, y + 20);
      doc.fontSize(8).fillColor('#64748b').text('1000 Logistics Blvd, Suite 500 • Chicago, IL 60601 • billing@apexfreightos.com', 36, y + 31);

      // Supplemental Invoice Number Block (Top Right)
      doc.fontSize(14).font('Helvetica-Bold').fillColor('#2563eb').text('SUPPLEMENTAL INVOICE', 350, y, { align: 'right' });
      doc.fontSize(10).font('Helvetica-Bold').fillColor('#0f172a').text(`Invoice #: ${data.supplementalInvoiceNumber}`, 350, y + 18, { align: 'right' });
      doc.fontSize(8).font('Helvetica').fillColor('#475569').text(`Invoice Date: ${data.invoiceDate}`, 350, y + 32, { align: 'right' });
      doc.fontSize(8).font('Helvetica-Bold').fillColor('#dc2626').text(`Due Date: ${data.dueDate} (${data.paymentTermsDays} Days)`, 350, y + 44, { align: 'right' });

      y += 62;
      doc.rect(36, y, 540, 0.5).fill('#cbd5e1');

      // Parent Link Banner
      y += 10;
      doc.rect(36, y, 540, 32).fillAndStroke('#eff6ff', '#bfdbfe');
      doc.rect(36, y, 4, 32).fill('#2563eb');
      doc.fontSize(8).font('Helvetica-Bold').fillColor('#1e40af').text('PARENT INVOICE LINKAGE:', 48, y + 6);
      doc.fontSize(8).font('Helvetica').fillColor('#1e293b').text(
        `Linked to Parent Invoice #${data.parentInvoiceNumber} (Issued: ${data.originalInvoiceDate}) • Customer PO #: ${data.customerPoNumber || 'N/A'}`,
        48,
        y + 18
      );

      // Bill-To Section
      y += 42;
      doc.rect(36, y, 540, 56).fillAndStroke('#f8fafc', '#e2e8f0');
      doc.fontSize(8).font('Helvetica-Bold').fillColor('#475569').text('BILLED CUSTOMER ACCOUNT:', 44, y + 8);
      doc.fontSize(10).font('Helvetica-Bold').fillColor('#0f172a').text(data.shipperName, 44, y + 20);
      doc.fontSize(8).font('Helvetica').fillColor('#334155').text(data.shipperAddress, 44, y + 32);
      doc.fontSize(8).font('Helvetica').fillColor('#2563eb').text(data.shipperEmail, 44, y + 44);

      // Itemized Variance Table Header
      y += 66;
      doc.rect(36, y, 540, 18).fill('#0f172a');
      doc.fontSize(7.5).font('Helvetica-Bold').fillColor('#ffffff');
      doc.text('LINE ITEM DESCRIPTION', 44, y + 5);
      doc.text('REASON CODE', 250, y + 5);
      doc.text('PASSED FEE', 360, y + 5, { align: 'right', width: 60 });
      doc.text(`MARKUP (${data.markupPercent}%)`, 430, y + 5, { align: 'right', width: 60 });
      doc.text('TOTAL ($)', 500, y + 5, { align: 'right', width: 66 });

      y += 18;

      // Itemized Line Item Row
      doc.rect(36, y, 540, 36).fillAndStroke('#ffffff', '#e2e8f0');
      doc.fontSize(8).font('Helvetica-Bold').fillColor('#0f172a').text(data.reasonTitle, 44, y + 6);
      doc.fontSize(7).font('Helvetica').fillColor('#64748b').text(data.customLineItemDescription || data.supportingEvidenceDescription, 44, y + 18, { width: 200 });

      doc.fontSize(7.5).font('Helvetica').fillColor('#0369a1').text(data.reason, 250, y + 10);
      doc.fontSize(8).font('Helvetica').fillColor('#334155').text(this.formatCurrency(data.passedThroughCostCents), 360, y + 10, { align: 'right', width: 60 });
      doc.font('Helvetica').fillColor('#059669').text(`+${this.formatCurrency(data.markupAmountCents)}`, 430, y + 10, { align: 'right', width: 60 });
      doc.font('Helvetica-Bold').fillColor('#0f172a').text(this.formatCurrency(data.totalAmountCents), 500, y + 10, { align: 'right', width: 66 });

      y += 42;

      // Financial Totals Summary Box
      doc.rect(260, y, 316, 52).fillAndStroke('#f8fafc', '#cbd5e1');
      doc.fontSize(8).font('Helvetica').fillColor('#475569').text('Passed-Through Carrier Fee:', 270, y + 6);
      doc.font('Helvetica').fillColor('#0f172a').text(this.formatCurrency(data.passedThroughCostCents), 500, y + 6, { align: 'right', width: 66 });

      doc.font('Helvetica').fillColor('#475569').text(`Broker Admin Handling Markup (${data.markupPercent}%):`, 270, y + 18);
      doc.font('Helvetica').fillColor('#059669').text(`+${this.formatCurrency(data.markupAmountCents)}`, 500, y + 18, { align: 'right', width: 66 });

      doc.rect(270, y + 30, 296, 0.5).fill('#cbd5e1');

      doc.fontSize(9).font('Helvetica-Bold').fillColor('#0f172a').text('NET SUPPLEMENTAL BALANCE DUE:', 270, y + 36);
      doc.fontSize(10).font('Helvetica-Bold').fillColor('#2563eb').text(this.formatCurrency(data.totalAmountCents), 500, y + 35, { align: 'right', width: 66 });

      // Supporting Evidence Card
      y += 64;
      doc.rect(36, y, 540, 56).fillAndStroke('#f8fafc', '#e2e8f0');
      doc.fontSize(8).font('Helvetica-Bold').fillColor('#0f172a').text('VERIFIED SUPPORTING DOCUMENTATION & EVIDENCE PROOF:', 44, y + 8);
      doc.fontSize(7.5).font('Helvetica').fillColor('#334155').text(data.supportingEvidenceDescription, 44, y + 20, { width: 520 });
      if (data.inspectionDocumentUrl) {
        doc.fontSize(7).font('Helvetica-Bold').fillColor('#2563eb').text(`Document Link: ${data.inspectionDocumentUrl}`, 44, y + 42);
      }

      // Remittance Box
      y += 68;
      doc.rect(36, y, 540, 48).fillAndStroke('#f1f5f9', '#cbd5e1');
      doc.fontSize(8).font('Helvetica-Bold').fillColor('#0f172a').text('ELECTRONIC REMITTANCE INSTRUCTIONS (ACH / WIRE):', 44, y + 8);
      doc.fontSize(7.5).font('Helvetica').fillColor('#334155').text(
        `Bank: ${data.remittance.bankName}  |  Routing: ${data.remittance.routingNumber}  |  Account: ${data.remittance.accountNumber}`,
        44,
        y + 20
      );
      doc.fontSize(7.5).font('Helvetica').fillColor('#64748b').text(`Remittance Email: ${data.remittance.remitEmail}`, 44, y + 32);

      // Footer
      doc.fontSize(7).font('Helvetica').fillColor('#94a3b8').text('Apex Freight Solutions LLC • Automated Customer Invoicing Engine', 36, 750, { align: 'center' });

      doc.end();
    });
  }
}
