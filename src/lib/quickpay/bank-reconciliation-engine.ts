import { z } from 'zod';
import { dbClient } from '../../db/client';
import { generateUuidV7 } from '../uuidv7';
import {
  BankStatement,
  BankStatementLine,
  BankStatementFormat,
  BankReconciliationStatus,
  BankLineMatchStatus,
  FinancialLedgerEntry,
} from '../../db/schema';

export interface RawStatementLineInput {
  transactionDate: string | Date;
  valueDate?: string | Date;
  amountCents: number;
  entryType: 'DEBIT' | 'CREDIT';
  bankReferenceNumber?: string;
  description: string;
}

export interface IngestStatementInput {
  tenantId: string;
  statementDate: string | Date;
  bankName: string;
  accountNumberMasked: string;
  openingBalanceCents: number;
  closingBalanceCents: number;
  feedFormat?: BankStatementFormat;
  lines: RawStatementLineInput[];
}

export interface ReconciliationReport {
  statementId: string;
  tenantId: string;
  statementDate: string;
  bankName: string;
  accountNumberMasked: string;
  openingBalanceCents: number;
  closingBalanceCents: number;
  totalDebitsCents: number;
  totalCreditsCents: number;
  netStatementChangeCents: number;
  
  matchedLinesCount: number;
  unmatchedLinesCount: number;
  timingDifferencesCount: number;
  totalLinesCount: number;
  
  reconciliationStatus: BankReconciliationStatus;
  calculatedClosingBalanceCents: number;
  unreconciledVarianceCents: number;
  isZeroDiscrepancy: boolean;
  
  floatMetrics: WorkingCapitalFloatMetrics;
  lineDetails: Array<{
    lineId: string;
    description: string;
    amountCents: number;
    entryType: 'DEBIT' | 'CREDIT';
    matchStatus: BankLineMatchStatus;
    matchedLedgerEntryId?: string | null;
  }>;
}

export interface WorkingCapitalFloatMetrics {
  totalEscrowFloatCents: number;
  disbursedInTransitFloatCents: number;
  uncollectedShipperReceivablesCents: number;
  netWorkingCapitalPositionCents: number;
  workingCapitalFacilityLimitCents: number;
  workingCapitalUtilizationPercent: number;
}

export class BankReconciliationEngine {
  /**
   * Ingest a bank statement feed and save statement with its line items
   */
  public static async ingestStatement(input: IngestStatementInput): Promise<BankStatement> {
    dbClient.setTenantContext(input.tenantId);

    const statementDate = new Date(input.statementDate);
    const totalDebitsCents = input.lines
      .filter((l) => l.entryType === 'DEBIT')
      .reduce((sum, l) => sum + l.amountCents, 0);
    const totalCreditsCents = input.lines
      .filter((l) => l.entryType === 'CREDIT')
      .reduce((sum, l) => sum + l.amountCents, 0);

    const statementId = generateUuidV7();
    const statement = await dbClient.insertBankStatement({
      id: statementId,
      tenantId: input.tenantId,
      statementDate,
      bankName: input.bankName,
      accountNumberMasked: input.accountNumberMasked,
      openingBalanceCents: input.openingBalanceCents,
      closingBalanceCents: input.closingBalanceCents,
      totalDebitsCents,
      totalCreditsCents,
      feedFormat: input.feedFormat || 'PLAID_STREAM',
      reconciliationStatus: 'UNRECONCILED',
      unreconciledVarianceCents: 0,
    });

    for (const line of input.lines) {
      await dbClient.insertBankStatementLine({
        tenantId: input.tenantId,
        statementId,
        transactionDate: new Date(line.transactionDate),
        valueDate: line.valueDate ? new Date(line.valueDate) : new Date(line.transactionDate),
        amountCents: line.amountCents,
        entryType: line.entryType,
        bankReferenceNumber: line.bankReferenceNumber || null,
        description: line.description,
        matchStatus: 'UNMATCHED',
      });
    }

    return statement;
  }

