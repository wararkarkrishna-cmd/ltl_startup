import { z } from 'zod';
import { ExceptionSeverity, EXCEPTION_SEVERITIES, DeliveryException } from '../../db/schema';
import { dbClient } from '../../db/client';

export const ClaimsAlertInputSchema = z.object({
  tenantId: z.string().uuid(),
  shipmentId: z.string().uuid(),
  podId: z.string().uuid().optional().nullable(),
  referenceNumber: z.string().min(1),
  carrierName: z.string().min(1),
  carrierScac: z.string().min(2),
  consigneeName: z.string().min(1),
  destCityState: z.string().optional().default('Chicago, IL'),
  deliveryDate: z.string().optional(),
  severity: z.enum(EXCEPTION_SEVERITIES),
  detectedKeywords: z.array(z.string()),
  notationSnippets: z.array(z.string()),
  receivedPieces: z.number().int().nonnegative(),
  expectedPieces: z.number().int().positive(),
  totalWeightLbs: z.number().positive().optional(),
  photoUrl: z.string().optional().nullable(),
  declaredValueCents: z.number().int().nonnegative().optional(),
  customClaimAmountCents: z.number().int().nonnegative().optional(),
  claimsContactEmail: z.string().email().optional(),
  claimsWebhookUrl: z.string().url().optional(),
});
export type ClaimsAlertInput = z.infer<typeof ClaimsAlertInputSchema>;

export interface ClaimsAlertResult {
  success: boolean;
  exceptionId: string;
  severity: ExceptionSeverity;
  estimatedLiabilityClaimCents: number;
  estimatedLiabilityClaimDollars: string;
  alertPayload: {
    subject: string;
    emailHtml: string;
    emailText: string;
    webhookPayload: Record<string, any>;
  };
  dispatchStatus: {
    emailDispatched: boolean;
    webhookDispatched: boolean;
    dispatchedTo: string[];
  };
}

export class ClaimsAlertEngine {
  public static readonly DEFAULT_CLAIMS_EMAIL = 'claims-desk@apexfreightos.com';

  /**
   * Dispatch high-priority claims incident alert and persist delivery exception record
   */
  public static async dispatchClaimsAlert(input: ClaimsAlertInput): Promise<ClaimsAlertResult> {
    // Validate input
    ClaimsAlertInputSchema.parse(input);

    const piecesShort = Math.max(0, input.expectedPieces - input.receivedPieces);
    const estimatedLiabilityClaimCents = this.calculateEstimatedClaimCents(input, piecesShort);
    const estimatedLiabilityClaimDollars = (estimatedLiabilityClaimCents / 100).toFixed(2);
    const deliveryDateStr = input.deliveryDate || new Date().toISOString().split('T')[0];
    const claimsEmail = input.claimsContactEmail || this.DEFAULT_CLAIMS_EMAIL;

    // Generate formatted description
    const description = this.generateExceptionDescription(input, piecesShort, estimatedLiabilityClaimDollars);

    // Persist Delivery Exception in DB
    const exceptionRecord = await dbClient.insertDeliveryException({
      tenantId: input.tenantId,
      shipmentId: input.shipmentId,
      podId: input.podId || null,
      severity: input.severity,
      keywordsDetected: input.detectedKeywords,
      notationSnippets: input.notationSnippets,
      description,
      reportedPiecesShort: piecesShort,
      claimAmountCents: estimatedLiabilityClaimCents,
      alertSentTo: claimsEmail,
      alertSentAt: new Date(),
      status: 'OPEN',
    });

    // Mark claims alert sent on POD record if podId exists
    if (input.podId) {
      const existingPod = await dbClient.getPodRecordById(input.podId);
      if (existingPod) {
        existingPod.claimsAlertSent = true;
        existingPod.hasDamageException = true;
        existingPod.exceptionSeverity = input.severity;
        existingPod.detectedExceptionKeywords = input.detectedKeywords;
        dbClient.podRecords.set(input.podId, existingPod);
      }
    }

    // Format Email & Webhook Payloads
    const subject = `[URGENT CLAIMS ALERT - ${input.severity}] Freight Exception on ${input.referenceNumber} (${input.carrierName})`;
    const emailHtml = this.renderAlertEmailHtml(input, piecesShort, estimatedLiabilityClaimDollars, deliveryDateStr, exceptionRecord.id);
    const emailText = this.renderAlertEmailText(input, piecesShort, estimatedLiabilityClaimDollars, deliveryDateStr, exceptionRecord.id);
    const webhookPayload = this.buildWebhookPayload(input, piecesShort, estimatedLiabilityClaimCents, deliveryDateStr, exceptionRecord.id);

    // Mock dispatch (simulating immediate email + webhook dispatch)
    const dispatchedTo: string[] = [claimsEmail];
    let webhookDispatched = false;
    if (input.claimsWebhookUrl) {
      dispatchedTo.push(input.claimsWebhookUrl);
      webhookDispatched = true;
    }

    return {
      success: true,
      exceptionId: exceptionRecord.id,
      severity: input.severity,
      estimatedLiabilityClaimCents,
      estimatedLiabilityClaimDollars,
      alertPayload: {
        subject,
        emailHtml,
        emailText,
        webhookPayload,
      },
      dispatchStatus: {
        emailDispatched: true,
        webhookDispatched,
        dispatchedTo,
      },
    };
  }

