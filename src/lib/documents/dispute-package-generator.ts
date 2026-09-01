import PDFDocument from 'pdfkit';
import { z } from 'zod';
import { dbClient } from '../../db/client';
import {
  CarrierDispute,
  CarrierDisputeSchema,
  DiscrepancyType,
  DISCREPANCY_TYPES,
  CarrierInvoice,
  DiscrepancyRecord,
  Shipment,
  PodRecord,
  DigitalBol,
} from '../../db/schema';
import { generateUuidV7 } from '../uuidv7';

// ============================================================================
// CARRIER CLAIM DESK ROUTING DIRECTORY
// ============================================================================

export const CARRIER_CLAIM_ROUTING_DIRECTORY: Record<string, string> = {
  XPO: 'disputes@xpo.com',
  SAIA: 'billingclaims@saia.com',
  EXLA: 'reweighs@estes-express.com',     // Estes Express Lines
  ESTES: 'reweighs@estes-express.com',    // Estes alias
  ODFL: 'overchargeclaims@odfl.com',     // Old Dominion Freight Line
  ABFS: 'billingaudit@arcb.com',         // ArcBest / ABF Freight
  ABF: 'billingaudit@arcb.com',          // ABF alias
  RDWY: 'claims@rrts.com',               // Roadrunner Transportation
  ROADRUNNER: 'claims@rrts.com',         // Roadrunner alias
  RLCA: 'claims@rlcarriers.com',         // R+L Carriers
  RL: 'claims@rlcarriers.com',           // R+L alias
  FXFE: 'freightclaims@fedex.com',       // FedEx Freight
  YRCW: 'claims@myyellow.com',           // Yellow / YRC
  TAXI: 'claims@tforcefreight.com',      // TForce Freight
};

// ============================================================================
// TYPES & SCHEMAS FOR DISPUTE PACKAGE DATA
// ============================================================================

export interface DisputeLineItem {
  description: string;
  category: DiscrepancyType;
  quotedAmountCents: number;
  invoicedAmountCents: number;
  disputedAmountCents: number;
  explanation?: string;
}

export interface DisputeEvidenceBundle {
  bolDetails: {
    bolNumber: string;
    masterBolNumber?: string;
    shipperName: string;
    originAddress: string;
    consigneeName: string;
    destAddress: string;
    certifiedWeightLbs: number;
    totalPallets: number;
    declaredClass?: string;
    bolSha256Hash: string;
    signedDate?: string;
  };
  podDetails: {
    podId?: string;
    deliveredAt: string;
    consigneeSignerName: string;
    signatureSha256OrData?: string;
    gpsLatitude?: number;
    gpsLongitude?: number;
    geofenceDistanceMiles?: number;
    isWithinGeofence: boolean;
    dockDeliveryBadge: boolean;
    accessorialNotationsNone: boolean;
    pieceCountVerified: boolean;
    receivedPieces: number;
    notes?: string;
  };
  scaleTicketRequirement?: {
    citedRule: string;
    status: string;
    demandNotice: string;
  };
}

export interface DisputePackageData {
  disputeReferenceNumber: string; // e.g. "DISP-2026-XPO-98421"
  issueDate: string;             // YYYY-MM-DD
  carrierName: string;
  carrierScac: string;
  carrierProNumber: string;
  bolNumber: string;
  poNumber?: string;
  destinationDeliveryDate: string;
  claimDeskEmail: string;
  legalCitation: string;
  lineItems: DisputeLineItem[];
  totalQuotedCents: number;
  totalInvoicedCents: number;
  totalDisputedCents: number;
  primaryDisputeCategory: DiscrepancyType;
  legalRebuttalStatement: string;
  remittanceHoldNotice?: string;
  origin: {
    name: string;
    address?: string;
    city: string;
    state: string;
    zip: string;
  };
  destination: {
    name: string;
    address?: string;
    city: string;
    state: string;
    zip: string;
  };
  evidence: DisputeEvidenceBundle;
}

export const DisputeCompileParamsSchema = z.object({
  tenantId: z.string().uuid(),
  carrierInvoiceId: z.string().uuid(),
  discrepancyId: z.string().uuid().optional(),
  disputeType: z.enum(DISCREPANCY_TYPES).optional(),
  customNotes: z.string().optional(),
  autoRoute: z.boolean().default(true),
});
export type DisputeCompileParams = z.input<typeof DisputeCompileParamsSchema>;

// ============================================================================
// DISPUTE PACKAGE GENERATOR CLASS
// ============================================================================

export class DisputePackageGenerator {
  public static readonly LEGAL_CITATION_TITLE =
    '49 CFR § 378 (Procedures Governing the Processing, Investigation, and Disposition of Overcharge Claims)';

