import PDFDocument from 'pdfkit';
import { z } from 'zod';
import { generateUuidV7 } from '../uuidv7';
import { dbClient } from '../../db/client';
import {
  FinancialLedgerEntry,
  FinancialLedgerEntrySchema,
  CarrierDispute,
  CarrierInvoice,
} from '../../db/schema';

// ============================================================================
// SCHEMAS & TYPES FOR RECOVERY CONTINGENCY & BILLING
// ============================================================================

export const ContingencyFeeResultSchema = z.object({
  recoveredAmountCents: z.number().int().nonnegative(),
  contingencyRatePercent: z.number().nonnegative(),
  contingencyFeeCents: z.number().int().nonnegative(),
  brokerNetRetainedCents: z.number().int().nonnegative(),
});
export type ContingencyFeeResult = z.infer<typeof ContingencyFeeResultSchema>;

export const RecoveryStatementLineItemSchema = z.object({
  disputeId: z.string().uuid(),
  disputeReferenceNumber: z.string(),
  carrierScac: z.string(),
  carrierName: z.string(),
  carrierProNumber: z.string(),
  bolNumber: z.string().nullable().optional(),
  discrepancyType: z.string(),
  disputedAmountCents: z.number().int().nonnegative(),
  recoveredAmountCents: z.number().int().nonnegative(),
  contingencyFeeCents: z.number().int().nonnegative(),
  brokerNetRetainedCents: z.number().int().nonnegative(),
  creditMemoNumber: z.string().nullable().optional(),
  resolvedAt: z.union([z.date(), z.string()]),
});
export type RecoveryStatementLineItem = z.infer<typeof RecoveryStatementLineItemSchema>;

export const MonthlyRecoveryStatementSchema = z.object({
  statementId: z.string(),
  tenantId: z.string().uuid(),
  billingCycle: z.string(), // e.g. '2026-09'
  issuedAt: z.date(),
  contingencyRatePercent: z.number().nonnegative(),
  totalDisputesEvaluated: z.number().int().nonnegative(),
  totalDisputesSettled: z.number().int().nonnegative(),
  totalCarrierOverchargesDisputedCents: z.number().int().nonnegative(),
  totalCreditsRecoveredCents: z.number().int().nonnegative(),
  recoverySuccessRatePercent: z.number().min(0).max(100),
  totalPerformanceFeeCents: z.number().int().nonnegative(),
  brokerNetRetainedCents: z.number().int().nonnegative(),
  lineItems: z.array(RecoveryStatementLineItemSchema),
  htmlStatement: z.string(),
  pdfBuffer: z.instanceof(Buffer).optional(),
  ledgerEntries: z.array(FinancialLedgerEntrySchema),
});
export type MonthlyRecoveryStatement = z.infer<typeof MonthlyRecoveryStatementSchema>;

export interface StatementGenerationOptions {
  persistLedgerEntries?: boolean;
  companyName?: string;
  brokerClientName?: string;
}

// ============================================================================
// RECOVERY CONTINGENCY MONETIZATION ENGINE (PHASE 5.7)
// ============================================================================

export class RecoveryBillingEngine {
  /**
   * Default Performance Contingency Rate: 20.0% (2000 basis points)
   */
  public static readonly DEFAULT_CONTINGENCY_RATE_PERCENT = 20.0;