  /**
   * Reconcile statement lines against internal double-entry ledger entries
   */
  public static async reconcileStatement(
    tenantId: string,
    statementId: string,
    options: {
      workingCapitalFacilityLimitCents?: number;
      reconciledBy?: string;
    } = {}
  ): Promise<ReconciliationReport> {
    dbClient.setTenantContext(tenantId);

    const statement = await dbClient.getBankStatementById(statementId);
    if (!statement) {
      throw new Error(`Bank statement ${statementId} not found`);
    }

    const lines = await dbClient.getBankStatementLines(statementId);
    const ledgerEntries = await dbClient.getLedgerEntriesByTenant(tenantId);

    // Track matched ledger entry IDs to prevent double matching
    const matchedLedgerIds = new Set<string>();

    let matchedCount = 0;
    let timingDiffCount = 0;
    let unmatchedCount = 0;

    const lineDetails: ReconciliationReport['lineDetails'] = [];

    for (const line of lines) {
      // Find candidate ledger entry:
      // Bank DEBIT (money out) -> corresponds to CASH_ESCROW CREDIT or CARRIER_PAYABLE
      // Bank CREDIT (money in) -> corresponds to CASH_ESCROW DEBIT or SHIPPER_RECEIVABLE
      const targetLedgerEntryType = line.entryType === 'DEBIT' ? 'CREDIT' : 'DEBIT';

      let matchedEntry: FinancialLedgerEntry | undefined;

      // 1. Exact amount and entry type match
      for (const entry of ledgerEntries) {
        if (
          !matchedLedgerIds.has(entry.id) &&
          entry.amountCents === line.amountCents &&
          entry.entryType === targetLedgerEntryType
        ) {
          // Check date proximity (within 5 business days for settlement)
          const dateDiffDays = Math.abs(
            (new Date(entry.createdAt).getTime() - line.transactionDate.getTime()) / (1000 * 60 * 60 * 24)
          );

          if (dateDiffDays <= 5) {
            matchedEntry = entry;
            break;
          }
        }
      }

      if (matchedEntry) {
        matchedLedgerIds.add(matchedEntry.id);
        line.matchStatus = 'MATCHED';
        line.matchedLedgerEntryId = matchedEntry.id;
        line.matchedAt = new Date();
        matchedCount++;
      } else {
        // Check if it's a timing difference (e.g. pending ACH batch)
        const partialMatch = ledgerEntries.find(
          (e) => !matchedLedgerIds.has(e.id) && e.amountCents === line.amountCents
        );

        if (partialMatch) {
          line.matchStatus = 'TIMING_DIFFERENCE';
          timingDiffCount++;
        } else {
          line.matchStatus = 'UNMATCHED';
          unmatchedCount++;
        }
      }

      lineDetails.push({
        lineId: line.id,
        description: line.description,
        amountCents: line.amountCents,
        entryType: line.entryType,
        matchStatus: line.matchStatus,
        matchedLedgerEntryId: line.matchedLedgerEntryId || null,
      });
    }

    // Mathematical Variance Verification
    // Calculated Closing = Opening + Credits - Debits
    const calculatedClosingBalanceCents =
      statement.openingBalanceCents + statement.totalCreditsCents - statement.totalDebitsCents;
    const unreconciledVarianceCents = Math.abs(statement.closingBalanceCents - calculatedClosingBalanceCents);
    const isZeroDiscrepancy = unreconciledVarianceCents === 0;

    const reconciliationStatus: BankReconciliationStatus =
      isZeroDiscrepancy && unmatchedCount === 0
        ? 'FULLY_RECONCILED'
        : isZeroDiscrepancy && timingDiffCount > 0
        ? 'PARTIALLY_RECONCILED'
        : 'DISCREPANCY_FLAGGED';

    // Update statement record
    statement.reconciliationStatus = reconciliationStatus;
    statement.unreconciledVarianceCents = unreconciledVarianceCents;
    statement.reconciledAt = new Date();
    statement.reconciledBy = options.reconciledBy || 'Automated Bank Reconciliation Engine';

    // Float Analysis
    const floatMetrics = this.calculateWorkingCapitalFloat(
      ledgerEntries,
      statement.closingBalanceCents,
      options.workingCapitalFacilityLimitCents || 500_000_00 // $500,000.00 standard credit line
    );

    return {
      statementId: statement.id,
      tenantId: statement.tenantId,
      statementDate: statement.statementDate.toISOString().split('T')[0],
      bankName: statement.bankName,
      accountNumberMasked: statement.accountNumberMasked,
      openingBalanceCents: statement.openingBalanceCents,
      closingBalanceCents: statement.closingBalanceCents,
      totalDebitsCents: statement.totalDebitsCents,
      totalCreditsCents: statement.totalCreditsCents,
      netStatementChangeCents: statement.totalCreditsCents - statement.totalDebitsCents,
      matchedLinesCount: matchedCount,
      unmatchedLinesCount: unmatchedCount,
      timingDifferencesCount: timingDiffCount,
      totalLinesCount: lines.length,
      reconciliationStatus,
      calculatedClosingBalanceCents,
      unreconciledVarianceCents,
      isZeroDiscrepancy,
      floatMetrics,
      lineDetails,
    };
  }