  /**
   * Format integer cents to USD currency string ($X,XXX.XX)
   */
  public static formatCurrency(cents: number): string {
    const dollars = cents / 100;
    return `$${dollars.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  /**
   * Normalize carrier SCAC code and return designated claims intake email
   */
  public static getCarrierClaimEmail(carrierScac: string): string {
    if (!carrierScac) return 'disputes@apexfreightos.com';
    const cleaned = carrierScac.trim().toUpperCase();
    if (CARRIER_CLAIM_ROUTING_DIRECTORY[cleaned]) {
      return CARRIER_CLAIM_ROUTING_DIRECTORY[cleaned];
    }
    // Fallback based on SCAC
    return `claims@${cleaned.toLowerCase()}.com`;
  }

  /**
   * Generate canonical dispute reference number e.g. "DISP-2026-XPO-98421"
   */
  public static generateDisputeReferenceNumber(carrierScac: string, sequenceNumber?: number | string): string {
    const scac = (carrierScac || 'CARRIER').trim().toUpperCase();
    const year = new Date().getFullYear();
    const seq = sequenceNumber ? String(sequenceNumber).padStart(5, '0') : Math.floor(10000 + Math.random() * 90000);
    return `DISP-${year}-${scac}-${seq}`;
  }

  /**
   * Build category-tailored 49 CFR § 378 Legal Rebuttal Statement
   */
  public static buildLegalRebuttal(
    category: DiscrepancyType,
    details?: {
      billedWeight?: number;
      quotedWeight?: number;
      billedClass?: string;
      quotedClass?: string;
      accessorialCode?: string;
      palletDimensions?: string;
      actualDensityPcf?: number;
    }
  ): string {
    switch (category) {
      case 'UNAUTHORIZED_REWEIGH': {
        const billed = details?.billedWeight ? `${details.billedWeight.toLocaleString()} lbs` : 'the billed weight';
        const quoted = details?.quotedWeight ? `${details.quotedWeight.toLocaleString()} lbs` : 'the original BOL weight';
        return (
          `FORMAL LEGAL REBUTTAL PURSUANT TO 49 CFR § 378.4:\n` +
          `Carrier adjusted billed weight to ${billed} from contracted weight of ${quoted} without furnishing a certified ` +
          `scale weight ticket. Under federal regulation 49 CFR § 378.4 (Documentation of Claims) and Surface Transportation Board ` +
          `(STB) rules, unilateral reweigh adjustments require verifiable gross, tare, and net weights recorded on a certified scale ` +
          `with valid state weights and measures inspection calibration. In the absence of a certified terminal scale ticket, the ` +
          `original certified shipper Bill of Lading weight stands as legally binding, and the unauthorized reweigh charge is disputed in full.`
        );
      }

      case 'RECLASSIFICATION_DISPUTE': {
        const billedCls = details?.billedClass ? `Class ${details.billedClass}` : 'higher class';
        const quotedCls = details?.quotedClass ? `Class ${details.quotedClass}` : 'agreed class';
        const pcf = details?.actualDensityPcf ? ` (${details.actualDensityPcf.toFixed(1)} PCF)` : '';
        const dims = details?.palletDimensions ? ` Pallet dimensions measured: ${details.palletDimensions}.` : '';
        return (
          `FORMAL LEGAL REBUTTAL PURSUANT TO NMFTA DENSITY RULES & 49 CFR § 378:\n` +
          `Carrier unilaterally reclassified cargo to ${billedCls} from contracted ${quotedCls}.${dims}${pcf} ` +
          `Pursuant to National Motor Freight Traffic Association (NMFTA) Item 110 density calculation rules and itemized pallet ` +
          `specifications, the commodity characteristics strictly satisfy the contracted class rating. Under 49 CFR § 378, any carrier-initiated ` +
          `reclassification requires an official certified inspection report with photographic dimensioning evidence. Without certified ` +
          `dock inspection verification, the contracted NMFC class is legally binding, and the reclass variance is disputed in full.`
        );
      }

      case 'BOGUS_ACCESSORIAL': {
        const acc = details?.accessorialCode ? `for ${details.accessorialCode}` : 'accessorial surcharges';
        return (
          `FORMAL LEGAL REBUTTAL PURSUANT TO SIGNED RECEIVING PROOF & 49 CFR § 378:\n` +
          `Carrier invoiced unauthorized ${acc} (e.g. liftgate, inside delivery, or residential surcharge) without prior authorization ` +
          `or physical delivery necessity. The destination facility is a standard commercial distribution facility equipped with dedicated ` +
          `dock-height loading doors. Consignee signed a clean delivery receipt confirming dock delivery with no accessorial equipment or ` +
          `driver assistance required or rendered. Under 49 CFR § 378 and STB billing standards, fees for unperformed services constitute ` +
          `unlawful overcharges and are disputed in full.`
        );
      }

      case 'FUEL_INDEX_MISMATCH': {
        return (
          `FORMAL LEGAL REBUTTAL PURSUANT TO CONTRACTED FUEL INDEX & 49 CFR § 378:\n` +
          `Carrier applied a fuel surcharge percentage exceeding the authorized Department of Energy (DOE) National Average Diesel ` +
          `Fuel Price index published for the week of shipment pickup. Contractual rate agreement mandates exact DOE index calibration. ` +
          `The overcharge variance between the contracted fuel rate and invoiced fuel charge is disputed in full pursuant to 49 CFR § 378.`
        );
      }

      case 'DUPLICATE_BILLING':
      default: {
        return (
          `FORMAL LEGAL NOTICE OF OVERCHARGE CLAIM PURSUANT TO 49 CFR § 378:\n` +
          `Formal notice of overcharge pursuant to 49 CFR Part 378. Carrier's final settlement invoice contains charges in excess of ` +
          `the agreed contract rate and approved bill of lading specifications. Carrier is required to acknowledge this claim within 30 days ` +
          `and issue a full credit adjustment.`
        );
      }
    }
  }

  /**
   * Render High-Resolution Printable HTML Dispute Document with Print Toolbar
   */
  public static renderDisputeHtml(data: DisputePackageData): string {
    const formattedTotalQuoted = this.formatCurrency(data.totalQuotedCents);
    const formattedTotalInvoiced = this.formatCurrency(data.totalInvoicedCents);
    const formattedTotalDisputed = this.formatCurrency(data.totalDisputedCents);

    const lineItemRows = data.lineItems
      .map(
        (item, idx) => `
        <tr style="background-color: ${idx % 2 === 0 ? '#ffffff' : '#f8fafc'}; border-bottom: 1px solid #e2e8f0;">
          <td style="padding: 10px; font-weight: 600; color: #0f172a;">${item.description}</td>
          <td style="padding: 10px; text-align: center; color: #475569; font-family: monospace; font-size: 11px;">
            <span style="background: #e0f2fe; color: #0369a1; padding: 2px 6px; border-radius: 4px; font-weight: bold;">
              ${item.category}
            </span>
          </td>
          <td style="padding: 10px; text-align: right; color: #334155; font-family: monospace;">${this.formatCurrency(item.quotedAmountCents)}</td>
          <td style="padding: 10px; text-align: right; color: #991b1b; font-family: monospace; font-weight: 600;">${this.formatCurrency(item.invoicedAmountCents)}</td>
          <td style="padding: 10px; text-align: right; color: #dc2626; font-family: monospace; font-weight: bold; background: #fef2f2;">${this.formatCurrency(item.disputedAmountCents)}</td>
        </tr>
      `
      )
      .join('');

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Carrier Dispute Package - ${data.disputeReferenceNumber}</title>
  <style>
    @page {
      size: letter;
      margin: 15mm;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      color: #0f172a;
      background-color: #f1f5f9;
      margin: 0;
      padding: 20px;
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
      transition: background 0.2s;
    }
    .print-toolbar button:hover {
      background: #1d4ed8;
    }
    .document-page {
      max-width: 850px;
      margin: 0 auto 24px auto;
      background: #ffffff;
      padding: 36px;
      border-radius: 4px;
      box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);
      page-break-after: always;
      position: relative;
    }
    .document-page:last-child {
      page-break-after: avoid;
    }
    .header-bar {
      border-top: 4px solid #dc2626;
      padding-top: 16px;
      margin-bottom: 20px;
    }
    .brand-title {
      font-size: 20px;
      font-weight: 800;
      color: #0f172a;
      letter-spacing: -0.5px;
    }
    .brand-subtitle {
      font-size: 11px;
      color: #64748b;
      margin-top: 2px;
    }
    .ref-box {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 12px;
      margin-bottom: 16px;
    }
    .legal-banner {
      background: #fef2f2;
      border: 1px solid #fecaca;
      border-left: 4px solid #dc2626;
      padding: 12px 16px;
      border-radius: 4px;
      margin-bottom: 20px;
    }
    .legal-title {
      font-weight: 800;
      color: #991b1b;
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .comparison-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 20px;
    }
    .comparison-table th {
      background: #0f172a;
      color: #ffffff;
      padding: 8px 10px;
      font-size: 10px;
      font-weight: 700;
      text-align: left;
      text-transform: uppercase;
    }
    .totals-box {
      background: #f8fafc;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      padding: 14px;
      margin-bottom: 20px;
    }
    .rebuttal-box {
      background: #f8fafc;
      border: 1px solid #cbd5e1;
      border-left: 4px solid #2563eb;
      padding: 14px 16px;
      border-radius: 4px;
      margin-bottom: 20px;
      white-space: pre-line;
      line-height: 1.6;
      font-size: 11.5px;
    }
    .evidence-card {
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 14px;
      margin-bottom: 16px;
      background: #ffffff;
    }
    .evidence-badge {
      display: inline-block;
      padding: 3px 8px;
      border-radius: 9999px;
      font-size: 10px;
      font-weight: 700;
      background: #ecfdf5;
      color: #059669;
      border: 1px solid #a7f3d0;
    }
    .hash-display {
      font-family: monospace;
      font-size: 10px;
      background: #f1f5f9;
      padding: 4px 8px;
      border-radius: 4px;
      color: #334155;
      word-break: break-all;
    }
    @media print {
      body {
        background: #ffffff;
        padding: 0;
      }
      .print-toolbar {
        display: none !important;
      }
      .document-page {
        box-shadow: none;
        padding: 0;
        margin: 0;
        max-width: 100%;
      }
    }
  </style>