  /**
   * Format cents to standard US currency string
   */
  public static formatCurrency(cents: number): string {
    return `$${(Math.max(0, cents) / 100).toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }

  /**
   * Parse flexible monthYear representation (e.g. '2026-09', '2026-09-01', 'September 2026')
   */
  public static normalizeMonthYear(monthYearStr: string): string {
    const trimmed = (monthYearStr || '').trim();
    const match = trimmed.match(/^(\d{4})[-/.](\d{1,2})/);
    if (match) {
      const year = match[1];
      const month = match[2].padStart(2, '0');
      return `${year}-${month}`;
    }
    const d = new Date(trimmed);
    if (!isNaN(d.getTime())) {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      return `${year}-${month}`;
    }
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }

  /**
   * Calculate Contingency Fee & Broker Net Retained Amount (Revenue Driver #1)
   *
   * Formula:
   * Contingency Fee Cents = Recovered Amount Cents * (Contingency Rate % / 100)
   * Broker Net Retained Cents = Recovered Amount Cents - Contingency Fee Cents
   */
  public static calculateContingencyFee(
    recoveredAmountCents: number,
    contingencyRatePercent: number = this.DEFAULT_CONTINGENCY_RATE_PERCENT
  ): ContingencyFeeResult {
    const validRecoveredCents = Math.max(0, Math.round(recoveredAmountCents));
    const validRatePercent = Math.max(0, contingencyRatePercent);

    // Exact integer cents calculation with round-half-up
    const contingencyFeeCents = Math.round((validRecoveredCents * validRatePercent) / 100);
    const brokerNetRetainedCents = Math.max(0, validRecoveredCents - contingencyFeeCents);

    return {
      recoveredAmountCents: validRecoveredCents,
      contingencyRatePercent: validRatePercent,
      contingencyFeeCents,
      brokerNetRetainedCents,
    };
  }

  /**
   * Aggregates all credit memos & settled disputes for a tenant during a billing cycle,
   * computes performance fees, generates printable HTML and PDF statements, and records
   * double-entry ledger entries in financial_ledger_entries.
   */
  public static async generateMonthlyRecoveryStatement(
    tenantId: string,
    monthYear: string,
    contingencyRatePercent: number = this.DEFAULT_CONTINGENCY_RATE_PERCENT,
    options?: StatementGenerationOptions
  ): Promise<MonthlyRecoveryStatement> {
    dbClient.setTenantContext(tenantId);

    const normalizedCycle = this.normalizeMonthYear(monthYear);
    const persistLedger = options?.persistLedgerEntries ?? true;
    const brokerClientName = options?.brokerClientName || 'Apex Freight Partner';

    // 1. Fetch all tenant disputes
    const allDisputes = await dbClient.getCarrierDisputes(tenantId);

    // 2. Filter disputes belonging to the specified billing cycle
    const cycleDisputes: CarrierDispute[] = [];
    const settledDisputes: CarrierDispute[] = [];

    for (const dispute of allDisputes) {
      const resolvedDate = dispute.resolvedAt ? new Date(dispute.resolvedAt) : null;
      const submittedDate = dispute.submittedAt ? new Date(dispute.submittedAt) : null;
      const createdDate = dispute.createdAt ? new Date(dispute.createdAt) : new Date();

      const disputeCycle = resolvedDate
        ? this.normalizeMonthYear(resolvedDate.toISOString())
        : submittedDate
        ? this.normalizeMonthYear(submittedDate.toISOString())
        : this.normalizeMonthYear(createdDate.toISOString());

      // If dispute dates match the target billing cycle
      if (disputeCycle === normalizedCycle) {
        cycleDisputes.push(dispute);
        if (
          dispute.disputeStatus === 'CREDIT_ISSUED' ||
          dispute.status === 'CREDIT_ISSUED' ||
          dispute.status === 'SETTLED' ||
          (dispute.recoveredAmountCents && dispute.recoveredAmountCents > 0)
        ) {
          settledDisputes.push(dispute);
        }
      }
    }

    // 3. Compute Aggregate Metrics
    let totalCarrierOverchargesDisputedCents = 0;
    for (const d of cycleDisputes) {
      totalCarrierOverchargesDisputedCents += d.disputedAmountCents || 0;
    }

    let totalCreditsRecoveredCents = 0;
    const lineItems: RecoveryStatementLineItem[] = [];

    for (const d of settledDisputes) {
      const recoveredCents = d.recoveredAmountCents || d.disputedAmountCents || 0;
      totalCreditsRecoveredCents += recoveredCents;

      const feeCalc = this.calculateContingencyFee(recoveredCents, contingencyRatePercent);

      lineItems.push({
        disputeId: d.id,
        disputeReferenceNumber: d.disputeReferenceNumber,
        carrierScac: d.carrierScac,
        carrierName: d.carrierName || d.carrierScac,
        carrierProNumber: d.carrierProNumber,
        bolNumber: d.bolNumber || null,
        discrepancyType: d.disputeType || 'DISCREPANCY',
        disputedAmountCents: d.disputedAmountCents || 0,
        recoveredAmountCents: recoveredCents,
        contingencyFeeCents: feeCalc.contingencyFeeCents,
        brokerNetRetainedCents: feeCalc.brokerNetRetainedCents,
        creditMemoNumber: d.creditMemoNumber || null,
        resolvedAt: d.resolvedAt ? new Date(d.resolvedAt) : new Date(),
      });
    }

    // If total overcharges disputed was 0 but credits were recovered (or vice versa)
    if (totalCarrierOverchargesDisputedCents < totalCreditsRecoveredCents) {
      totalCarrierOverchargesDisputedCents = totalCreditsRecoveredCents;
    }

    // Recovery Success Rate %
    const recoverySuccessRatePercent =
      totalCarrierOverchargesDisputedCents > 0
        ? Math.min(
            100,
            Math.round(
              ((totalCreditsRecoveredCents / totalCarrierOverchargesDisputedCents) * 100) * 10
            ) / 10
          )
        : totalCreditsRecoveredCents > 0
        ? 100.0
        : 0.0;

    // Aggregate Contingency Fee and Broker Net
    const overallFee = this.calculateContingencyFee(
      totalCreditsRecoveredCents,
      contingencyRatePercent
    );
    const totalPerformanceFeeCents = overallFee.contingencyFeeCents;
    const brokerNetRetainedCents = overallFee.brokerNetRetainedCents;

    const statementId = `REC-STMT-${normalizedCycle.replace('-', '')}-${generateUuidV7().slice(-6).toUpperCase()}`;
    const issuedAt = new Date();

    // 4. Generate Double-Entry Ledger Entries
    // Transaction ID shared across balanced entries
    const ledgerTransactionId = generateUuidV7();
    const ledgerEntries: FinancialLedgerEntry[] = [];

    if (totalCreditsRecoveredCents > 0) {
      // 1. Debit: DISPUTE_RECOVERY (Realized recovered asset)
      const debitEntry = await dbClient.insertLedgerEntry({
        tenantId,
        transactionId: ledgerTransactionId,
        accountType: 'DISPUTE_RECOVERY',
        entryType: 'DEBIT',
        amountCents: totalCreditsRecoveredCents,
        currency: 'USD',
        description: `Carrier overcharge dispute recovery recognized for cycle ${normalizedCycle}`,
      });
      ledgerEntries.push(debitEntry);

      // 2. Credit: CARRIER_PAYABLE (Reduction of carrier payable / Broker net savings credit)
      if (brokerNetRetainedCents > 0) {
        const creditPayableEntry = await dbClient.insertLedgerEntry({
          tenantId,
          transactionId: ledgerTransactionId,
          accountType: 'CARRIER_PAYABLE',
          entryType: 'CREDIT',
          amountCents: brokerNetRetainedCents,
          currency: 'USD',
          description: `Broker net retained recovery credit applied against carrier payables for cycle ${normalizedCycle}`,
        });
        ledgerEntries.push(creditPayableEntry);
      }

      // 3. Credit: PLATFORM_REVENUE (Platform contingency performance fee)
      if (totalPerformanceFeeCents > 0) {
        const creditRevenueEntry = await dbClient.insertLedgerEntry({
          tenantId,
          transactionId: ledgerTransactionId,
          accountType: 'PLATFORM_REVENUE',
          entryType: 'CREDIT',
          amountCents: totalPerformanceFeeCents,
          currency: 'USD',
          description: `Apex Freight Engine ${contingencyRatePercent.toFixed(1)}% recovery contingency fee for cycle ${normalizedCycle}`,
        });
        ledgerEntries.push(creditRevenueEntry);
      }
    }

    // 5. Generate Printable HTML Statement
    const htmlStatement = this.generateStatementHtml({
      statementId,
      billingCycle: normalizedCycle,
      issuedAt,
      contingencyRatePercent,
      brokerClientName,
      totalDisputesEvaluated: cycleDisputes.length,
      totalDisputesSettled: settledDisputes.length,
      totalCarrierOverchargesDisputedCents,
      totalCreditsRecoveredCents,
      recoverySuccessRatePercent,
      totalPerformanceFeeCents,
      brokerNetRetainedCents,
      lineItems,
      ledgerTransactionId,
    });

    // 6. Generate Multi-Page PDF Document Buffer
    const pdfBuffer = await this.generateStatementPdf({
      statementId,
      billingCycle: normalizedCycle,
      issuedAt,
      contingencyRatePercent,
      brokerClientName,
      totalDisputesEvaluated: cycleDisputes.length,
      totalDisputesSettled: settledDisputes.length,
      totalCarrierOverchargesDisputedCents,
      totalCreditsRecoveredCents,
      recoverySuccessRatePercent,
      totalPerformanceFeeCents,
      brokerNetRetainedCents,
      lineItems,
      ledgerTransactionId,
    });

    const statement: MonthlyRecoveryStatement = {
      statementId,
      tenantId,
      billingCycle: normalizedCycle,
      issuedAt,
      contingencyRatePercent,
      totalDisputesEvaluated: cycleDisputes.length,
      totalDisputesSettled: settledDisputes.length,
      totalCarrierOverchargesDisputedCents,
      totalCreditsRecoveredCents,
      recoverySuccessRatePercent,
      totalPerformanceFeeCents,
      brokerNetRetainedCents,
      lineItems,
      htmlStatement,
      pdfBuffer,
      ledgerEntries,
    };

    return MonthlyRecoveryStatementSchema.parse(statement);
  }

  /**
   * Render modern, printable HTML monthly recovery statement
   */
  public static generateStatementHtml(data: {
    statementId: string;
    billingCycle: string;
    issuedAt: Date;
    contingencyRatePercent: number;
    brokerClientName: string;
    totalDisputesEvaluated: number;
    totalDisputesSettled: number;
    totalCarrierOverchargesDisputedCents: number;
    totalCreditsRecoveredCents: number;
    recoverySuccessRatePercent: number;
    totalPerformanceFeeCents: number;
    brokerNetRetainedCents: number;
    lineItems: RecoveryStatementLineItem[];
    ledgerTransactionId: string;
  }): string {
    const formattedRecovered = this.formatCurrency(data.totalCreditsRecoveredCents);
    const formattedFee = this.formatCurrency(data.totalPerformanceFeeCents);
    const formattedDisputed = this.formatCurrency(data.totalCarrierOverchargesDisputedCents);
    const formattedNetRetained = this.formatCurrency(data.brokerNetRetainedCents);
    const ratePercent = data.contingencyRatePercent % 1 === 0
      ? data.contingencyRatePercent.toFixed(0)
      : data.contingencyRatePercent.toFixed(1);

    const rowsHtml =
      data.lineItems.length > 0
        ? data.lineItems
            .map(
              (item, idx) => `
          <tr class="${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'} border-b border-slate-200 text-xs">
            <td class="px-3 py-2 font-mono font-medium text-slate-800">${item.disputeReferenceNumber}</td>
            <td class="px-3 py-2 font-semibold text-slate-700">${item.carrierScac}</td>
            <td class="px-3 py-2 font-mono text-slate-600">${item.carrierProNumber}</td>
            <td class="px-3 py-2 text-slate-600">${item.discrepancyType.replace(/_/g, ' ')}</td>
            <td class="px-3 py-2 text-right font-mono text-slate-600">${this.formatCurrency(item.disputedAmountCents)}</td>
            <td class="px-3 py-2 font-mono text-emerald-700 font-medium">${item.creditMemoNumber || 'CM-SETTLED'}</td>
            <td class="px-3 py-2 text-right font-mono font-bold text-emerald-600">${this.formatCurrency(item.recoveredAmountCents)}</td>
            <td class="px-3 py-2 text-right font-mono font-semibold text-blue-700">${this.formatCurrency(item.brokerNetRetainedCents)}</td>
            <td class="px-3 py-2 text-right font-mono text-slate-800">${this.formatCurrency(item.contingencyFeeCents)}</td>
          </tr>`
            )
            .join('')
        : `
          <tr>
            <td colspan="9" class="px-4 py-8 text-center text-sm text-slate-500">
              No carrier dispute credit memos recovered during billing cycle ${data.billingCycle}.
            </td>
          </tr>`;

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Apex Freight OS - Monthly Recovery Statement (${data.billingCycle})</title>
  <style>
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; margin: 0; padding: 24px; color: #0f172a; background: #ffffff; }
    .container { max-width: 960px; margin: 0 auto; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #0f172a; padding-bottom: 16px; margin-bottom: 20px; }
    .logo { font-size: 24px; font-weight: 800; color: #0f172a; letter-spacing: -0.5px; }
    .subhead { font-size: 11px; color: #64748b; margin-top: 2px; }
    .stmt-meta { text-align: right; font-size: 12px; }
    .hero-banner { background: #f0fdf4; border: 1px solid #86efac; border-radius: 8px; padding: 16px 20px; margin-bottom: 24px; }
    .hero-text { font-size: 16px; font-weight: 700; color: #166534; line-height: 1.4; }
    .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 24px; }
    .kpi-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 12px; }
    .kpi-label { font-size: 11px; font-weight: 600; text-transform: uppercase; color: #64748b; letter-spacing: 0.5px; }
    .kpi-val { font-size: 20px; font-weight: 800; margin-top: 4px; color: #0f172a; }
    .kpi-val.green { color: #059669; }
    .kpi-val.blue { color: #2563eb; }
    .table-container { border: 1px solid #e2e8f0; border-radius: 6px; overflow: hidden; margin-bottom: 24px; }
    table { width: 100%; border-collapse: collapse; text-align: left; }
    th { background: #0f172a; color: #ffffff; font-size: 11px; font-weight: 600; padding: 8px 12px; text-transform: uppercase; }
    td { padding: 8px 12px; border-bottom: 1px solid #e2e8f0; font-size: 12px; }
    .totals-box { background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 6px; padding: 16px; margin-left: auto; width: 340px; margin-bottom: 24px; }
    .totals-row { display: flex; justify-content: space-between; font-size: 13px; margin-bottom: 6px; }
    .totals-row.bold { font-weight: 700; font-size: 15px; border-top: 1px solid #cbd5e1; padding-top: 8px; margin-top: 8px; }
    .ledger-cert { background: #f1f5f9; border-left: 4px solid #2563eb; padding: 12px 16px; border-radius: 0 6px 6px 0; font-size: 11px; color: #334155; margin-bottom: 24px; }
    .footer { text-align: center; font-size: 11px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div>
        <div class="logo">APEX FREIGHT RECOVERY ENGINE</div>
        <div class="subhead">Automated Re-Bill Audit, Carrier Dispute Settlement & Contingency Recovery</div>
        <div class="subhead">Client Partner: <strong>${data.brokerClientName}</strong></div>
      </div>
      <div class="stmt-meta">
        <div><strong>Statement #:</strong> ${data.statementId}</div>
        <div><strong>Billing Cycle:</strong> ${data.billingCycle}</div>
        <div><strong>Issue Date:</strong> ${data.issuedAt.toISOString().slice(0, 10)}</div>
        <div><strong>Contingency Rate:</strong> ${ratePercent}% (${data.contingencyRatePercent * 100} bps)</div>
      </div>
    </div>

    <!-- Executive Highlight Banner -->
    <div class="hero-banner">
      <div class="hero-text">
        Apex Freight Dispute Engine recovered ${formattedRecovered} in carrier overcharges this month. Performance fee (${ratePercent}%): ${formattedFee}.
      </div>
    </div>

    <!-- Performance KPIs -->
    <div class="kpi-grid">
      <div class="kpi-card">
        <div class="kpi-label">Disputed Overcharges</div>
        <div class="kpi-val">${formattedDisputed}</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Total Recovered Credits</div>
        <div class="kpi-val green">${formattedRecovered}</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Broker Net Savings</div>
        <div class="kpi-val blue">${formattedNetRetained}</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Recovery Success Rate</div>
        <div class="kpi-val">${data.recoverySuccessRatePercent.toFixed(1)}%</div>
      </div>
    </div>

    <!-- Itemized Line Item Breakdown -->
    <div class="table-container">
      <table>
        <thead>
          <tr>
            <th>Dispute Ref #</th>
            <th>SCAC</th>
            <th>Carrier PRO #</th>
            <th>Discrepancy Category</th>
            <th style="text-align:right">Disputed $</th>
            <th>Credit Memo #</th>
            <th style="text-align:right">Recovered $</th>
            <th style="text-align:right">Net Retained</th>
            <th style="text-align:right">Fee (${ratePercent}%)</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
      </table>
    </div>

    <!-- Financial Totals Summary -->
    <div class="totals-box">
      <div class="totals-row">
        <span>Total Gross Credits Recovered:</span>
        <strong style="color:#059669">${formattedRecovered}</strong>
      </div>
      <div class="totals-row">
        <span>Broker Net Retained (80%):</span>
        <strong style="color:#2563eb">${formattedNetRetained}</strong>
      </div>
      <div class="totals-row bold">
        <span>Performance Contingency Fee Due (${ratePercent}%):</span>
        <span style="color:#0f172a">${formattedFee}</span>
      </div>
    </div>

    <!-- Double-Entry Ledger Certification -->
    <div class="ledger-cert">
      <strong>Double-Entry Ledger Certification (TX #${data.ledgerTransactionId.slice(-8).toUpperCase()}):</strong><br>
      • <strong>DEBIT</strong> <code>DISPUTE_RECOVERY</code>: ${formattedRecovered} (Recognized Asset)<br>
      • <strong>CREDIT</strong> <code>CARRIER_PAYABLE</code>: ${formattedNetRetained} (Broker Net Retained Savings)<br>
      • <strong>CREDIT</strong> <code>PLATFORM_REVENUE</code>: ${formattedFee} (Platform Performance Contingency Fee)
    </div>

    <div class="footer">
      Apex Freight Operating System • Re-Bill Audit & Dispute Monetization Engine • Confidential Financial Statement
    </div>
  </div>
</body>
</html>`;
  }

