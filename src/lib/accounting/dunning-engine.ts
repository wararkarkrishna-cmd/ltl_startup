import { z } from 'zod';
import { dbClient } from '../../db/client';
import { CustomerInvoice, DunningRecord, DunningStage } from '../../db/schema';
import { ArAgingEngine } from './ar-aging-engine';

// ============================================================================
// CONSTANTS & SCHEMAS
// ============================================================================

export const LATE_FEE_MONTHLY_RATE = 0.015; // 1.5% per month late fee

export interface DunningMessageTemplate {
  stage: DunningStage;
  subject: string;
  bodySnippet: string;
  emailHtml: string;
  lateFeeCents: number;
  paymentUrl: string;
  creditHoldTriggered: boolean;
}

export interface CreditHoldAction {
  accountId: string;
  accountName: string;
  invoiceId: string;
  invoiceNumber: string;
  amountCents: number;
  daysPastDue: number;
  contactEmail: string;
  triggeredAt: Date;
}

export interface DunningDispatchResult {
  tenantId: string;
  asOfDate: string; // YYYY-MM-DD
  totalInvoicesEvaluated: number;
  eligibleDunningCount: number;
  alreadyDispatchedCount: number;
  dispatchedActions: DunningRecord[];
  creditHoldsTriggered: CreditHoldAction[];
  summaryByStage: Record<DunningStage, number>;
  generatedAt: Date;
}

// ============================================================================
// DUNNING ENGINE IMPLEMENTATION
// ============================================================================

export class DunningEngine {
  /**
   * Evaluates the appropriate dunning stage based on daysPastDue:
   * - Day -5: REMINDER_T_MINUS_5  (Upcoming reminder)
   * - Day 0:  DUE_TODAY_T_0       (Due today notice)
   * - Day +7: PAST_DUE_T_PLUS_7   (Friendly past-due reminder)
   * - Day +14: URGENT_T_PLUS_14   (Urgent past-due + 1.5% late fee warning)
   * - Day +30+: FINAL_DEMAND_T_PLUS_30 (Final demand + automatic credit hold)
   */
  public static determineDunningStage(daysPastDue: number): DunningStage | null {
    if (daysPastDue >= 30) {
      return 'FINAL_DEMAND_T_PLUS_30';
    }
    if (daysPastDue >= 14) {
      return 'URGENT_T_PLUS_14';
    }
    if (daysPastDue >= 7) {
      return 'PAST_DUE_T_PLUS_7';
    }
    if (daysPastDue === 0) {
      return 'DUE_TODAY_T_0';
    }
    if (daysPastDue === -5 || daysPastDue === -4) {
      return 'REMINDER_T_MINUS_5';
    }
    return null;
  }