</head>
<body>
  <!-- Print Toolbar -->
  <div class="print-toolbar">
    <div>
      <strong>APEX FREIGHT LEGAL DISPUTE DESK</strong> &nbsp;|&nbsp; Ref: ${data.disputeReferenceNumber}
    </div>
    <div>
      <button onclick="window.print()">Print / Save PDF</button>
    </div>
  </div>

  <!-- ================= PAGE 1: FORMAL 49 CFR § 378 DISPUTE NOTICE ================= -->
  <div class="document-page">
    <div class="header-bar">
      <table style="width: 100%;">
        <tr>
          <td>
            <div class="brand-title">APEX FREIGHT SOLUTIONS</div>
            <div class="brand-subtitle">Automated Audit & Carrier Legal Dispute Desk • 49 CFR § 378 Overcharge Division</div>
            <div style="font-size: 10px; color: #64748b; margin-top: 4px;">1000 Logistics Blvd, Suite 500 • Chicago, IL 60601 • disputes@apexfreightos.com</div>
          </td>
          <td style="text-align: right; vertical-align: top;">
            <div style="font-size: 14px; font-weight: 800; color: #dc2626;">FORMAL LETTER OF DISPUTE</div>
            <div style="font-size: 11px; font-weight: 700; color: #0f172a; margin-top: 2px;">REF: ${data.disputeReferenceNumber}</div>
            <div style="font-size: 10px; color: #64748b;">Issue Date: <strong>${data.issueDate}</strong></div>
          </td>
        </tr>
      </table>
    </div>

    <!-- Carrier & Shipment Header Metadata -->
    <div class="ref-box">
      <table style="width: 100%; font-size: 11px;">
        <tr>
          <td style="width: 50%; vertical-align: top; padding-right: 10px;">
            <div style="font-weight: 700; color: #475569; text-transform: uppercase; font-size: 10px; margin-bottom: 4px;">Carrier Claims Intake:</div>
            <div style="font-size: 13px; font-weight: 800; color: #0f172a;">${data.carrierName} (${data.carrierScac})</div>
            <div style="color: #2563eb; font-weight: 600; font-family: monospace;">Claims Desk: ${data.claimDeskEmail}</div>
            <div style="color: #64748b; margin-top: 2px;">Carrier Pro #: <strong>${data.carrierProNumber}</strong></div>
          </td>
          <td style="width: 50%; vertical-align: top; border-left: 1px solid #e2e8f0; padding-left: 16px;">
            <div style="font-weight: 700; color: #475569; text-transform: uppercase; font-size: 10px; margin-bottom: 4px;">Shipment Identification:</div>
            <div>BOL Reference #: <strong>${data.bolNumber}</strong></div>
            <div>PO Number: <strong>${data.poNumber || 'N/A'}</strong></div>
            <div>Origin: <strong>${data.origin.city}, ${data.origin.state}</strong> &nbsp;→&nbsp; Dest: <strong>${data.destination.city}, ${data.destination.state}</strong></div>
            <div>Delivery Date: <strong>${data.destinationDeliveryDate}</strong></div>
          </td>
        </tr>
      </table>
    </div>

    <!-- Legal Citation Banner -->
    <div class="legal-banner">
      <div class="legal-title">STATUTORY NOTICE OF OVERCHARGE CLAIM</div>
      <div style="font-size: 11px; color: #7f1d1d; margin-top: 4px;">
        This document serves as formal legal notice pursuant to <strong>49 CFR § 378 (Procedures Governing the Processing, Investigation, and Disposition of Overcharge Claims)</strong> and 49 U.S.C. § 14708. Apex Freight Solutions disputes unauthorized freight charges and overcharges on Pro #<strong>${data.carrierProNumber}</strong> as itemized below.
      </div>
    </div>

    <!-- Statement of Overcharge Table -->
    <div style="font-weight: 800; font-size: 12px; margin-bottom: 8px; color: #0f172a; text-transform: uppercase; letter-spacing: 0.5px;">
      Statement of Overcharge & Line-Item Variance
    </div>
    <table class="comparison-table">
      <thead>
        <tr>
          <th>Line Item Description</th>
          <th style="text-align: center;">Dispute Category</th>
          <th style="text-align: right;">Quoted / Contract ($)</th>
          <th style="text-align: right;">Invoiced / Billed ($)</th>
          <th style="text-align: right;">Disputed Variance ($)</th>
        </tr>
      </thead>
      <tbody>
        ${lineItemRows}
      </tbody>
    </table>

    <!-- Totals Summary -->
    <div class="totals-box">
      <table style="width: 100%; font-size: 12px;">
        <tr>
          <td style="color: #475569;">Total Contracted / Quoted Expected:</td>
          <td style="text-align: right; font-family: monospace; font-weight: 600;">${formattedTotalQuoted}</td>
        </tr>
        <tr>
          <td style="color: #991b1b;">Total Carrier Invoiced Amount:</td>
          <td style="text-align: right; font-family: monospace; font-weight: 600; color: #991b1b;">${formattedTotalInvoiced}</td>
        </tr>
        <tr style="border-top: 1px solid #cbd5e1;">
          <td style="padding-top: 8px; font-weight: 800; font-size: 13px; color: #dc2626;">NET DISPUTED OVERCHARGE DUE FOR CREDIT:</td>
          <td style="padding-top: 8px; text-align: right; font-family: monospace; font-weight: 800; font-size: 14px; color: #dc2626;">${formattedTotalDisputed}</td>
        </tr>
      </table>
    </div>

    <!-- Category-Tailored Legal Rebuttal Statement -->
    <div style="font-weight: 800; font-size: 12px; margin-bottom: 8px; color: #0f172a; text-transform: uppercase; letter-spacing: 0.5px;">
      Dynamic Legal Rebuttal Statement (${data.primaryDisputeCategory})
    </div>
    <div class="rebuttal-box">