  /**
   * Generate Multi-Page PDF Document Buffer for Monthly Statement
   */
  public static async generateStatementPdf(data: {
    statementId: string;
    billingCycle: string;
    issuedAt: Date;
    contingencyRatePercent: number;
    brokerClientName: string;
    totalDisputesEvaluated: number;
    totalDisputesSettled: number;
    totalCarrierOverchargesDisputedCents: number;
    totalCreditsRecoveredCents: number;
    recoverySuccessRatePercent: number;
    totalPerformanceFeeCents: number;
    brokerNetRetainedCents: number;
    lineItems: RecoveryStatementLineItem[];
    ledgerTransactionId: string;
  }): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({
        size: 'LETTER',
        margins: { top: 36, bottom: 36, left: 36, right: 36 },
        info: {
          Title: `Monthly Recovery Statement - ${data.billingCycle}`,
          Author: 'Apex Freight Operating System',
          Subject: 'Dispute Recovery Contingency Settlement',
        },
      });

      const chunks: Buffer[] = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', (err) => reject(err));

      const ratePercent = data.contingencyRatePercent % 1 === 0
        ? data.contingencyRatePercent.toFixed(0)
        : data.contingencyRatePercent.toFixed(1);

      // Header Banner
      doc.rect(36, 36, 540, 4).fill('#0f172a');

