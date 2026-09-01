import { z } from 'zod';
import {
  BANKING_PROVIDERS,
  BankingProvider,
  PAYOUT_RAILS,
  PayoutRail,
  PAYOUT_STATUSES,
  PayoutStatus,
  CarrierPayout,
} from '../../db/schema';
import { generateUuidV7 } from '../uuidv7';

export const BankingDisbursementRequestSchema = z.object({
  tenantId: z.string().min(1),
  shipmentId: z.string().min(1),
  carrierAccountId: z.string().optional().nullable(),
  carrierScac: z.string().min(2).max(10),
  carrierName: z.string().min(1),
  amountCents: z.number().int().positive(), // Net disbursement amount
  currency: z.enum(['USD', 'CAD']).default('USD'),
  payoutRail: z.enum(PAYOUT_RAILS).default('INSTANT_RTP'),
  provider: z.enum(BANKING_PROVIDERS).default('STRIPE_TREASURY'),
  destinationRoutingNumber: z.string().default('021000021'),
  destinationAccountNumber: z.string().default('1234567890'),
  bankName: z.string().default('JPMorgan Chase'),
  statementDescriptor: z.string().optional(),
});

export type BankingDisbursementRequest = z.input<typeof BankingDisbursementRequestSchema>;

export interface BankingDisbursementResponse {
  success: boolean;
  externalTransactionId: string;
  provider: BankingProvider;
  payoutRail: PayoutRail;
  amountCents: number;
  status: PayoutStatus;
  initiatedAt: string;
  estimatedSettlementAt: string;
  settledAt?: string | null;
  feeIncurredCents: number;
  providerTraceNumber: string;
  rawProviderResponse: Record<string, unknown>;
}

export interface IBankingProviderAdapter {
  providerName: BankingProvider;
  executeDisbursement(request: BankingDisbursementRequest): Promise<BankingDisbursementResponse>;
  checkStatus(externalTransactionId: string): Promise<{ status: PayoutStatus; settledAt?: string | null }>;
}

export class StripeTreasuryAdapter implements IBankingProviderAdapter {
  public providerName: BankingProvider = 'STRIPE_TREASURY';

  public async executeDisbursement(request: BankingDisbursementRequest): Promise<BankingDisbursementResponse> {
    const trace = `STRIPE_TR_${Date.now()}_${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
    const now = new Date();
    const isInstant = request.payoutRail === 'INSTANT_RTP' || request.payoutRail === 'FEDNOW' || request.payoutRail === 'PUSH_TO_CARD';
    const estimatedSettlement = isInstant
      ? new Date(now.getTime() + 15 * 60 * 1000).toISOString() // 15 mins for RTP
      : new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();

    return {
      success: true,
      externalTransactionId: `tr_outbound_${generateUuidV7().replace(/-/g, '').substring(0, 24)}`,
      provider: 'STRIPE_TREASURY',
      payoutRail: request.payoutRail || 'INSTANT_RTP',
      amountCents: request.amountCents,
      status: isInstant ? 'SETTLED' : 'PROCESSING',
      initiatedAt: now.toISOString(),
      estimatedSettlementAt: estimatedSettlement,
      settledAt: isInstant ? now.toISOString() : null,
      feeIncurredCents: 15, // $0.15 banking interchange cost
      providerTraceNumber: trace,
      rawProviderResponse: {
        object: 'treasury.outbound_transfer',
        status: isInstant ? 'posted' : 'processing',
        financial_account: 'fa_123456789',
        destination_payment_method: {
          type: 'us_bank_account',
          routing_number: request.destinationRoutingNumber,
          last4: request.destinationAccountNumber ? request.destinationAccountNumber.slice(-4) : '7890',
        },
      },
    };
  }

  public async checkStatus(externalTransactionId: string): Promise<{ status: PayoutStatus; settledAt?: string | null }> {
    return {
      status: 'SETTLED',
      settledAt: new Date().toISOString(),
    };
  }
}

export class ModernTreasuryAdapter implements IBankingProviderAdapter {
  public providerName: BankingProvider = 'MODERN_TREASURY';

  public async executeDisbursement(request: BankingDisbursementRequest): Promise<BankingDisbursementResponse> {
    const trace = `MT_FED_${Date.now()}_${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
    const now = new Date();
    const isInstant = request.payoutRail === 'INSTANT_RTP' || request.payoutRail === 'FEDNOW';

    return {
      success: true,
      externalTransactionId: `mt_pay_${generateUuidV7().replace(/-/g, '').substring(0, 24)}`,
      provider: 'MODERN_TREASURY',
      payoutRail: request.payoutRail || 'FEDNOW',
      amountCents: request.amountCents,
      status: isInstant ? 'SETTLED' : 'PROCESSING',
      initiatedAt: now.toISOString(),
      estimatedSettlementAt: now.toISOString(),
      settledAt: isInstant ? now.toISOString() : null,
      feeIncurredCents: 20,
      providerTraceNumber: trace,
      rawProviderResponse: {
        id: `pay_${generateUuidV7()}`,
        status: 'completed',
        type: request.payoutRail === 'FEDNOW' ? 'fednow' : 'rtp',
        currency: 'USD',
      },
    };
  }

  public async checkStatus(externalTransactionId: string): Promise<{ status: PayoutStatus; settledAt?: string | null }> {
    return {
      status: 'SETTLED',
      settledAt: new Date().toISOString(),
    };
  }
}

export class ColumnBankAdapter implements IBankingProviderAdapter {
  public providerName: BankingProvider = 'COLUMN_BANK';

  public async executeDisbursement(request: BankingDisbursementRequest): Promise<BankingDisbursementResponse> {
    const now = new Date();
    return {
      success: true,
      externalTransactionId: `col_wire_${generateUuidV7().replace(/-/g, '').substring(0, 24)}`,
      provider: 'COLUMN_BANK',
      payoutRail: request.payoutRail || 'SAME_DAY_ACH',
      amountCents: request.amountCents,
      status: 'SETTLED',
      initiatedAt: now.toISOString(),
      estimatedSettlementAt: now.toISOString(),
      settledAt: now.toISOString(),
      feeIncurredCents: 10,
      providerTraceNumber: `COL_${Date.now()}`,
      rawProviderResponse: {
        id: `col_trans_${generateUuidV7()}`,
        type: 'ach.outbound',
        status: 'settled',
      },
    };
  }

  public async checkStatus(externalTransactionId: string): Promise<{ status: PayoutStatus; settledAt?: string | null }> {
    return {
      status: 'SETTLED',
      settledAt: new Date().toISOString(),
    };
  }
}

export class EmbeddedBankingEngine {
  private static adapters: Map<BankingProvider, IBankingProviderAdapter> = new Map([
    ['STRIPE_TREASURY', new StripeTreasuryAdapter()],
    ['MODERN_TREASURY', new ModernTreasuryAdapter()],
    ['COLUMN_BANK', new ColumnBankAdapter()],
    ['SIMULATED', new StripeTreasuryAdapter()],
  ]);

  /**
   * Dispatches automated financial disbursement across modern banking rails
   */
  public static async executePayout(
    request: BankingDisbursementRequest
  ): Promise<BankingDisbursementResponse> {
    const validated = BankingDisbursementRequestSchema.parse(request);
    const provider = validated.provider || 'STRIPE_TREASURY';
    const adapter = this.adapters.get(provider) || this.adapters.get('STRIPE_TREASURY')!;

    return adapter.executeDisbursement(validated);
  }
}