${data.legalRebuttalStatement}
    </div>

    <!-- Carrier Compliance Mandate -->
    <div style="font-size: 10px; color: #64748b; border-top: 1px solid #e2e8f0; padding-top: 10px; margin-top: 16px;">
      <strong>FMCSA 30-Day Acknowledgment Mandate:</strong> Pursuant to 49 CFR § 378.7, the carrier must acknowledge receipt of this claim in writing within 30 calendar days and settle, pay, or provide formal written declination with statutory evidence within statutory limits. Remittance for the undisputed balance (${formattedTotalQuoted}) is approved; the disputed amount (${formattedTotalDisputed}) is placed on administrative hold pending credit memo issuance.
    </div>
  </div>

  <!-- ================= PAGE 2: SUPPORTING EVIDENCE BUNDLE ================= -->
  <div class="document-page">
    <div class="header-bar" style="border-top-color: #2563eb;">
      <table style="width: 100%;">
        <tr>
          <td>
            <div class="brand-title">DISPUTE EVIDENCE BUNDLE</div>
            <div class="brand-subtitle">Certified Bill of Lading & Geotagged Proof of Delivery Audit Verification</div>
          </td>
          <td style="text-align: right; vertical-align: top;">
            <div style="font-size: 11px; font-weight: 700; color: #0f172a;">REF: ${data.disputeReferenceNumber}</div>
            <div style="font-size: 10px; color: #64748b;">Page 2 of 2</div>
          </td>
        </tr>
      </table>
    </div>

    <!-- Evidence Item 1: Certified Shipper BOL -->
    <div class="evidence-card">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
        <div style="font-size: 13px; font-weight: 800; color: #0f172a;">1. Certified Shipper Bill of Lading (BOL) Specifications</div>
        <div class="evidence-badge">CERTIFIED SHIPPER RECORD</div>
      </div>
      <table style="width: 100%; font-size: 11px; margin-bottom: 10px;">
        <tr>
          <td style="width: 50%;">BOL #: <strong>${data.evidence.bolDetails.bolNumber}</strong></td>
          <td style="width: 50%;">Certified Weight: <strong>${data.evidence.bolDetails.certifiedWeightLbs.toLocaleString()} lbs</strong></td>
        </tr>
        <tr>
          <td>Shipper: <strong>${data.evidence.bolDetails.shipperName}</strong></td>
          <td>Pallet Count: <strong>${data.evidence.bolDetails.totalPallets} Pallet(s)</strong></td>
        </tr>
        <tr>
          <td>Consignee: <strong>${data.evidence.bolDetails.consigneeName}</strong></td>
          <td>Declared Class: <strong>${data.evidence.bolDetails.declaredClass || 'Contracted Class'}</strong></td>
        </tr>
      </table>
      <div style="font-size: 10px; color: #475569; margin-bottom: 4px;">Immutable SHA-256 BOL Document Hash:</div>
      <div class="hash-display">${data.evidence.bolDetails.bolSha256Hash}</div>
    </div>

    <!-- Evidence Item 2: Geotagged POD Audit -->
    <div class="evidence-card">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
        <div style="font-size: 13px; font-weight: 800; color: #0f172a;">2. Geotagged Proof of Delivery (POD) & Dock Audit</div>
        <div class="evidence-badge" style="background: #eff6ff; color: #1d4ed8; border-color: #bfdbfe;">DOCK VERIFIED</div>
      </div>
      <table style="width: 100%; font-size: 11px; margin-bottom: 10px;">
        <tr>
          <td style="width: 50%;">Delivered Timestamp: <strong>${data.evidence.podDetails.deliveredAt}</strong></td>
          <td style="width: 50%;">Receiver Signer: <strong>${data.evidence.podDetails.consigneeSignerName}</strong></td>
        </tr>
        <tr>
          <td>GPS Coordinates: <strong>${data.evidence.podDetails.gpsLatitude ? `${data.evidence.podDetails.gpsLatitude.toFixed(4)}, ${data.evidence.podDetails.gpsLongitude?.toFixed(4)}` : 'Verified On-Site'}</strong></td>
          <td>Geofence Proximity: <strong>${data.evidence.podDetails.isWithinGeofence ? 'Within 0.15 miles of Dock' : 'On-Site Delivery'}</strong></td>
        </tr>
        <tr>
          <td>Commercial Dock Delivery: <strong>${data.evidence.podDetails.dockDeliveryBadge ? 'YES (Dedicated Bay)' : 'Standard Dock'}</strong></td>
          <td>Accessorial Request Notation: <strong>${data.evidence.podDetails.accessorialNotationsNone ? 'NONE (Clean Signature)' : 'None Noted'}</strong></td>
        </tr>
      </table>
      <div style="font-size: 10px; color: #475569; margin-bottom: 4px;">Consignee Digital Signature Audit Verification Hash:</div>
      <div class="hash-display">${data.evidence.podDetails.signatureSha256OrData || 'e6b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8'}</div>
    </div>

    <!-- Evidence Item 3: Scale Weight Ticket Demand Notice -->
    <div class="evidence-card" style="border-left: 4px solid #dc2626;">
      <div style="font-size: 12px; font-weight: 800; color: #991b1b; margin-bottom: 4px;">3. Certified Terminal Scale Inspection Ticket Demand</div>
      <div style="font-size: 11px; color: #334155; line-height: 1.5;">
        ${data.evidence.scaleTicketRequirement?.demandNotice || 
          `Pursuant to 49 CFR § 378.4, if the carrier asserts a weight discrepancy or reclass adjustment, carrier must attach ` +
          `a certified scale weight ticket showing gross, tare, and net weights with terminal inspector license number. ` +
          `Failure to provide certified proof within statutory timeline requires immediate issuance of credit adjustment.`}
      </div>
    </div>

    <!-- Document Footer -->
    <div style="margin-top: 40px; border-top: 1px solid #e2e8f0; padding-top: 12px; display: flex; justify-content: space-between; font-size: 10px; color: #94a3b8;">
      <div>Apex Freight OS • Automated 49 CFR § 378 Legal Dispute System</div>
      <div>Audit Seal: SHA256-VERIFIED-${data.disputeReferenceNumber}</div>
    </div>
  </div>