      let y = 48;
      doc.fontSize(18).font('Helvetica-Bold').fillColor('#0f172a').text('APEX FREIGHT RECOVERY ENGINE', 36, y);
      doc.fontSize(8).font('Helvetica').fillColor('#64748b').text('Monthly Re-Bill Audit & Carrier Dispute Contingency Statement', 36, y + 20);
      doc.fontSize(8).fillColor('#64748b').text(`Client Partner: ${data.brokerClientName} • Automated Settlement & Monetization`, 36, y + 30);

      // Statement Metadata Block (Top Right)
      doc.fontSize(14).font('Helvetica-Bold').fillColor('#059669').text('RECOVERY STATEMENT', 350, y, { align: 'right' });
      doc.fontSize(9).font('Helvetica-Bold').fillColor('#0f172a').text(`Statement #: ${data.statementId}`, 350, y + 18, { align: 'right' });
      doc.fontSize(8).font('Helvetica').fillColor('#475569').text(`Billing Cycle: ${data.billingCycle}`, 350, y + 30, { align: 'right' });
      doc.fontSize(8).text(`Date: ${data.issuedAt.toISOString().slice(0, 10)}`, 350, y + 42, { align: 'right' });
      doc.fontSize(8).font('Helvetica-Bold').fillColor('#2563eb').text(`Contingency Rate: ${ratePercent}%`, 350, y + 54, { align: 'right' });