  /**
   * Generates formatted dunning subject, snippet, HTML email, and payment links
   */
  public static generateDunningTemplate(
    invoice: CustomerInvoice,
    stage: DunningStage,
    daysPastDue: number
  ): DunningMessageTemplate {
    const formattedAmount = (invoice.totalAmountCents / 100).toFixed(2);
    const invoiceNumber = invoice.invoiceNumber;
    const poRef = invoice.customerPoNumber ? `(PO: ${invoice.customerPoNumber})` : '';
    const paymentUrl = `https://pay.freightos.app/inv/${invoiceNumber}?token=${invoice.id.slice(0, 8)}`;

    let lateFeeCents = 0;
    if (stage === 'URGENT_T_PLUS_14' || stage === 'FINAL_DEMAND_T_PLUS_30') {
      lateFeeCents = Math.round(invoice.totalAmountCents * LATE_FEE_MONTHLY_RATE);
    }
    const formattedLateFee = (lateFeeCents / 100).toFixed(2);

    let subject = '';
    let bodySnippet = '';
    let creditHoldTriggered = false;

    switch (stage) {
      case 'REMINDER_T_MINUS_5':
        subject = `[COURTESY REMINDER] Invoice ${invoiceNumber} ${poRef} Due in 5 Days - $${formattedAmount}`;
        bodySnippet = `Friendly reminder: Freight invoice ${invoiceNumber} for $${formattedAmount} is scheduled for payment on ${invoice.dueDate}. Direct payment link: ${paymentUrl}`;
        break;

      case 'DUE_TODAY_T_0':
        subject = `[PAYMENT DUE TODAY] Invoice ${invoiceNumber} ${poRef} - $${formattedAmount}`;
        bodySnippet = `Notice: Freight invoice ${invoiceNumber} ($${formattedAmount}) is due today (${invoice.dueDate}). Please process payment via ACH/RTP or online pay link: ${paymentUrl}`;
        break;

      case 'PAST_DUE_T_PLUS_7':
        subject = `[PAST DUE NOTICE] Invoice ${invoiceNumber} ${poRef} - 7 Days Overdue ($${formattedAmount})`;
        bodySnippet = `Important: Invoice ${invoiceNumber} was due on ${invoice.dueDate} and is now 7 days past due. Please remit $${formattedAmount} promptly or submit payment confirmation to avoid late fees.`;
        break;

      case 'URGENT_T_PLUS_14':
        subject = `[URGENT: 14 DAYS OVERDUE] Invoice ${invoiceNumber} - Late Fee Warning ($${formattedAmount})`;
        bodySnippet = `URGENT: Invoice ${invoiceNumber} is 14 days overdue. A 1.5% monthly late fee ($${formattedLateFee}) will be assessed if payment is not received within 48 hours. Pay now: ${paymentUrl}`;
        break;

      case 'FINAL_DEMAND_T_PLUS_30':
        creditHoldTriggered = true;
        subject = `[FINAL DEMAND & CREDIT HOLD] Invoice ${invoiceNumber} - 30+ Days Overdue ($${formattedAmount})`;
        bodySnippet = `FINAL DEMAND: Invoice ${invoiceNumber} is ${daysPastDue} days past due. Account has been placed on CREDIT HOLD. New shipment tendering is suspended until the balance of $${formattedAmount} (plus late fee $${formattedLateFee}) is settled.`;
        break;
    }

    const emailHtml = `
      <div style="font-family: Arial, sans-serif; color: #1e293b; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 8px;">
        <div style="background-color: #0f172a; color: #ffffff; padding: 16px; border-radius: 6px; text-align: center; margin-bottom: 20px;">
          <h2 style="margin: 0; font-size: 20px;">Freight Billing & Accounts Receivable</h2>
          <p style="margin: 4px 0 0 0; font-size: 13px; color: #94a3b8;">Ref: ${invoiceNumber} | ${invoice.shipperName}</p>
        </div>
        
        <p style="font-size: 15px; line-height: 1.6;">Dear Accounts Payable,</p>
        
        <p style="font-size: 14px; line-height: 1.6; color: #334155;">${bodySnippet}</p>
        
        <div style="background-color: #f8fafc; border: 1px solid #cbd5e1; border-radius: 6px; padding: 16px; margin: 20px 0;">
          <table style="width: 100%; font-size: 14px; border-collapse: collapse;">
            <tr>
              <td style="padding: 6px 0; color: #64748b;">Invoice Number:</td>
              <td style="padding: 6px 0; font-weight: bold; text-align: right;">${invoiceNumber}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: #64748b;">Customer PO#:</td>
              <td style="padding: 6px 0; font-weight: bold; text-align: right;">${invoice.customerPoNumber || 'N/A'}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: #64748b;">Invoice Date:</td>
              <td style="padding: 6px 0; text-align: right;">${invoice.invoiceDate}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: #64748b;">Due Date:</td>
              <td style="padding: 6px 0; font-weight: bold; text-align: right; color: ${daysPastDue > 0 ? '#dc2626' : '#16a34a'};">${invoice.dueDate} (${daysPastDue > 0 ? `${daysPastDue}d past due` : `${Math.abs(daysPastDue)}d remaining`})</td>
            </tr>
            <tr style="border-top: 1px solid #e2e8f0;">
              <td style="padding: 10px 0 6px 0; font-weight: bold; font-size: 16px;">Principal Amount:</td>
              <td style="padding: 10px 0 6px 0; font-weight: bold; font-size: 16px; text-align: right; color: #0f172a;">$${formattedAmount}</td>
            </tr>
            ${
              lateFeeCents > 0
                ? `
            <tr>
              <td style="padding: 4px 0; color: #dc2626; font-size: 13px;">Assessed Late Fee (1.5%):</td>
              <td style="padding: 4px 0; color: #dc2626; font-weight: bold; text-align: right; font-size: 13px;">+$${formattedLateFee}</td>
            </tr>
            <tr style="border-top: 2px solid #0f172a;">
              <td style="padding: 8px 0; font-weight: bold; font-size: 17px;">Total Due:</td>
              <td style="padding: 8px 0; font-weight: bold; font-size: 17px; text-align: right; color: #dc2626;">$${((invoice.totalAmountCents + lateFeeCents) / 100).toFixed(2)}</td>
            </tr>`
                : ''
            }
          </table>
        </div>

        <div style="text-align: center; margin: 24px 0;">
          <a href="${paymentUrl}" style="background-color: #2563eb; color: #ffffff; text-decoration: none; padding: 12px 28px; font-weight: bold; border-radius: 6px; display: inline-block; font-size: 15px;">
            Pay Online via Credit / ACH / RTP &rarr;
          </a>
        </div>

        <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #e2e8f0; font-size: 12px; color: #64748b;">
          <p style="margin: 0 0 4px 0;"><strong>Wire / ACH Remittance Instructions:</strong></p>
          <p style="margin: 0;">Bank: ${invoice.remitInstructions.bankName} | Routing: ${invoice.remitInstructions.routingNumber} | Account: ${invoice.remitInstructions.accountNumber}</p>
          <p style="margin: 4px 0 0 0;">Remit Advice To: ${invoice.remitInstructions.remitEmail}</p>
        </div>
      </div>
    `;

    return {
      stage,
      subject,
      bodySnippet,
      emailHtml,
      lateFeeCents,
      paymentUrl,
      creditHoldTriggered,
    };
  }