  /**
   * Working Capital Float Analyzer
   */
  public static calculateWorkingCapitalFloat(
    ledgerEntries: FinancialLedgerEntry[],
    clearedBankBalanceCents: number,
    facilityLimitCents: number = 500_000_00
  ): WorkingCapitalFloatMetrics {
    // 1. Total Escrow Float (Net Cash Escrow balance)
    const escrowCredits = ledgerEntries
      .filter((e) => e.accountType === 'CASH_ESCROW' && e.entryType === 'CREDIT')
      .reduce((sum, e) => sum + e.amountCents, 0);
    const escrowDebits = ledgerEntries
      .filter((e) => e.accountType === 'CASH_ESCROW' && e.entryType === 'DEBIT')
      .reduce((sum, e) => sum + e.amountCents, 0);
    const totalEscrowFloatCents = Math.max(0, escrowDebits - escrowCredits);

    // 2. Disbursed In-Transit Float (QuickPay funds disbursed but waiting for customer remittance)
    const quickpayRevenueCents = ledgerEntries
      .filter((e) => e.accountType === 'QUICKPAY_REVENUE' && e.entryType === 'CREDIT')
      .reduce((sum, e) => sum + e.amountCents, 0);

    const disbursedInTransitFloatCents = escrowCredits; // Cash pushed to carriers in advance

    // 3. Uncollected Shipper Receivables
    const uncollectedShipperReceivablesCents = ledgerEntries
      .filter((e) => e.accountType === 'SHIPPER_RECEIVABLE' && e.entryType === 'DEBIT')
      .reduce((sum, e) => sum + e.amountCents, 0);

    // 4. Net Working Capital Position
    const netWorkingCapitalPositionCents = clearedBankBalanceCents + uncollectedShipperReceivablesCents - disbursedInTransitFloatCents;

    // 5. Facility Utilization %
    const utilizedFloatCents = disbursedInTransitFloatCents;
    const workingCapitalUtilizationPercent =
      facilityLimitCents > 0
        ? Math.min(100, parseFloat(((utilizedFloatCents / facilityLimitCents) * 100).toFixed(2)))
        : 0;

    return {
      totalEscrowFloatCents,
      disbursedInTransitFloatCents,
      uncollectedShipperReceivablesCents,
      netWorkingCapitalPositionCents,
      workingCapitalFacilityLimitCents: facilityLimitCents,
      workingCapitalUtilizationPercent,
    };
  }
}