      y += 72;
      doc.rect(36, y, 540, 0.5).fill('#cbd5e1');

      // Executive Highlight Callout Box
      y += 12;
      doc.rect(36, y, 540, 36).fillAndStroke('#f0fdf4', '#86efac');
      doc.fontSize(10).font('Helvetica-Bold').fillColor('#166534').text(
        `Apex Freight Dispute Engine recovered ${this.formatCurrency(data.totalCreditsRecoveredCents)} in carrier overcharges this month. Performance fee (${ratePercent}%): ${this.formatCurrency(data.totalPerformanceFeeCents)}.`,
        48,
        y + 11
      );

      // KPI Summary Grid (4 Tiles)
      y += 46;
      const cardWidth = 127;
      const cardHeight = 44;
      const gap = 10;

      // Card 1: Disputed
      doc.rect(36, y, cardWidth, cardHeight).fillAndStroke('#f8fafc', '#e2e8f0');
      doc.fontSize(7).font('Helvetica-Bold').fillColor('#64748b').text('DISPUTED OVERCHARGES', 42, y + 6);
      doc.fontSize(12).font('Helvetica-Bold').fillColor('#0f172a').text(this.formatCurrency(data.totalCarrierOverchargesDisputedCents), 42, y + 20);

      // Card 2: Recovered
      doc.rect(36 + cardWidth + gap, y, cardWidth, cardHeight).fillAndStroke('#f8fafc', '#e2e8f0');
      doc.fontSize(7).font('Helvetica-Bold').fillColor('#64748b').text('TOTAL RECOVERED CREDITS', 42 + cardWidth + gap, y + 6);
      doc.fontSize(12).font('Helvetica-Bold').fillColor('#059669').text(this.formatCurrency(data.totalCreditsRecoveredCents), 42 + cardWidth + gap, y + 20);