  /**
   * Evaluates all open customer invoices for a tenant, checks dunning eligibility,
   * prevents duplicate notifications, dispatches multi-stage dunning, triggers credit holds,
   * and persists records in dbClient.
   */
  public static async evaluateAndDispatchDunning(
    tenantId: string,
    asOfDate?: string
  ): Promise<DunningDispatchResult> {
    dbClient.setTenantContext(tenantId);

    const currentDateStr = asOfDate || new Date().toISOString().split('T')[0];

    // 1. Fetch All Customer Invoices
    const allInvoices = await dbClient.getCustomerInvoices(tenantId);
    const openInvoices = allInvoices.filter(
      (inv) => inv.status !== 'PAID' && !inv.paidAt
    );

    const dispatchedActions: DunningRecord[] = [];
    const creditHoldsTriggered: CreditHoldAction[] = [];

    const summaryByStage: Record<DunningStage, number> = {
      REMINDER_T_MINUS_5: 0,
      DUE_TODAY_T_0: 0,
      PAST_DUE_T_PLUS_7: 0,
      URGENT_T_PLUS_14: 0,
      FINAL_DEMAND_T_PLUS_30: 0,
    };

    let eligibleDunningCount = 0;
    let alreadyDispatchedCount = 0;

    for (const invoice of openInvoices) {
      const daysPastDue = ArAgingEngine.diffInDays(currentDateStr, invoice.dueDate);
      const stage = this.determineDunningStage(daysPastDue);

      if (!stage) {
        continue;
      }

      eligibleDunningCount++;

      // 2. Deduplication Guard: Check if this invoice has already received a dunning record for this stage
      const existingRecords = await dbClient.getDunningRecordsByInvoice(tenantId, invoice.id);
      const hasAlreadyDispatched = existingRecords.some((r) => r.dunningStage === stage);

      if (hasAlreadyDispatched) {
        alreadyDispatchedCount++;
        continue;
      }

      // 3. Generate Dunning Email Content & Actions
      const template = this.generateDunningTemplate(invoice, stage, daysPastDue);

      // 4. If Credit Hold Triggered (Final Demand 30+ days), execute credit hold
      if (template.creditHoldTriggered && invoice.customerAccountId) {
        const account = dbClient.accounts.get(invoice.customerAccountId);
        creditHoldsTriggered.push({
          accountId: invoice.customerAccountId,
          accountName: account?.name || invoice.shipperName,
          invoiceId: invoice.id,
          invoiceNumber: invoice.invoiceNumber,
          amountCents: invoice.totalAmountCents,
          daysPastDue,
          contactEmail: invoice.shipperEmail,
          triggeredAt: new Date(),
        });
      }

      // 5. Persist Dunning Record in Database
      const dunningRecord = await dbClient.insertDunningRecord({
        tenantId,
        invoiceId: invoice.id,
        customerAccountId: invoice.customerAccountId || null,
        dunningStage: stage,
        daysPastDue,
        recipientEmail: invoice.shipperEmail,
        subject: template.subject,
        bodySnippet: template.bodySnippet,
        status: 'DISPATCHED',
        creditHoldTriggered: template.creditHoldTriggered,
        dispatchedAt: new Date(),
      });

      dispatchedActions.push(dunningRecord);
      summaryByStage[stage]++;

      // 6. Update invoice status to OVERDUE if past due
      if (daysPastDue > 0 && invoice.status !== 'OVERDUE') {
        invoice.status = 'OVERDUE';
        invoice.updatedAt = new Date();
        dbClient.customerInvoices.set(invoice.id, invoice);
      }
    }

    return {
      tenantId,
      asOfDate: currentDateStr,
      totalInvoicesEvaluated: openInvoices.length,
      eligibleDunningCount,
      alreadyDispatchedCount,
      dispatchedActions,
      creditHoldsTriggered,
      summaryByStage,
      generatedAt: new Date(),
    };
  }
}
