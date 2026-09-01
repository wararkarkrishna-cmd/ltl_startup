import { describe, it, expect } from 'vitest';
import { EmbeddedBankingEngine } from '../src/lib/quickpay/embedded-banking-engine';

describe('Phase 6.4: Embedded Payout Processing & Banking Infrastructure Integration', () => {
  const baseRequest = {
    tenantId: '01916362-7901-7080-867c-9b8895092a01',
    shipmentId: '01916362-7901-7080-867c-9b8895092s01',
    carrierScac: 'SAIA',
    carrierName: 'SAIA LTL Freight',
    amountCents: 78000, // $780.00 Net Payout
    currency: 'USD' as const,
    payoutRail: 'INSTANT_RTP' as const,
    provider: 'STRIPE_TREASURY' as const,
    destinationRoutingNumber: '021000021',
    destinationAccountNumber: '1234567890',
    bankName: 'JPMorgan Chase',
  };

  it('executes instant RTP disbursement via Stripe Treasury adapter', async () => {
    const res = await EmbeddedBankingEngine.executePayout(baseRequest);

    expect(res.success).toBe(true);
    expect(res.provider).toBe('STRIPE_TREASURY');
    expect(res.payoutRail).toBe('INSTANT_RTP');
    expect(res.amountCents).toBe(78000);
    expect(res.status).toBe('SETTLED');
    expect(res.externalTransactionId).toMatch(/^tr_outbound_/);
    expect(res.providerTraceNumber).toContain('STRIPE_TR_');
  });

  it('executes FedNow disbursement via Modern Treasury adapter', async () => {
    const fedNowRequest = {
      ...baseRequest,
      payoutRail: 'FEDNOW' as const,
      provider: 'MODERN_TREASURY' as const,
    };

    const res = await EmbeddedBankingEngine.executePayout(fedNowRequest);

    expect(res.success).toBe(true);
    expect(res.provider).toBe('MODERN_TREASURY');
    expect(res.payoutRail).toBe('FEDNOW');
    expect(res.status).toBe('SETTLED');
    expect(res.externalTransactionId).toMatch(/^mt_pay_/);
  });

  it('executes Same-Day ACH disbursement via Column Bank adapter', async () => {
    const achRequest = {
      ...baseRequest,
      payoutRail: 'SAME_DAY_ACH' as const,
      provider: 'COLUMN_BANK' as const,
    };

    const res = await EmbeddedBankingEngine.executePayout(achRequest);

    expect(res.success).toBe(true);
    expect(res.provider).toBe('COLUMN_BANK');
    expect(res.payoutRail).toBe('SAME_DAY_ACH');
    expect(res.status).toBe('SETTLED');
    expect(res.externalTransactionId).toMatch(/^col_wire_/);
  });
});