      // Card 3: Net Retained
      doc.rect(36 + (cardWidth + gap) * 2, y, cardWidth, cardHeight).fillAndStroke('#f8fafc', '#e2e8f0');
      doc.fontSize(7).font('Helvetica-Bold').fillColor('#64748b').text('BROKER NET RETAINED', 42 + (cardWidth + gap) * 2, y + 6);
      doc.fontSize(12).font('Helvetica-Bold').fillColor('#2563eb').text(this.formatCurrency(data.brokerNetRetainedCents), 42 + (cardWidth + gap) * 2, y + 20);

      // Card 4: Success Rate
      doc.rect(36 + (cardWidth + gap) * 3, y, cardWidth, cardHeight).fillAndStroke('#f8fafc', '#e2e8f0');
      doc.fontSize(7).font('Helvetica-Bold').fillColor('#64748b').text('RECOVERY SUCCESS RATE', 42 + (cardWidth + gap) * 3, y + 6);
      doc.fontSize(12).font('Helvetica-Bold').fillColor('#0f172a').text(`${data.recoverySuccessRatePercent.toFixed(1)}%`, 42 + (cardWidth + gap) * 3, y + 20);

      // Table Header
      y += 56;
      doc.rect(36, y, 540, 20).fill('#0f172a');
      doc.fontSize(7).font('Helvetica-Bold').fillColor('#ffffff');
      doc.text('DISPUTE REF #', 42, y + 6);
      doc.text('SCAC', 140, y + 6);
      doc.text('PRO #', 180, y + 6);
      doc.text('CATEGORY', 250, y + 6);
      doc.text('DISPUTED', 340, y + 6, { width: 50, align: 'right' });
      doc.text('RECOVERED', 400, y + 6, { width: 55, align: 'right' });
      doc.text('NET BROKER', 465, y + 6, { width: 50, align: 'right' });
      doc.text('FEE (20%)', 520, y + 6, { width: 50, align: 'right' });
      y += 20;

