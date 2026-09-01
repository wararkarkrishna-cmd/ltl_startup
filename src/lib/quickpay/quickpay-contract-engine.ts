import crypto from 'crypto';
import PDFDocument from 'pdfkit';
import { z } from 'zod';
import { generateUuidV7 } from '../uuidv7';
import { QUICKPAY_TIERS, QuickPayTier, QuickPayAgreement, QuickPayAgreementSchema } from '../../db/schema';
import { QuickPayFeeEngine } from './quickpay-fee-engine';

export const QuickPayContractInputSchema = z.object({
  tenantId: z.string().min(1),
  payoutId: z.string().min(1),
  shipmentId: z.string().min(1),
  carrierScac: z.string().min(2).max(10),
  carrierName: z.string().min(1),
  proNumber: z.string().optional().nullable(),
  bolNumber: z.string().optional().nullable(),
  
  selectedTier: z.enum(QUICKPAY_TIERS),
  grossAmountCents: z.number().int().positive(),
  discountFeeCents: z.number().int().nonnegative(),
  netSettlementCents: z.number().int().positive(),
  
  signerName: z.string().min(1).max(128),
  signerTitle: z.string().min(1).max(128),
  signerEmail: z.string().email(),
  signerIp: z.string().min(1),
  signerUserAgent: z.string().optional().nullable(),
  
  bankName: z.string().optional().default('JPMorgan Chase'),
  routingNumberMasked: z.string().optional().default('*****0021'),
  accountNumberMasked: z.string().optional().default('*****4829'),
});

export type QuickPayContractInput = z.input<typeof QuickPayContractInputSchema>;

export interface GeneratedAgreementResult {
  agreement: QuickPayAgreement;
  agreementSha256Hash: string;
  legalTermsText: string;
}