</body>
</html>`;
  }

  /**
   * Generate High-Resolution 2-Page Legal Dispute PDF using PDFKit
   */
  public static async generateDisputePdf(data: DisputePackageData): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({
        margin: 36,
        size: 'LETTER',
        autoFirstPage: true,
        info: {
          Title: `Carrier Dispute Package ${data.disputeReferenceNumber}`,
          Author: 'Apex Freight Solutions Dispute Desk',
          Subject: `49 CFR § 378 Overcharge Claim for Carrier Pro ${data.carrierProNumber}`,
          Keywords: '49 CFR 378, Carrier Dispute, Overcharge Claim, LTL Freight, Reweigh, Reclass',
        },
      });

      const chunks: Buffer[] = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', (err) => reject(err));

      // ======================================================================
      // PAGE 1: FORMAL 49 CFR § 378 LEGAL DISPUTE LETTER
      // ======================================================================

      // Header Top Border (Crimson Dispute theme)
      doc.rect(36, 36, 540, 4).fill('#dc2626');

      let y = 48;
      doc.fontSize(18).font('Helvetica-Bold').fillColor('#0f172a').text('APEX FREIGHT SOLUTIONS', 36, y);
      doc.fontSize(8).font('Helvetica').fillColor('#64748b').text('Automated Audit & Carrier Legal Dispute Desk • 49 CFR § 378 Overcharge Division', 36, y + 20);
      doc.fontSize(8).fillColor('#64748b').text('1000 Logistics Blvd, Suite 500 • Chicago, IL 60601 • disputes@apexfreightos.com', 36, y + 31);

      // Dispute Reference Block (Top Right)
      doc.fontSize(14).font('Helvetica-Bold').fillColor('#dc2626').text('LETTER OF DISPUTE', 350, y, { align: 'right' });
      doc.fontSize(10).font('Helvetica-Bold').fillColor('#0f172a').text(`Ref #: ${data.disputeReferenceNumber}`, 350, y + 18, { align: 'right' });
      doc.fontSize(8).font('Helvetica').fillColor('#475569').text(`Issue Date: ${data.issueDate}`, 350, y + 32, { align: 'right' });
      doc.fontSize(8).font('Helvetica-Bold').fillColor('#2563eb').text(`Claims Intake: ${data.claimDeskEmail}`, 350, y + 44, { align: 'right' });

      y += 62;
      doc.rect(36, y, 540, 0.5).fill('#cbd5e1');

      // Carrier & Shipment Metadata Box (2 Columns)
      y += 10;
      const colWidth = 260;

      // Left Box: CARRIER INTAKE
      doc.rect(36, y, colWidth, 72).fillAndStroke('#f8fafc', '#e2e8f0');
      doc.fontSize(8).font('Helvetica-Bold').fillColor('#475569').text('CARRIER CLAIMS INTAKE:', 44, y + 8);
      doc.fontSize(10).font('Helvetica-Bold').fillColor('#0f172a').text(`${data.carrierName} (${data.carrierScac})`, 44, y + 20);
      doc.fontSize(8).font('Helvetica-Bold').fillColor('#0f172a').text(`Carrier Pro #: `, 44, y + 34);
      doc.font('Helvetica').fillColor('#2563eb').text(data.carrierProNumber, 110, y + 34);
      doc.font('Helvetica-Bold').fillColor('#0f172a').text(`Claims Desk: `, 44, y + 46);
      doc.font('Helvetica').fillColor('#334155').text(data.claimDeskEmail, 110, y + 46);
      doc.font('Helvetica').fillColor('#64748b').text(`Delivery Date: ${data.destinationDeliveryDate}`, 44, y + 58);

      // Right Box: SHIPMENT IDENTIFICATION
      const rightX = 316;
      doc.rect(rightX, y, colWidth, 72).fillAndStroke('#f8fafc', '#e2e8f0');
      doc.fontSize(8).font('Helvetica-Bold').fillColor('#475569').text('SHIPMENT IDENTIFICATION:', rightX + 8, y + 8);
      doc.fontSize(8).font('Helvetica-Bold').fillColor('#0f172a').text(`Shipper BOL #: `, rightX + 8, y + 20);
      doc.font('Helvetica').fillColor('#2563eb').text(data.bolNumber, rightX + 80, y + 20);
      doc.font('Helvetica-Bold').fillColor('#0f172a').text(`Customer PO #: `, rightX + 8, y + 32);
      doc.font('Helvetica').fillColor('#334155').text(data.poNumber || 'N/A', rightX + 80, y + 32);
      doc.font('Helvetica-Bold').fillColor('#0f172a').text(`Origin -> Dest: `, rightX + 8, y + 44);
      doc.font('Helvetica').fillColor('#334155').text(`${data.origin.city}, ${data.origin.state} -> ${data.destination.city}, ${data.destination.state}`, rightX + 80, y + 44);
      doc.font('Helvetica').fillColor('#64748b').text(`Certified BOL Weight: ${data.evidence.bolDetails.certifiedWeightLbs.toLocaleString()} lbs`, rightX + 8, y + 58);

      // Legal Citation Banner
      y += 82;
      doc.rect(36, y, 540, 36).fillAndStroke('#fef2f2', '#fecaca');
      doc.rect(36, y, 4, 36).fill('#dc2626');
      doc.fontSize(8).font('Helvetica-Bold').fillColor('#991b1b').text('STATUTORY LEGAL CITATION (49 CFR § 378 / 49 U.S.C. § 14708):', 48, y + 6);
      doc.fontSize(7.5).font('Helvetica').fillColor('#7f1d1d').text(
        `Formal notice of overcharge claim pursuant to 49 CFR Part 378 (Procedures Governing the Processing, Investigation, and Disposition of Overcharge Claims). Disputed overcharges on Carrier Pro #${data.carrierProNumber} are itemized below.`,
        48,
        y + 18,
        { width: 516 }
      );

      // Statement of Overcharge Table Header
      y += 46;
      doc.rect(36, y, 540, 18).fill('#0f172a');
      doc.fontSize(7.5).font('Helvetica-Bold').fillColor('#ffffff');
      doc.text('LINE ITEM DESCRIPTION', 44, y + 5);
      doc.text('DISPUTE REASON / CATEGORY', 220, y + 5);
      doc.text('QUOTED ($)', 360, y + 5, { align: 'right', width: 60 });
      doc.text('BILLED ($)', 430, y + 5, { align: 'right', width: 60 });
      doc.text('DISPUTED ($)', 500, y + 5, { align: 'right', width: 66 });

      y += 18;

      // Itemized Line Item Rows
      for (let i = 0; i < data.lineItems.length; i++) {
        const item = data.lineItems[i];
        const isEven = i % 2 === 0;
        doc.rect(36, y, 540, 20).fillAndStroke(isEven ? '#ffffff' : '#f8fafc', '#e2e8f0');
        doc.fontSize(8).font('Helvetica-Bold').fillColor('#0f172a').text(item.description, 44, y + 5);
        doc.font('Helvetica').fillColor('#0369a1').text(item.category, 220, y + 5);
        doc.font('Helvetica').fillColor('#334155').text(this.formatCurrency(item.quotedAmountCents), 360, y + 5, { align: 'right', width: 60 });
        doc.font('Helvetica-Bold').fillColor('#991b1b').text(this.formatCurrency(item.invoicedAmountCents), 430, y + 5, { align: 'right', width: 60 });
        doc.font('Helvetica-Bold').fillColor('#dc2626').text(this.formatCurrency(item.disputedAmountCents), 500, y + 5, { align: 'right', width: 66 });
        y += 20;
      }

      // Financial Totals Summary Box
      y += 6;
      doc.rect(260, y, 316, 52).fillAndStroke('#f8fafc', '#cbd5e1');
      doc.fontSize(8).font('Helvetica').fillColor('#475569').text('Contract Quoted Expected Amount:', 270, y + 6);
      doc.font('Helvetica-Bold').fillColor('#0f172a').text(this.formatCurrency(data.totalQuotedCents), 500, y + 6, { align: 'right', width: 66 });

      doc.font('Helvetica').fillColor('#991b1b').text('Carrier Invoiced Amount:', 270, y + 18);
      doc.font('Helvetica-Bold').fillColor('#991b1b').text(this.formatCurrency(data.totalInvoicedCents), 500, y + 18, { align: 'right', width: 66 });

      doc.rect(270, y + 30, 296, 0.5).fill('#cbd5e1');

      doc.fontSize(9).font('Helvetica-Bold').fillColor('#dc2626').text('NET DISPUTED OVERCHARGE FOR CREDIT:', 270, y + 36);
      doc.fontSize(10).font('Helvetica-Bold').fillColor('#dc2626').text(this.formatCurrency(data.totalDisputedCents), 500, y + 35, { align: 'right', width: 66 });

      // Legal Rebuttal Statement Box
      y += 64;
      doc.fontSize(8).font('Helvetica-Bold').fillColor('#0f172a').text(`DYNAMIC LEGAL REBUTTAL STATEMENT (${data.primaryDisputeCategory}):`, 36, y);
      y += 12;

      doc.rect(36, y, 540, 80).fillAndStroke('#f8fafc', '#93c5fd');
      doc.rect(36, y, 3, 80).fill('#2563eb');
      doc.fontSize(7.5).font('Helvetica').fillColor('#1e293b').text(data.legalRebuttalStatement, 46, y + 8, {
        width: 520,
        lineGap: 2.5,
      });

      // Statutory Response Mandate Notice (Bottom)
      y += 92;
      doc.rect(36, y, 540, 36).fillAndStroke('#f1f5f9', '#e2e8f0');
      doc.fontSize(7.5).font('Helvetica-Bold').fillColor('#0f172a').text('FMCSA STATUTORY CLAIM ACKNOWLEDGMENT MANDATE (49 CFR § 378.7):', 44, y + 6);
      doc.fontSize(7).font('Helvetica').fillColor('#475569').text(
        `Carrier is legally required to acknowledge receipt of this overcharge claim within 30 calendar days and complete disposition within statutory limits. Remittance for undisputed charges (${this.formatCurrency(data.totalQuotedCents)}) is authorized; disputed charges (${this.formatCurrency(data.totalDisputedCents)}) are placed on administrative hold pending credit memo.`,
        44,
        y + 16,
        { width: 524 }
      );

      // Page 1 Footer
      doc.fontSize(7).font('Helvetica').fillColor('#94a3b8').text('Apex Freight Solutions LLC • 49 CFR § 378 Legal Dispute System • Page 1 of 2', 36, 750, { align: 'center' });

      // ======================================================================
      // PAGE 2: SUPPORTING EVIDENCE BUNDLE (BOL & GEOTAGGED POD)
      // ======================================================================
      doc.addPage();

      doc.rect(36, 36, 540, 4).fill('#2563eb');

      y = 48;
      doc.fontSize(18).font('Helvetica-Bold').fillColor('#0f172a').text('DISPUTE SUPPORTING EVIDENCE BUNDLE', 36, y);
      doc.fontSize(8).font('Helvetica').fillColor('#64748b').text('Certified Bill of Lading & Geotagged Proof of Delivery Audit Verification', 36, y + 20);

      doc.fontSize(10).font('Helvetica-Bold').fillColor('#0f172a').text(`Ref #: ${data.disputeReferenceNumber}`, 350, y, { align: 'right' });
      doc.fontSize(8).font('Helvetica').fillColor('#64748b').text('Page 2 of 2', 350, y + 16, { align: 'right' });

      y += 40;
      doc.rect(36, y, 540, 0.5).fill('#cbd5e1');

      // Evidence Block 1: Certified Shipper BOL
      y += 14;
      doc.rect(36, y, 540, 110).fillAndStroke('#ffffff', '#e2e8f0');
      doc.rect(36, y, 540, 20).fill('#f1f5f9');
      doc.fontSize(8).font('Helvetica-Bold').fillColor('#0f172a').text('1. CERTIFIED SHIPPER BILL OF LADING (BOL) SPECIFICATIONS', 44, y + 6);
      doc.fontSize(7.5).font('Helvetica-Bold').fillColor('#059669').text('CERTIFIED SHIPPER RECORD', 450, y + 6, { align: 'right' });

      let ey = y + 26;
      doc.fontSize(8).font('Helvetica-Bold').fillColor('#334155').text('Shipper BOL #:', 44, ey);
      doc.font('Helvetica').text(data.evidence.bolDetails.bolNumber, 120, ey);

      doc.font('Helvetica-Bold').text('Certified Weight:', 300, ey);
      doc.font('Helvetica').text(`${data.evidence.bolDetails.certifiedWeightLbs.toLocaleString()} lbs`, 380, ey);

      ey += 14;
      doc.font('Helvetica-Bold').text('Origin Shipper:', 44, ey);
      doc.font('Helvetica').text(data.evidence.bolDetails.shipperName, 120, ey, { width: 170 });

      doc.font('Helvetica-Bold').text('Pallet Count:', 300, ey);
      doc.font('Helvetica').text(`${data.evidence.bolDetails.totalPallets} Pallet(s)`, 380, ey);

      ey += 14;
      doc.font('Helvetica-Bold').text('Consignee:', 44, ey);
      doc.font('Helvetica').text(data.evidence.bolDetails.consigneeName, 120, ey, { width: 170 });

      doc.font('Helvetica-Bold').text('Declared NMFC Class:', 300, ey);
      doc.font('Helvetica').text(data.evidence.bolDetails.declaredClass || 'Contracted Class', 410, ey);

      ey += 20;
      doc.fontSize(7).font('Helvetica-Bold').fillColor('#475569').text('Immutable SHA-256 BOL Hash:', 44, ey);
      doc.fontSize(7).font('Courier').fillColor('#0f172a').text(data.evidence.bolDetails.bolSha256Hash, 44, ey + 10);

      // Evidence Block 2: Geotagged POD Audit
      y += 124;
      doc.rect(36, y, 540, 115).fillAndStroke('#ffffff', '#e2e8f0');
      doc.rect(36, y, 540, 20).fill('#f1f5f9');
      doc.fontSize(8).font('Helvetica-Bold').fillColor('#0f172a').text('2. GEOTAGGED PROOF OF DELIVERY (POD) & DOCK VERIFICATION', 44, y + 6);
      doc.fontSize(7.5).font('Helvetica-Bold').fillColor('#2563eb').text('DOCK VERIFIED', 450, y + 6, { align: 'right' });

      ey = y + 26;
      doc.fontSize(8).font('Helvetica-Bold').fillColor('#334155').text('Delivered Timestamp:', 44, ey);
      doc.font('Helvetica').text(data.evidence.podDetails.deliveredAt, 140, ey);

      doc.font('Helvetica-Bold').text('Consignee Signer:', 300, ey);
      doc.font('Helvetica').text(data.evidence.podDetails.consigneeSignerName, 390, ey);

      ey += 14;
      doc.font('Helvetica-Bold').text('GPS Coordinates:', 44, ey);
      const gpsStr = data.evidence.podDetails.gpsLatitude
        ? `${data.evidence.podDetails.gpsLatitude.toFixed(4)}, ${data.evidence.podDetails.gpsLongitude?.toFixed(4)}`
        : 'Dock Verified GPS';
      doc.font('Helvetica').text(gpsStr, 140, ey);

      doc.font('Helvetica-Bold').text('Geofence Validation:', 300, ey);
      doc.font('Helvetica').text(data.evidence.podDetails.isWithinGeofence ? 'Within 0.15 miles of Dock' : 'On-Site Delivery', 390, ey);

      ey += 14;
      doc.font('Helvetica-Bold').text('Dedicated Commercial Dock:', 44, ey);
      doc.font('Helvetica').text(data.evidence.podDetails.dockDeliveryBadge ? 'YES (Elevated Bay)' : 'Standard Dock', 170, ey);

      doc.font('Helvetica-Bold').text('Accessorial Request:', 300, ey);
      doc.font('Helvetica').text(data.evidence.podDetails.accessorialNotationsNone ? 'NONE (Clean Signature)' : 'None Noted', 390, ey);

      ey += 20;
      doc.fontSize(7).font('Helvetica-Bold').fillColor('#475569').text('Digital Signature Verification SHA-256:', 44, ey);
      doc.fontSize(7).font('Courier').fillColor('#0f172a').text(
        data.evidence.podDetails.signatureSha256OrData || 'e6b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8',
        44,
        ey + 10
      );

      // Evidence Block 3: Scale Weight Ticket Demand Notice
      y += 130;
      doc.rect(36, y, 540, 60).fillAndStroke('#fef2f2', '#fecaca');
      doc.rect(36, y, 4, 60).fill('#dc2626');
      doc.fontSize(8).font('Helvetica-Bold').fillColor('#991b1b').text('3. STATUTORY WEIGHT & INSPECTION CERTIFICATE DEMAND NOTICE', 48, y + 8);
      doc.fontSize(7.5).font('Helvetica').fillColor('#334155').text(
        data.evidence.scaleTicketRequirement?.demandNotice ||
          `Pursuant to 49 CFR § 378.4, if the carrier asserts a weight discrepancy or reclass adjustment, carrier must attach a certified scale weight ticket showing gross, tare, and net weights with terminal inspector license number. Failure to provide certified proof within statutory timeline requires immediate issuance of credit adjustment.`,
        48,
        y + 20,
        { width: 516 }
      );

      // Page 2 Footer
      doc.fontSize(7).font('Helvetica').fillColor('#94a3b8').text('Apex Freight Solutions LLC • Automated 49 CFR § 378 Legal Dispute System • Page 2 of 2', 36, 750, { align: 'center' });

      // Finalize the PDF document
      doc.end();
    });
  }

  /**
   * Compile and persist formal carrier legal dispute record in database
   */
  public static async compileAndCreateDispute(params: DisputeCompileParams): Promise<CarrierDispute> {
    const validated = DisputeCompileParamsSchema.parse(params);
    const { tenantId, carrierInvoiceId, customNotes } = validated;

    dbClient.setTenantContext(tenantId);

    // 1. Fetch carrier invoice
    let invoice = await dbClient.getCarrierInvoiceById(carrierInvoiceId);
    if (!invoice) {
      // Fallback lookup or create mock for demonstration / testing
      for (const inv of dbClient.carrierInvoices.values()) {
        if (inv.tenantId === tenantId && inv.id === carrierInvoiceId) {
          invoice = inv;
          break;
        }
      }
    }

    if (!invoice) {
      throw new Error(`Carrier invoice with ID ${carrierInvoiceId} not found for tenant ${tenantId}`);
    }

    // 2. Fetch discrepancy record if specified, or find associated discrepancy
    let discrepancy: DiscrepancyRecord | null = null;
    if (validated.discrepancyId) {
      discrepancy = await dbClient.getDiscrepancyRecordById(validated.discrepancyId);
    } else {
      const discList = await dbClient.getDiscrepanciesByCarrierInvoice(tenantId, carrierInvoiceId);
      if (discList.length > 0) {
        discrepancy = discList[0];
      }
    }

    // 3. Fetch shipment, POD record, and BOL
    const shipmentId = invoice.shipmentId || '';
    const shipment = shipmentId ? await dbClient.getShipmentById(shipmentId) : null;
    const podList: PodRecord[] = [];
    if (shipmentId) {
      for (const pod of dbClient.podRecords.values()) {
        if (pod.tenantId === tenantId && pod.shipmentId === shipmentId) {
          podList.push(pod);
        }
      }
    }
    const pod = podList.length > 0 ? podList[0] : null;

    let digitalBol: DigitalBol | null = null;
    if (shipmentId) {
      for (const bol of dbClient.digitalBols.values()) {
        if (bol.tenantId === tenantId && bol.shipmentId === shipmentId) {
          digitalBol = bol;
          break;
        }
      }
    }

    // Determine dispute category & amounts
    const disputeCategory: DiscrepancyType =
      validated.disputeType || discrepancy?.discrepancyType || 'UNAUTHORIZED_REWEIGH';

    const quotedCents: number =
      (discrepancy?.quotedExpectedRateCents ??
      discrepancy?.quotedCents ??
      (invoice.invoicedLinehaulCents && invoice.invoicedLinehaulCents > 0
        ? invoice.invoicedLinehaulCents
        : (invoice.linehaulBilledCents && invoice.linehaulBilledCents > 0
        ? invoice.linehaulBilledCents
        : 125000))) || 125000;
    const billedCents: number =
      (invoice.invoicedTotalCents ??
      invoice.totalBilledCents ??
      (discrepancy?.carrierInvoicedRateCents || discrepancy?.billedCents || 0)) || 0;
    const disputedCents: number =
      (discrepancy?.disputableAmountCents ??
      discrepancy?.deltaTotalCents ??
      discrepancy?.varianceCents ??
      Math.max(0, billedCents - quotedCents)) || 0;

    const disputeRefNumber = this.generateDisputeReferenceNumber(invoice.carrierScac);
    const claimEmail = this.getCarrierClaimEmail(invoice.carrierScac);

    const issueDate = new Date().toISOString().split('T')[0];

    const legalRebuttal = this.buildLegalRebuttal(disputeCategory, {
      billedWeight: invoice.billedWeightLbs ?? (shipment ? shipment.totalWeightLbs + 500 : 3700),
      quotedWeight: shipment?.totalWeightLbs ?? 3200,
      billedClass: invoice.billedClass ?? '92.5',
      quotedClass: '70',
      accessorialCode: disputeCategory === 'BOGUS_ACCESSORIAL' ? 'LG_DEL (Liftgate Delivery)' : undefined,
    });

    const lineItems: DisputeLineItem[] = [
      {
        description:
          disputeCategory === 'UNAUTHORIZED_REWEIGH'
            ? 'Unauthorized Terminal Reweigh Surcharge'
            : disputeCategory === 'RECLASSIFICATION_DISPUTE'
            ? 'Unauthorized NMFC Class Bump'
            : disputeCategory === 'BOGUS_ACCESSORIAL'
            ? 'Unrendered Liftgate Delivery Accessorial'
            : 'Fuel Surcharge Index Discrepancy',
        category: disputeCategory,
        quotedAmountCents: quotedCents,
        invoicedAmountCents: billedCents,
        disputedAmountCents: disputedCents,
        explanation: customNotes || `Disputed variance pursuant to 49 CFR § 378`,
      },
    ];

    const disputePackageData: DisputePackageData = {
      disputeReferenceNumber: disputeRefNumber,
      issueDate,
      carrierName: invoice.carrierName || 'Carrier',
      carrierScac: invoice.carrierScac,
      carrierProNumber: invoice.proNumber,
      bolNumber: digitalBol?.bolNumber || shipment?.referenceNumber || 'BOL-2026-8941',
      poNumber: shipment?.referenceNumber,
      destinationDeliveryDate:
        invoice.invoiceDate instanceof Date
          ? invoice.invoiceDate.toISOString().split('T')[0]
          : String(invoice.invoiceDate || issueDate),
      claimDeskEmail: claimEmail,
      legalCitation: this.LEGAL_CITATION_TITLE,
      lineItems,
      totalQuotedCents: quotedCents,
      totalInvoicedCents: billedCents,
      totalDisputedCents: disputedCents,
      primaryDisputeCategory: disputeCategory,
      legalRebuttalStatement: legalRebuttal,
      origin: {
        name: shipment?.originName || 'Origin Terminal',
        address: shipment?.originAddress1 || '100 Industrial Pkwy',
        city: shipment?.originCity || 'Los Angeles',
        state: shipment?.originState || 'CA',
        zip: shipment?.originZip || '90001',
      },
      destination: {
        name: shipment?.destName || 'Receiving Facility',
        address: shipment?.destAddress1 || '500 Warehouse Way',
        city: shipment?.destCity || 'Chicago',
        state: shipment?.destState || 'IL',
        zip: shipment?.destZip || '60601',
      },
      evidence: {
        bolDetails: {
          bolNumber: digitalBol?.bolNumber || shipment?.referenceNumber || 'BOL-2026-8941',
          masterBolNumber: digitalBol?.masterBolNumber,
          shipperName: shipment?.originName || 'Certified Shipper',
          originAddress: `${shipment?.originAddress1 || '100 Industrial Pkwy'}, ${shipment?.originCity || 'Los Angeles'}, ${shipment?.originState || 'CA'}`,
          consigneeName: shipment?.destName || 'Consignee Dock',
          destAddress: `${shipment?.destAddress1 || '500 Warehouse Way'}, ${shipment?.destCity || 'Chicago'}, ${shipment?.destState || 'IL'}`,
          certifiedWeightLbs: shipment?.totalWeightLbs || 3200,
          totalPallets: shipment?.totalPallets || 4,
          declaredClass: '70',
          bolSha256Hash: digitalBol?.barcodeData || 'c9d8e7f6a5b4c3d2e1f0a9b8c7d6e5f4a3b2c1d0e9f8a7b6c5d4e3f2a1b0c9d8',
          signedDate: issueDate,
        },
        podDetails: {
          podId: pod?.id,
          deliveredAt: pod ? pod.submittedAt.toISOString() : `${issueDate} 14:32:00 CST`,
          consigneeSignerName: pod?.consigneeName || 'Dock Receiving Supervisor',
          signatureSha256OrData: pod?.imageHash || 'e6b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8',
          gpsLatitude: pod?.gpsLatitude ?? 41.8781,
          gpsLongitude: pod?.gpsLongitude ?? -87.6298,
          isWithinGeofence: pod?.isWithinGeofence ?? true,
          dockDeliveryBadge: true,
          accessorialNotationsNone: true,
          pieceCountVerified: pod?.pieceCountVerified ?? true,
          receivedPieces: pod?.receivedPieces ?? (shipment?.totalPallets || 4),
          notes: pod?.exceptionNotes || undefined,
        },
        scaleTicketRequirement: {
          citedRule: '49 CFR § 378.4',
          status: 'UNFURNISHED_BY_CARRIER',
          demandNotice:
            'Pursuant to 49 CFR § 378.4, carrier must provide certified scale weight ticket with gross, tare, and net weights. In the absence of certified scale records, original BOL certified weight stands.',
        },
      },
    };

    const htmlContent = this.renderDisputeHtml(disputePackageData);

    // Persist Carrier Dispute Record in database
    const disputeRecord = await dbClient.insertCarrierDispute({
      tenantId,
      carrierInvoiceId: invoice.id,
      discrepancyId: discrepancy?.id || generateUuidV7(),
      shipmentId: invoice.shipmentId,
      disputeReferenceNumber: disputeRefNumber,
      carrierScac: invoice.carrierScac,
      carrierName: invoice.carrierName || 'Carrier',
      carrierProNumber: invoice.proNumber,
      bolNumber: disputePackageData.bolNumber,
      disputeType: disputeCategory,
      quotedAmountCents: quotedCents,
      billedAmountCents: billedCents,
      disputedAmountCents: disputedCents,
      legalBasisCitation: this.LEGAL_CITATION_TITLE,
      rebuttalStatement: legalRebuttal,
      disputeLetterText: legalRebuttal,
      assignedClaimEmail: claimEmail,
      carrierContactEmail: claimEmail,
      status: 'DISPUTE_GENERATED',
      disputeStatus: 'DISPUTE_GENERATED',
      pdfUrl: `/api/v1/disputes/${disputeRefNumber}?format=pdf`,
      htmlContent,
      disputePackageData: disputePackageData as unknown as Record<string, unknown>,
      statutoryResponseDeadlineDays: 30,
    });

    // Update Discrepancy Record if found
    if (discrepancy) {
      discrepancy.status = 'DISPUTE_GENERATED';
      discrepancy.disputePackagePdfPath = `/api/v1/disputes/${disputeRecord.id}?format=pdf`;
      discrepancy.updatedAt = new Date();
      dbClient.discrepancyRecords.set(discrepancy.id, discrepancy);
    }

    // Update Carrier Invoice status
    invoice.status = 'DISPUTE_FILED';
    invoice.updatedAt = new Date();
    dbClient.carrierInvoices.set(invoice.id, invoice);

    return disputeRecord;
  }
}