      // Table Rows
      for (let i = 0; i < data.lineItems.length; i++) {
        const item = data.lineItems[i];
        const isEven = i % 2 === 0;
        doc.rect(36, y, 540, 18).fillAndStroke(isEven ? '#ffffff' : '#f8fafc', '#f1f5f9');
        doc.fontSize(7).font('Helvetica').fillColor('#0f172a');
        doc.text(item.disputeReferenceNumber.length > 18 ? item.disputeReferenceNumber.substring(0, 18) : item.disputeReferenceNumber, 42, y + 5);
        doc.font('Helvetica-Bold').text(item.carrierScac, 140, y + 5);
        doc.font('Helvetica').text(item.carrierProNumber, 180, y + 5);
        doc.text(item.discrepancyType.replace(/_/g, ' ').substring(0, 16), 250, y + 5);
        doc.text(this.formatCurrency(item.disputedAmountCents), 340, y + 5, { width: 50, align: 'right' });
        doc.font('Helvetica-Bold').fillColor('#059669').text(this.formatCurrency(item.recoveredAmountCents), 400, y + 5, { width: 55, align: 'right' });
        doc.fillColor('#2563eb').text(this.formatCurrency(item.brokerNetRetainedCents), 465, y + 5, { width: 50, align: 'right' });
        doc.fillColor('#0f172a').text(this.formatCurrency(item.contingencyFeeCents), 520, y + 5, { width: 50, align: 'right' });
        y += 18;

        if (y > 670 && i < data.lineItems.length - 1) {
          doc.addPage();
          y = 48;
        }
      }

