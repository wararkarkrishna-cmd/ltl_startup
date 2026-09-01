import { z } from 'zod';
import { generateUuidV7 } from '../uuidv7';
import { dbClient } from '../../db/client';
import {
  FinancialLedgerEntry,
  FinancialLedgerEntrySchema,
  LEDGER_ACCOUNT_TYPES,
  LedgerAccountType,
  LEDGER_ENTRY_TYPES,
  LedgerEntryType,
} from '../../db/schema';

export interface PostQuickPayPayoutLedgerInput {
  tenantId: string;
  transactionId: string;
  shipmentId: string;
  carrierScac: string;
  carrierName: string;
  grossAmountCents: number;
  feeAmountCents: number;
  netPayoutCents: number;
  currency?: 'USD' | 'CAD';
  description?: string;
}

export interface PostShipperCollectionLedgerInput {
  tenantId: string;
  transactionId: string;
  shipmentId: string;
  shipperName: string;
  totalCollectedCents: number;
  currency?: 'USD' | 'CAD';
  description?: string;
}

export interface TrialBalanceItem {
  accountType: LedgerAccountType;
  totalDebitCents: number;
  totalCreditCents: number;
  netBalanceCents: number;
}

export interface TrialBalanceResult {
  isBalanced: boolean;
  totalDebitsCents: number;
  totalCreditsCents: number;
  discrepancyCents: number;
  accounts: TrialBalanceItem[];
  verifiedAt: string;
}

export class DoubleEntryLedgerEngine {
  /**
   * Posts balanced double-entry ledger entries for a QuickPay Payout
   * 1. DEBIT: CARRIER_PAYABLE (Gross Amount)
   * 2. CREDIT: CASH_ESCROW (Net Disbursed)
   * 3. CREDIT: QUICKPAY_REVENUE (Fee Spread)
   */
  public static async postQuickPayPayout(
    input: PostQuickPayPayoutLedgerInput
  ): Promise<{ entries: FinancialLedgerEntry[]; isBalanced: boolean }> {
    const currency = input.currency || 'USD';
    const entriesToPost: Omit<FinancialLedgerEntry, 'id' | 'createdAt'>[] = [];

    // 1. Debit Carrier Payable (clearing the liability)
    entriesToPost.push({
      tenantId: input.tenantId,
      transactionId: input.transactionId,
      accountType: 'CARRIER_PAYABLE',
      entryType: 'DEBIT',
      amountCents: input.grossAmountCents,
      currency,
      description: input.description || `QuickPay Settlement for ${input.carrierName} (${input.carrierScac}) - Gross Payable Cleared`,
    });

    // 2. Credit Cash Escrow (cash disbursed to carrier)
    entriesToPost.push({
      tenantId: input.tenantId,
      transactionId: input.transactionId,
      accountType: 'CASH_ESCROW',
      entryType: 'CREDIT',
      amountCents: input.netPayoutCents,
      currency,
      description: `QuickPay Outbound Rail Transfer to ${input.carrierName} - Net Payout`,
    });

    // 3. Credit QuickPay Revenue (if fee > 0)
    if (input.feeAmountCents > 0) {
      entriesToPost.push({
        tenantId: input.tenantId,
        transactionId: input.transactionId,
        accountType: 'QUICKPAY_REVENUE',
        entryType: 'CREDIT',
        amountCents: input.feeAmountCents,
        currency,
        description: `QuickPay Discount Fee Revenue Earned (Load ${input.shipmentId})`,
      });
    }

    // Verify mathematical integrity: sum(Debits) === sum(Credits)
    const totalDebits = entriesToPost
      .filter((e) => e.entryType === 'DEBIT')
      .reduce((sum, e) => sum + e.amountCents, 0);
    const totalCredits = entriesToPost
      .filter((e) => e.entryType === 'CREDIT')
      .reduce((sum, e) => sum + e.amountCents, 0);

    if (totalDebits !== totalCredits) {
      throw new Error(
        `Ledger Invariant Violation: Debits ($${(totalDebits / 100).toFixed(2)}) do not balance Credits ($${(totalCredits / 100).toFixed(2)})`
      );
    }

    // Persist all entries to database client
    const savedEntries: FinancialLedgerEntry[] = [];
    for (const entry of entriesToPost) {
      const saved = await dbClient.insertLedgerEntry(entry);
      savedEntries.push(saved);
    }

    return {
      entries: savedEntries,
      isBalanced: totalDebits === totalCredits,
    };
  }

  /**
   * Posts balanced double-entry ledger entries for Shipper Accounts Receivable collection
   */
  public static async postShipperCollection(
    input: PostShipperCollectionLedgerInput
  ): Promise<{ entries: FinancialLedgerEntry[]; isBalanced: boolean }> {
    const currency = input.currency || 'USD';
    const entriesToPost: Omit<FinancialLedgerEntry, 'id' | 'createdAt'>[] = [
      {
        tenantId: input.tenantId,
        transactionId: input.transactionId,
        accountType: 'CASH_ESCROW',
        entryType: 'DEBIT',
        amountCents: input.totalCollectedCents,
        currency,
        description: input.description || `Inbound Payment Collection from ${input.shipperName}`,
      },
      {
        tenantId: input.tenantId,
        transactionId: input.transactionId,
        accountType: 'SHIPPER_RECEIVABLE',
        entryType: 'CREDIT',
        amountCents: input.totalCollectedCents,
        currency,
        description: `Shipper Receivable Cleared for ${input.shipperName}`,
      },
    ];

    const savedEntries: FinancialLedgerEntry[] = [];
    for (const entry of entriesToPost) {
      const saved = await dbClient.insertLedgerEntry(entry);
      savedEntries.push(saved);
    }

    return {
      entries: savedEntries,
      isBalanced: true,
    };
  }

  /**
   * Calculates dynamic Trial Balance and audits debit/credit reconciliation for a tenant
   */
  public static async calculateTrialBalance(tenantId: string): Promise<TrialBalanceResult> {
    const entries = await dbClient.getLedgerEntriesByTenant(tenantId);
    const accountMap: Record<LedgerAccountType, { debit: number; credit: number }> = {
      CARRIER_PAYABLE: { debit: 0, credit: 0 },
      SHIPPER_RECEIVABLE: { debit: 0, credit: 0 },
      QUICKPAY_REVENUE: { debit: 0, credit: 0 },
      CASH_ESCROW: { debit: 0, credit: 0 },
      DISPUTE_RECOVERY: { debit: 0, credit: 0 },
      PLATFORM_REVENUE: { debit: 0, credit: 0 },
    };

    let totalDebitsCents = 0;
    let totalCreditsCents = 0;

    for (const entry of entries) {
      if (entry.entryType === 'DEBIT') {
        accountMap[entry.accountType].debit += entry.amountCents;
        totalDebitsCents += entry.amountCents;
      } else {
        accountMap[entry.accountType].credit += entry.amountCents;
        totalCreditsCents += entry.amountCents;
      }
    }

    const accounts: TrialBalanceItem[] = Object.entries(accountMap).map(([accountType, val]) => ({
      accountType: accountType as LedgerAccountType,
      totalDebitCents: val.debit,
      totalCreditCents: val.credit,
      netBalanceCents: val.debit - val.credit,
    }));

    const discrepancyCents = Math.abs(totalDebitsCents - totalCreditsCents);
    const isBalanced = discrepancyCents === 0;

    return {
      isBalanced,
      totalDebitsCents,
      totalCreditsCents,
      discrepancyCents,
      accounts,
      verifiedAt: new Date().toISOString(),
    };
  }
}