  /**
   * Calculate estimated cargo liability claim amount in integer cents
   */
  public static calculateEstimatedClaimCents(input: ClaimsAlertInput, piecesShort: number): number {
    // 1. Direct override if custom claim amount specified
    if (input.customClaimAmountCents !== undefined && input.customClaimAmountCents > 0) {
      return input.customClaimAmountCents;
    }

    // 2. Declared value proportion
    if (input.declaredValueCents && input.declaredValueCents > 0) {
      const shortageRatio = piecesShort / input.expectedPieces;
      const shortageClaim = Math.round(input.declaredValueCents * shortageRatio);
      const remainingCargoValue = input.declaredValueCents - shortageClaim;

      // Remaining cargo damage factor
      let damageFactor = 0;
      if (input.severity === 'CRITICAL') {
        damageFactor = 1.0;
      } else if (input.severity === 'HIGH') {
        damageFactor = 0.5;
      } else if (input.severity === 'MEDIUM') {
        damageFactor = 0.15;
      } else if (input.severity === 'LOW') {
        damageFactor = 0.02;
      }

      const hasDamageKeywords = input.detectedKeywords.some((k) =>
        ['Damaged', 'Damage', 'Broken', 'Crushed', 'Water Damage', 'Refused', 'Leaking'].includes(k)
      );

      const damageClaim = hasDamageKeywords
        ? Math.round(remainingCargoValue * damageFactor)
        : 0;

      return Math.max(5000, shortageClaim + damageClaim); // Minimum $50
    }

    // 3. Standard Carmack / Freight Liability Heuristic:
    // $750 per missing pallet, $500 per damaged unit
    const shortageLiability = piecesShort * 75000;
    const hasDamageKeywords = input.detectedKeywords.some((k) =>
      ['Damaged', 'Damage', 'Broken', 'Crushed', 'Water Damage', 'Refused', 'Leaking'].includes(k)
    );

    let damageLiability = 0;
    if (hasDamageKeywords) {
      if (input.severity === 'CRITICAL') {
        damageLiability = input.expectedPieces * 125000; // $1,250 / unit
      } else if (input.severity === 'HIGH') {
        damageLiability = 50000; // $500 / unit
      } else if (input.severity === 'MEDIUM') {
        damageLiability = 15000; // $150
      }
    }

    const totalEstimate = shortageLiability + damageLiability;
    return totalEstimate > 0 ? totalEstimate : 25000; // Default $250.00
  }

  /**
   * Generate human-readable exception summary description
   */
  private static generateExceptionDescription(
    input: ClaimsAlertInput,
    piecesShort: number,
    claimAmountDollars: string
  ): string {
    const parts: string[] = [];
    parts.push(`[${input.severity}] Exception detected on delivery for ${input.referenceNumber}.`);

    if (piecesShort > 0) {
      parts.push(`Shortage: Delivered ${input.receivedPieces} of ${input.expectedPieces} pieces (${piecesShort} missing).`);
    }

    if (input.detectedKeywords.length > 0) {
      parts.push(`Keywords Detected: ${input.detectedKeywords.join(', ')}.`);
    }

    if (input.notationSnippets.length > 0) {
      parts.push(`POD Notations: "${input.notationSnippets.join('; ')}".`);
    }

    parts.push(`Carrier: ${input.carrierName} (${input.carrierScac}). Est. Claim Liability: $${claimAmountDollars}.`);
    return parts.join(' ');
  }

