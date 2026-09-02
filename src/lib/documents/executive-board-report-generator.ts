import PDFDocument from 'pdfkit';
import crypto from 'crypto';
import { ExecutiveRoiMetrics } from '../analytics/executive-roi-engine';

export class ExecutiveBoardReportGenerator {
  /**
   * Generates a vector PDF Executive ROI Board Report
   */
  public static async renderBoardReportPdf(metrics: ExecutiveRoiMetrics): Promise<Buffer> {
    return ExecutiveBoardReportGenerator.generatePureVectorBoardReportPdf(metrics);
  }

  public static generatePureVectorBoardReportPdf(metrics: ExecutiveRoiMetrics): Buffer {
    const formatCurrency = (cents: number) => `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    const reportHash = crypto
      .createHash('sha256')
      .update(`${metrics.tenantId}|${metrics.platformSummary.totalEconomicValueGeneratedCents}|${Date.now()}`)
      .digest('hex');
    const dateStr = new Date().toISOString().split('T')[0];

    const streamContent = `
q
0.008 0.024 0.090 rg
40 692 532 60 re f
0.063 0.725 0.506 rg
BT /F2 16 Tf 55 724 Td (APEX LTL OPERATING SYSTEM) Tj ET
0.580 0.639 0.722 rg
BT /F1 9 Tf 55 706 Td (EXECUTIVE BOARD OF DIRECTORS - ROI & FINANCIAL REPORT) Tj ET
0.973 0.980 0.988 rg
BT /F2 10 Tf 410 724 Td (PERIOD: LAST ${metrics.evaluatedPeriodDays} DAYS) Tj ET
0.392 0.455 0.545 rg
BT /F1 8 Tf 410 706 Td (GENERATED: ${dateStr}) Tj ET

0.059 0.090 0.165 rg
40 602 532 75 re f
0.118 0.161 0.231 RG
40 602 532 75 re s
0.580 0.639 0.722 rg
BT /F2 8 Tf 55 655 Td (PROVEN ECONOMIC VALUE GENERATED) Tj ET
0.063 0.725 0.506 rg
BT /F2 22 Tf 55 628 Td (${formatCurrency(metrics.platformSummary.totalEconomicValueGeneratedCents)}) Tj ET

1 1 1 rg
40 370 532 215 re f
0.796 0.835 0.882 RG
40 370 532 215 re s
0.059 0.090 0.165 rg
BT /F2 11 Tf 55 560 Td (VALUE STREAM REVENUE & LABOR EFFICIENCY BREAKDOWN) Tj ET
0.278 0.333 0.412 rg
BT /F1 9 Tf 55 538 Td (Labor Hours Saved (RFQ Ingest, Disputes, Invoicing):) Tj ET
0.059 0.090 0.165 rg
BT /F2 9 Tf 440 538 Td (${formatCurrency(metrics.laborEfficiency.totalLaborValueSavedCents)}) Tj ET
0.278 0.333 0.412 rg
BT /F1 9 Tf 55 514 Td (Volume-LTL & Split Arbitrage Savings:) Tj ET
0.059 0.090 0.165 rg
BT /F2 9 Tf 440 514 Td (${formatCurrency(metrics.splitOptimization.totalLinehaulSavedCents)}) Tj ET
0.278 0.333 0.412 rg
BT /F1 9 Tf 55 490 Td (Dispute Overcharge Recoveries (80% Yield):) Tj ET
0.059 0.090 0.165 rg
BT /F2 9 Tf 440 490 Td (${formatCurrency(metrics.disputeRecovery.brokerRecoveryNetCents)}) Tj ET
0.278 0.333 0.412 rg
BT /F1 9 Tf 55 466 Td (QuickPay Fintech Spread Retained:) Tj ET
0.059 0.090 0.165 rg
BT /F2 9 Tf 440 466 Td (${formatCurrency(metrics.quickpayFintech.totalFintechFeeRevenueCents)}) Tj ET

0.008 0.024 0.090 rg
40 37 532 45 re f
0.118 0.161 0.231 RG
40 37 532 45 re s
0.063 0.725 0.506 rg
BT /F2 7.5 Tf 55 62 Td (CONFIDENTIAL - BOARD OF DIRECTORS AUDIT COPY) Tj ET
0.580 0.639 0.722 rg
BT /F3 6.5 Tf 55 50 Td (SHA-256 AUDIT SEAL: ${reportHash}) Tj ET
BT /F1 6.5 Tf 55 40 Td (Apex Operating System - Zero-Drift Financial Float Engine) Tj ET
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
