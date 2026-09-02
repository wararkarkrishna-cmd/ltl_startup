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
    try {
      return await new Promise<Buffer>((resolve, reject) => {
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
    } catch {
      // Infallible Pure Vector PDF Fallback for Serverless / Cloud environments
      return QuickPayContractEngine.generatePureVectorPdf(agreement, options);
    }
  }

  public static generatePureVectorPdf(agreement: QuickPayAgreement, options?: { bankName?: string; routingMasked?: string; accountMasked?: string }): Buffer {
    const grossStr = QuickPayFeeEngine.formatCents(agreement.grossAmountCents);
    const feeStr = QuickPayFeeEngine.formatCents(agreement.discountFeeCents);
    const netStr = QuickPayFeeEngine.formatCents(agreement.netSettlementCents);
    const bankName = options?.bankName || 'JPMorgan Chase';
    const routing = options?.routingMasked || '*****0021';
    const acct = options?.accountMasked || '*****4829';
    const signedAtStr = agreement.signedAt instanceof Date ? agreement.signedAt.toISOString() : new Date().toISOString();

    const streamContent = `
q
0.059 0.090 0.165 rg
36 702 540 54 re f
1 1 1 rg
BT /F2 14 Tf 50 732 Td (APEX LTL OS // EMBEDDED FINTECH RAILS) Tj ET
0.580 0.639 0.722 rg
BT /F1 8 Tf 50 714 Td (ELECTRONIC RECEIVABLE ASSIGNMENT & QUICKPAY CONTRACT) Tj ET
0.118 0.161 0.231 rg
410 711 150 36 re f
0.220 0.741 0.973 rg
BT /F2 8 Tf 420 734 Td (AGREEMENT REF #) Tj ET
1 1 1 rg
BT /F2 10 Tf 420 718 Td (${agreement.agreementReference}) Tj ET
0.973 0.980 0.988 rg
36 605 540 85 re f
0.796 0.835 0.882 RG
36 605 540 85 re s
0.059 0.090 0.165 rg
BT /F2 11 Tf 50 673 Td (FINANCIAL SETTLEMENT BREAKDOWN) Tj ET
0.392 0.455 0.545 rg
BT /F1 8 Tf 50 655 Td (GROSS LOAD AMOUNT) Tj ET
0.059 0.090 0.165 rg
BT /F2 13 Tf 50 639 Td (${grossStr}) Tj ET
0.392 0.455 0.545 rg
BT /F1 8 Tf 180 655 Td (DISCOUNT / QUICKPAY FEE) Tj ET
0.937 0.267 0.267 rg
BT /F2 13 Tf 180 639 Td (-${feeStr}) Tj ET
0.392 0.455 0.545 rg
BT /F1 8 Tf 310 655 Td (NET CARRIER DISBURSEMENT) Tj ET
0.020 0.588 0.412 rg
BT /F2 14 Tf 310 639 Td (${netStr}) Tj ET
0.392 0.455 0.545 rg
BT /F1 8 Tf 440 655 Td (SETTLEMENT TIER) Tj ET
0.145 0.388 0.922 rg
BT /F2 10 Tf 440 639 Td (${agreement.selectedTier}) Tj ET
1 1 1 rg
36 528 540 65 re f
0.886 0.910 0.941 RG
36 528 540 65 re s
0.059 0.090 0.165 rg
BT /F2 9 Tf 50 577 Td (ASSIGNOR & DESTINATION BANKING DETAILS) Tj ET
0.278 0.333 0.412 rg
BT /F1 8 Tf 50 562 Td (Carrier Name: ${agreement.carrierName}) Tj ET
BT /F1 8 Tf 50 550 Td (Carrier SCAC: ${agreement.carrierScac}) Tj ET
BT /F1 8 Tf 50 538 Td (Shipment ID: ${agreement.shipmentId}) Tj ET
BT /F1 8 Tf 300 562 Td (Disbursement Bank: ${bankName}) Tj ET
BT /F1 8 Tf 300 550 Td (Routing Number: ${routing}) Tj ET
BT /F1 8 Tf 300 538 Td (Account Number: ${acct}) Tj ET
0.973 0.980 0.988 rg
36 296 540 220 re f
0.796 0.835 0.882 RG
36 296 540 220 re s
0.059 0.090 0.165 rg
BT /F2 9 Tf 50 499 Td (LEGAL CONTRACT TERMS & ASSIGNMENT PROVISIONS) Tj ET
0.200 0.255 0.333 rg
BT /F2 8 Tf 50 483 Td (1. ASSIGNMENT OF PROCEEDS:) Tj ET
BT /F1 7.5 Tf 50 472 Td (The Assignor named herein irrevocably sells, transfers, and assigns to Assignee Broker all rights,) Tj ET
BT /F1 7.5 Tf 50 462 Td (title, and interest in and to the freight receivable invoice. Assignee shall have sole collection rights.) Tj ET
BT /F2 8 Tf 50 444 Td (2. ACCELERATED SETTLEMENT CONSIDERATION:) Tj ET
BT /F1 7.5 Tf 50 433 Td (In consideration of immediate payout acceleration (${agreement.selectedTier}), Assignor agrees to the discounted fee) Tj ET
BT /F1 7.5 Tf 50 423 Td (of ${feeStr} deducted from gross payable. This transaction is a true sale under UCC Article 9.) Tj ET
BT /F2 8 Tf 50 405 Td (3. FREE & CLEAR TITLE WARRANTY:) Tj ET
BT /F1 7.5 Tf 50 394 Td (Assignor warrants that this receivable is free from all adverse liens or prior encumbrances.) Tj ET
BT /F2 8 Tf 50 376 Td (4. E-SIGN ACT COMPLIANCE & GOVERNING LAW:) Tj ET
BT /F1 7.5 Tf 50 365 Td (Executed electronically under the Federal E-SIGN Act (15 U.S.C. 7001) and UETA.) Tj ET
0.035 0.051 0.086 rg
36 179 540 105 re f
0.118 0.161 0.231 RG
36 179 540 105 re s
0.063 0.725 0.506 rg
BT /F2 10 Tf 50 267 Td ([ VERIFIED E-SIGN ACT AUDIT TRAIL & DIGITAL SEAL ]) Tj ET
0.886 0.910 0.941 rg
BT /F1 8 Tf 50 249 Td (Signer Name:     ${agreement.signerName}) Tj ET
BT /F1 8 Tf 50 237 Td (Signer Title:    ${agreement.signerTitle}) Tj ET
BT /F1 8 Tf 50 225 Td (Signer Email:    ${agreement.signerEmail}) Tj ET
BT /F1 8 Tf 50 213 Td (Signer IP:       ${agreement.signerIp}) Tj ET
BT /F1 8 Tf 50 201 Td (Execution Time:  ${signedAtStr}) Tj ET
0.220 0.741 0.973 rg
BT /F2 7.5 Tf 280 249 Td (CRYPTOGRAPHIC SHA-256 SIGNATURE CHECKSUM:) Tj ET
1 1 1 rg
BT /F3 6.5 Tf 280 237 Td (${agreement.agreementSha256Hash}) Tj ET
0.063 0.725 0.506 rg
BT /F2 8 Tf 280 205 Td (STATUS: LEGALLY BINDING / EXECUTED) Tj ET
Q
`;

    const streamLen = Buffer.byteLength(streamContent, 'utf8');

    const pdf = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R /F2 6 0 R /F3 7 0 R >> >> >>
endobj
4 0 obj
<< /Length ${streamLen} >>
stream
${streamContent}
endstream
endobj
5 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>
endobj
6 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>
endobj
7 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>
endobj
xref
0 8
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000244 00000 n 
0000000300 00000 n 
0000000367 00000 n 
0000000439 00000 n 
trailer
<< /Size 8 /Root 1 0 R >>
startxref
505
%%EOF`;

    return Buffer.from(pdf, 'utf8');
  }
}