  /**
   * Render high-priority incident alert HTML email template
   */
  public static renderAlertEmailHtml(
    input: ClaimsAlertInput,
    piecesShort: number,
    claimDollars: string,
    deliveryDate: string,
    exceptionId: string
  ): string {
    const isCritical = input.severity === 'CRITICAL';
    const bannerColor = isCritical ? '#dc2626' : '#ea580c';
    const bannerText = isCritical ? 'CRITICAL FREIGHT EXCEPTION - IMMEDIATE ACTION REQUIRED' : 'HIGH PRIORITY OS&D CLAIMS ALERT';

    const claimsEmail = input.claimsContactEmail || this.DEFAULT_CLAIMS_EMAIL;
    const snippetsHtml = input.notationSnippets
      .map(
        (s) =>
          `<div style="background:#fef2f2;border-left:4px solid #ef4444;padding:8px 12px;margin:4px 0;font-style:italic;font-size:13px;color:#991b1b;">"${s}"</div>`
      )
      .join('');

    const keywordsPills = input.detectedKeywords
      .map(
        (k) =>
          `<span style="background:#fee2e2;color:#991b1b;font-weight:bold;font-size:11px;padding:3px 8px;border-radius:12px;margin-right:4px;display:inline-block;">${k}</span>`
      )
      .join('');

    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Apex Freight OS - Claims Incident Alert</title>
</head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;margin:0;padding:20px;background:#0f172a;color:#1e293b;">
  <div style="max-width:640px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 10px 25px rgba(0,0,0,0.3);">
    
    <!-- Top Alert Banner -->
    <div style="background:${bannerColor};color:#ffffff;padding:16px 24px;text-align:center;font-weight:900;letter-spacing:0.5px;font-size:14px;">
      ⚠️ ${bannerText}
    </div>

    <!-- Main Header -->
    <div style="padding:24px 24px 16px 24px;border-bottom:1px solid #e2e8f0;">
      <div style="font-size:12px;font-weight:bold;color:#64748b;text-transform:uppercase;letter-spacing:1px;">
        APEX FREIGHT OS • CARGO CLAIMS DISPATCHER
      </div>
      <h1 style="margin:6px 0 0 0;font-size:22px;color:#0f172a;font-weight:800;">
        Shipment ${input.referenceNumber} Flagged for Claims
      </h1>
      <div style="font-size:12px;color:#64748b;margin-top:4px;">
        Exception Incident ID: <span style="font-family:monospace;font-weight:bold;color:#0f172a;">${exceptionId}</span>
      </div>
    </div>

    <!-- Critical Metrics Grid -->
    <div style="padding:20px 24px;background:#f8fafc;border-bottom:1px solid #e2e8f0;">
      <table style="width:100%;border-collapse:collapse;font-size:13px;">
        <tr>
          <td style="padding:6px 0;color:#64748b;width:38%;">Shipment Reference:</td>
          <td style="padding:6px 0;font-weight:bold;color:#0f172a;font-family:monospace;">${input.referenceNumber}</td>
        </tr>
        <tr>
          <td style="padding:6px 0;color:#64748b;">Carrier Assigned:</td>
          <td style="padding:6px 0;font-weight:bold;color:#0f172a;">${input.carrierName} (${input.carrierScac})</td>
        </tr>
        <tr>
          <td style="padding:6px 0;color:#64748b;">Consignee Destination:</td>
          <td style="padding:6px 0;font-weight:bold;color:#0f172a;">${input.consigneeName} (${input.destCityState})</td>
        </tr>
        <tr>
          <td style="padding:6px 0;color:#64748b;">Delivery Date:</td>
          <td style="padding:6px 0;font-weight:bold;color:#0f172a;">${deliveryDate}</td>
        </tr>
        <tr>
          <td style="padding:6px 0;color:#64748b;">Piece Count Status:</td>
          <td style="padding:6px 0;font-weight:bold;color:${piecesShort > 0 ? '#b91c1c' : '#047857'};">
            Delivered ${input.receivedPieces} / Expected ${input.expectedPieces} (${piecesShort > 0 ? `${piecesShort} SHORT` : 'Exact Count'})
          </td>
        </tr>
        <tr>
          <td style="padding:8px 0;color:#64748b;font-weight:bold;font-size:14px;">Estimated Claim Liability:</td>
          <td style="padding:8px 0;font-weight:900;color:#b91c1c;font-size:18px;">$${claimDollars} USD</td>
        </tr>
      </table>
    </div>

    <!-- Exception Details & Notations -->
    <div style="padding:20px 24px;border-bottom:1px solid #e2e8f0;">
      <h3 style="margin:0 0 8px 0;font-size:14px;color:#0f172a;text-transform:uppercase;letter-spacing:0.5px;">
        Detected Damage & Shortage Keywords
      </h3>
      <div style="margin-bottom:14px;">
        ${keywordsPills}
      </div>

      <h3 style="margin:14px 0 8px 0;font-size:14px;color:#0f172a;text-transform:uppercase;letter-spacing:0.5px;">
        Delivery Receipt (POD) Notations
      </h3>
      ${snippetsHtml}
    </div>

    <!-- Action Plan & SOP -->
    <div style="padding:20px 24px;background:#fffbeb;border-bottom:1px solid #fef3c7;">
      <h4 style="margin:0 0 6px 0;font-size:13px;color:#92400e;text-transform:uppercase;">
        ⚠️ Required SOP Immediate Action Items
      </h4>
      <ul style="margin:0;padding-left:18px;font-size:12px;color:#78350f;line-height:1.6;">
        <li>Carrier Freight Settlement has been <strong>HELD</strong> pending OS&D claims review.</li>
        <li>Notify Carrier Claims Department within 48 hours pursuant to NMFC 430 rules.</li>
        <li>Request joint on-site inspection for visible damaged pallets.</li>
        <li>Notify Shipper VP of Logistics with attached signed POD and photos.</li>
      </ul>
    </div>

    <!-- Action Buttons -->
    <div style="padding:24px;text-align:center;">
      ${
        input.photoUrl
          ? `<a href="${input.photoUrl}" style="display:inline-block;background:#0f172a;color:#ffffff;padding:12px 24px;border-radius:8px;font-weight:bold;font-size:13px;text-decoration:none;margin-right:8px;">View High-Res Signed POD Photo</a>`
          : ''
      }
      <a href="mailto:${claimsEmail}?subject=Claim%20Filing%20for%20${input.referenceNumber}" style="display:inline-block;background:#dc2626;color:#ffffff;padding:12px 24px;border-radius:8px;font-weight:bold;font-size:13px;text-decoration:none;">Initiate Carrier Cargo Claim</a>
    </div>

    <!-- Footer -->
    <div style="padding:16px 24px;background:#f1f5f9;font-size:11px;color:#64748b;text-align:center;">
      Sent automatically by Apex Freight Operating System • Incident Dispatch Engine<br>
      © 2026 Apex Logistics Technologies LLC. All rights reserved.
    </div>

  </div>
</body>
</html>
    `.trim();
  }

  /**
   * Plain text fallback for SMS/Terminal alerts
   */
  public static renderAlertEmailText(
    input: ClaimsAlertInput,
    piecesShort: number,
    claimDollars: string,
    deliveryDate: string,
    exceptionId: string
  ): string {
    return `
[URGENT FREIGHT CLAIMS ALERT - ${input.severity}]
Shipment Reference: ${input.referenceNumber}
Incident ID:        ${exceptionId}
Carrier:            ${input.carrierName} (${input.carrierScac})
Consignee:          ${input.consigneeName} (${input.destCityState})
Delivery Date:      ${deliveryDate}
Piece Count:        ${input.receivedPieces} / ${input.expectedPieces} (${piecesShort} short)
Keywords:           ${input.detectedKeywords.join(', ')}
Notations:          ${input.notationSnippets.join(' | ')}
Est. Claim Value:   $${claimDollars} USD

ACTION REQUIRED:
1. Hold carrier freight settlement.
2. File preliminary OS&D claim within 48h.
3. Review high-resolution POD photo.
    `.trim();
  }

  /**
   * Build structured JSON payload for webhook subscribers (Slack/TMS/Claims)
   */
  public static buildWebhookPayload(
    input: ClaimsAlertInput,
    piecesShort: number,
    claimAmountCents: number,
    deliveryDate: string,
    exceptionId: string
  ): Record<string, any> {
    return {
      eventType: 'FREIGHT_DELIVERY_EXCEPTION',
      timestamp: new Date().toISOString(),
      exceptionId,
      severity: input.severity,
      shipment: {
        id: input.shipmentId,
        referenceNumber: input.referenceNumber,
        carrierName: input.carrierName,
        carrierScac: input.carrierScac,
        consigneeName: input.consigneeName,
        deliveryDate,
        piecesExpected: input.expectedPieces,
        piecesReceived: input.receivedPieces,
        piecesShort,
        totalWeightLbs: input.totalWeightLbs,
      },
      claimEstimate: {
        amountCents: claimAmountCents,
        amountDollars: (claimAmountCents / 100).toFixed(2),
        currency: 'USD',
      },
      exceptionDetails: {
        detectedKeywords: input.detectedKeywords,
        notationSnippets: input.notationSnippets,
        podPhotoUrl: input.photoUrl || null,
      },
      actions: {
        holdCarrierPayment: true,
        fileClaimDeadlineDays: 48,
      },
    };
  }
}