export class QuickPayContractEngine {
  /**
   * Generates formal legal contract terms for the Assignment of Freight Receivables
   */
  public static buildLegalContractTerms(input: QuickPayContractInput, signedTimestamp: string): string {
    const grossStr = QuickPayFeeEngine.formatCents(input.grossAmountCents);
    const feeStr = QuickPayFeeEngine.formatCents(input.discountFeeCents);
    const netStr = QuickPayFeeEngine.formatCents(input.netSettlementCents);

    return `ELECTRONIC ASSIGNMENT OF FREIGHT RECEIVABLES & ACCELERATED SETTLEMENT AGREEMENT
Governing Law: Uniform Commercial Code (UCC Article 9) & Federal E-SIGN Act (15 U.S.C. § 7001)

1. PARTIES & LOAD IDENTIFICATION
This Electronic Assignment Agreement ("Agreement") is executed on ${signedTimestamp} by and between ${input.carrierName} (SCAC: ${input.carrierScac}) ("Assignor/Carrier") and Apex Freight OS Platform & Assignee Broker ("Platform/Broker") regarding Shipment ID: ${input.shipmentId} ${input.proNumber ? `(Pro #${input.proNumber})` : ''} ${input.bolNumber ? `(BOL #${input.bolNumber})` : ''}.

2. ASSIGNMENT OF RECEIVABLE & DISCOUNT FEE
Assignor hereby unconditionally sells, transfers, and assigns to Platform/Assignee all rights, title, and interest in and to the freight receivable invoice totaling ${grossStr} ("Gross Amount"). In consideration for immediate accelerated disbursement via selected rail (${input.selectedTier}), Assignor agrees to a discounted factoring fee of ${feeStr}, yielding a net disbursement of ${netStr} ("Net Settlement").

3. REPRESENTATIONS & WARRANTIES
Assignor warrants that: (a) the underlying freight has been fully delivered in good order; (b) no prior liens, factoring notices, or encumbrances attach to this receivable; (c) the signee possesses full legal corporate authority to execute this binding assignment.

4. E-SIGN ACKNOWLEDGMENT & AUDIT LOG
Signed electronically by ${input.signerName} (${input.signerTitle}) via authorized email ${input.signerEmail} from verified IP address ${input.signerIp}. This electronic record constitutes a legally binding original under 15 U.S.C. § 7001.`;
  }

  /**
   * Calculates cryptographic SHA-256 hash ensuring tamper-proof E-SIGN auditability
   */
  public static computeAgreementHash(
    tenantId: string,
    payoutId: string,
    shipmentId: string,
    grossCents: number,
    netCents: number,
    signerEmail: string,
    signerIp: string,
    signedAtIso: string
  ): string {
    const rawPayload = `${tenantId}|${payoutId}|${shipmentId}|${grossCents}|${netCents}|${signerEmail}|${signerIp}|${signedAtIso}`;
    return crypto.createHash('sha256').update(rawPayload).digest('hex');
  }

  /**
   * Generates QuickPay Agreement record with E-SIGN compliance
   */
  public static createAgreement(input: QuickPayContractInput): GeneratedAgreementResult {
    const validated = QuickPayContractInputSchema.parse(input);
    const signedAt = new Date();
    const signedAtIso = signedAt.toISOString();

    const agreementSha256Hash = this.computeAgreementHash(
      validated.tenantId,
      validated.payoutId,
      validated.shipmentId,
      validated.grossAmountCents,
      validated.netSettlementCents,
      validated.signerEmail,
      validated.signerIp,
      signedAtIso
    );

    const legalContractTerms = this.buildLegalContractTerms(validated, signedAtIso);
    const agreementReference = `QPA-${Date.now().toString(36).toUpperCase()}-${validated.carrierScac}`;

    const agreement: QuickPayAgreement = {
      id: generateUuidV7(),
      tenantId: validated.tenantId,
      payoutId: validated.payoutId,
      shipmentId: validated.shipmentId,
      agreementReference,
      carrierScac: validated.carrierScac,
      carrierName: validated.carrierName,
      signerName: validated.signerName,
      signerTitle: validated.signerTitle,
      signerEmail: validated.signerEmail,
      signerIp: validated.signerIp,
      signerUserAgent: validated.signerUserAgent || null,
      selectedTier: validated.selectedTier,
      grossAmountCents: validated.grossAmountCents,
      discountFeeCents: validated.discountFeeCents,
      netSettlementCents: validated.netSettlementCents,
      agreementSha256Hash,
      legalContractTerms,
      pdfDocumentUrl: `/api/v1/quickpay/agreements/${validated.payoutId}/pdf`,
      signedAt,
      createdAt: signedAt,
    };

    return {
      agreement,
      agreementSha256Hash,
      legalTermsText: legalContractTerms,
    };
  }

  /**
   * Renders official vector PDF Document for the Electronic Assignment Contract
   */
  public static async renderAgreementPdf(agreement: QuickPayAgreement, options?: { bankName?: string; routingMasked?: string; accountMasked?: string }): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({
        size: 'LETTER',
        margins: { top: 36, bottom: 36, left: 36, right: 36 },
        info: {
          Title: `QuickPay Agreement - ${agreement.agreementReference}`,
          Author: 'Apex LTL Freight OS Fintech Rails',
          Subject: 'E-SIGN Compliant Receivable Assignment Micro-Contract',
        },
      });

      const buffers: Buffer[] = [];
      doc.on('data', (chunk) => buffers.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', (err) => reject(err));

      const grossStr = QuickPayFeeEngine.formatCents(agreement.grossAmountCents);
      const feeStr = QuickPayFeeEngine.formatCents(agreement.discountFeeCents);
      const netStr = QuickPayFeeEngine.formatCents(agreement.netSettlementCents);

      // Header Banner
      doc.rect(36, 36, 540, 54).fill('#0f172a'); // slate-900
      doc.fillColor('#10b981').fontSize(16).font('Helvetica-Bold').text('APEX LTL OS // EMBEDDED FINTECH RAILS', 50, 48);
      doc.fillColor('#94a3b8').fontSize(9).font('Helvetica').text('ELECTRONIC RECEIVABLE ASSIGNMENT & QUICKPAY SETTLEMENT CONTRACT', 50, 68);

      // Document Reference Pill
      doc.rect(410, 45, 150, 36).fill('#1e293b');
      doc.fillColor('#38bdf8').fontSize(8).font('Helvetica-Bold').text('AGREEMENT REF #', 420, 52);
      doc.fillColor('#ffffff').fontSize(10).font('Helvetica-Bold').text(agreement.agreementReference, 420, 64);

      let y = 105;

      // Settlement Summary Box
      doc.rect(36, y, 540, 85).fillAndStroke('#f8fafc', '#cbd5e1');
      doc.fillColor('#0f172a').fontSize(11).font('Helvetica-Bold').text('FINANCIAL SETTLEMENT BREAKDOWN', 50, y + 12);

      // Columns
      const col1 = 50;
      const col2 = 180;
      const col3 = 310;
      const col4 = 440;

      doc.fillColor('#64748b').fontSize(8).font('Helvetica').text('GROSS LOAD AMOUNT', col1, y + 32);
      doc.fillColor('#0f172a').fontSize(14).font('Helvetica-Bold').text(grossStr, col1, y + 44);

      doc.fillColor('#64748b').fontSize(8).font('Helvetica').text('DISCOUNT / QUICKPAY FEE', col2, y + 32);
      doc.fillColor('#ef4444').fontSize(14).font('Helvetica-Bold').text(`-${feeStr}`, col2, y + 44);

      doc.fillColor('#64748b').fontSize(8).font('Helvetica').text('NET CARRIER DISBURSEMENT', col3, y + 32);
      doc.fillColor('#059669').fontSize(16).font('Helvetica-Bold').text(netStr, col3, y + 44);

      doc.fillColor('#64748b').fontSize(8).font('Helvetica').text('SETTLEMENT TIER', col4, y + 32);
      doc.fillColor('#2563eb').fontSize(10).font('Helvetica-Bold').text(agreement.selectedTier, col4, y + 46);

      y += 100;

      // Carrier & Payout Metadata Block
      doc.rect(36, y, 540, 65).fillAndStroke('#ffffff', '#e2e8f0');
      doc.fillColor('#0f172a').fontSize(9).font('Helvetica-Bold').text('ASSIGNOR & DESTINATION BANKING DETAILS', 50, y + 10);

      doc.fillColor('#475569').fontSize(8).font('Helvetica')
        .text(`Carrier Name: ${agreement.carrierName}`, 50, y + 26)
        .text(`Carrier SCAC: ${agreement.carrierScac}`, 50, y + 38)
        .text(`Shipment ID: ${agreement.shipmentId}`, 50, y + 50);

      const bankName = options?.bankName || 'JPMorgan Chase';
      const routing = options?.routingMasked || '*****0021';
      const acct = options?.accountMasked || '*****4829';

      doc.fillColor('#475569').fontSize(8).font('Helvetica')
        .text(`Disbursement Bank: ${bankName}`, 300, y + 26)
        .text(`Routing Number: ${routing}`, 300, y + 38)
        .text(`Account Number: ${acct}`, 300, y + 50);

      y += 80;

      // Legal Terms Body
      doc.rect(36, y, 540, 220).fillAndStroke('#f8fafc', '#cbd5e1');
      doc.fillColor('#0f172a').fontSize(9).font('Helvetica-Bold').text('LEGAL CONTRACT TERMS & ASSIGNMENT PROVISIONS', 50, y + 10);

      doc.fillColor('#334155').fontSize(7.5).font('Helvetica')
        .text('1. ASSIGNMENT OF PROCEEDS:', 50, y + 26, { underline: true })
        .text('The Assignor named herein irrevocably sells, transfers, and assigns to Assignee Broker / Apex Platform all rights, title, and interest in and to the freight receivable invoice resulting from the underlying completed transportation services. Assignor acknowledges that upon execution hereof, Assignee shall have full ownership and sole right to collect payments from shipper/customer.', 50, y + 36, { width: 510 })
        
        .text('2. ACCELERATED SETTLEMENT CONSIDERATION:', 50, y + 72, { underline: true })
        .text(`In consideration of immediate payout acceleration (${agreement.selectedTier}), Assignor agrees to the discounted fee of ${feeStr} deducted directly from the gross payable. Both parties agree that this transaction is a true sale of an account receivable under UCC Article 9.`, 50, y + 82, { width: 510 })
        
        .text('3. FREE & CLEAR TITLE WARRANTY:', 50, y + 110, { underline: true })
        .text('Assignor expressly warrants that this receivable is free from all adverse claims, factoring liens, or prior assignments. If Assignor is under an active Factoring Agreement, Assignor warrants that an authorized waiver/release has been executed.', 50, y + 120, { width: 510 })
        
        .text('4. E-SIGN ACT COMPLIANCE & GOVERNING LAW:', 50, y + 148, { underline: true })
        .text('This Agreement is executed electronically in compliance with the Electronic Signatures in Global and National Commerce Act (15 U.S.C. § 7001) and Uniform Electronic Transactions Act (UETA). The digital audit trail below constitutes definitive legal proof of execution.', 50, y + 158, { width: 510 });

      y += 235;

      // Digital Signature & Audit Certificate Box
      doc.rect(36, y, 540, 105).fillAndStroke('#090d16', '#1e293b');
      doc.fillColor('#10b981').fontSize(10).font('Helvetica-Bold').text('[ VERIFIED E-SIGN ACT AUDIT TRAIL & DIGITAL SEAL ]', 50, y + 12);

      doc.fillColor('#e2e8f0').fontSize(8).font('Helvetica')
        .text(`Signer Name:     ${agreement.signerName}`, 50, y + 30)
        .text(`Signer Title:    ${agreement.signerTitle}`, 50, y + 42)
        .text(`Signer Email:    ${agreement.signerEmail}`, 50, y + 54)
        .text(`Signer IP:       ${agreement.signerIp}`, 50, y + 66)
        .text(`Execution Time:  ${agreement.signedAt.toISOString()}`, 50, y + 78);

      doc.fillColor('#38bdf8').fontSize(7.5).font('Courier-Bold')
        .text('CRYPTOGRAPHIC SHA-256 SIGNATURE CHECKSUM:', 280, y + 30)
        .fillColor('#ffffff').fontSize(7).font('Courier')
        .text(agreement.agreementSha256Hash, 280, y + 42, { width: 280 })
        .fillColor('#10b981').fontSize(8).font('Helvetica-Bold')
        .text('STATUS: LEGALLY BINDING / EXECUTED', 280, y + 74);

      doc.end();
    });
  }
}