      // Totals Box
      y += 12;
      if (y > 650) {
        doc.addPage();
        y = 48;
      }
      doc.rect(320, y, 256, 68).fillAndStroke('#f8fafc', '#cbd5e1');
      doc.fontSize(8).font('Helvetica').fillColor('#475569').text('Total Credits Recovered:', 330, y + 8);
      doc.font('Helvetica-Bold').fillColor('#059669').text(this.formatCurrency(data.totalCreditsRecoveredCents), 460, y + 8, { width: 105, align: 'right' });

      doc.font('Helvetica').fillColor('#475569').text('Broker Net Retained:', 330, y + 24);
      doc.font('Helvetica-Bold').fillColor('#2563eb').text(this.formatCurrency(data.brokerNetRetainedCents), 460, y + 24, { width: 105, align: 'right' });

      doc.rect(330, y + 38, 236, 0.5).fill('#cbd5e1');

      doc.fontSize(9).font('Helvetica-Bold').fillColor('#0f172a').text(`PERFORMANCE FEE (${ratePercent}%):`, 330, y + 48);
      doc.fontSize(10).font('Helvetica-Bold').fillColor('#0f172a').text(this.formatCurrency(data.totalPerformanceFeeCents), 460, y + 46, { width: 105, align: 'right' });

      // Ledger Certification Box
      y += 80;
      doc.rect(36, y, 540, 48).fillAndStroke('#f1f5f9', '#2563eb');
      doc.fontSize(8).font('Helvetica-Bold').fillColor('#1e40af').text(`DOUBLE-ENTRY LEDGER SETTLEMENT CERTIFICATE (TX #${data.ledgerTransactionId.slice(-8).toUpperCase()}):`, 44, y + 7);
      doc.fontSize(7).font('Helvetica').fillColor('#334155');
      doc.text(`• DEBIT  DISPUTE_RECOVERY: ${this.formatCurrency(data.totalCreditsRecoveredCents)} (Asset Realization)`, 44, y + 20);
      doc.text(`• CREDIT CARRIER_PAYABLE:  ${this.formatCurrency(data.brokerNetRetainedCents)} (Broker Net Retained Credit)`, 44, y + 30);
      doc.text(`• CREDIT PLATFORM_REVENUE: ${this.formatCurrency(data.totalPerformanceFeeCents)} (Platform Contingency Fee)`, 300, y + 30);

      // Footer
      doc.fontSize(7).font('Helvetica').fillColor('#94a3b8').text('Apex Freight OS • Revenue Driver #1 • Automated Performance Recovery', 36, 750, { align: 'center' });

      doc.end();
    });
  }
}

export const calculateContingencyFee =
  RecoveryBillingEngine.calculateContingencyFee.bind(RecoveryBillingEngine);
export const generateMonthlyRecoveryStatement =
  RecoveryBillingEngine.generateMonthlyRecoveryStatement.bind(RecoveryBillingEngine);

