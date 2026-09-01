import { describe, it, expect } from 'vitest';
import { QuickPayFeeEngine } from '../src/lib/quickpay/quickpay-fee-engine';

describe('Phase 6.2: Dynamic QuickPay Tier Matrix & Fee Calculation Engine', () => {
  it('calculates Instant Same-Day (2.5%) fee with exact integer cents precision', () => {
    const grossAmountCents = 80000; // $800.00
    const res = QuickPayFeeEngine.calculateSingleTier(grossAmountCents, 'INSTANT_SAME_DAY');

    expect(res.feePercent).toBe(2.5);
    expect(res.feeAmountCents).toBe(2000); // $20.00 (2.5% of $800.00)
    expect(res.netPayoutCents).toBe(78000); // $780.00
  });

  it('calculates Next-Day ACH (2.0%) fee accurately', () => {
    const grossAmountCents = 125000; // $1,250.00
    const res = QuickPayFeeEngine.calculateSingleTier(grossAmountCents, 'NEXT_DAY_ACH');

    expect(res.feePercent).toBe(2.0);
    expect(res.feeAmountCents).toBe(2500); // $25.00 (2.0% of $1,250.00)
    expect(res.netPayoutCents).toBe(122500); // $1,225.00
  });

  it('calculates Standard Net 30 with 0% fee and 100% net disbursement', () => {
    const grossAmountCents = 95000; // $950.00
    const res = QuickPayFeeEngine.calculateSingleTier(grossAmountCents, 'STANDARD_NET_30');

    expect(res.feePercent).toBe(0.0);
    expect(res.feeAmountCents).toBe(0);
    expect(res.netPayoutCents).toBe(95000);
  });

  it('applies minimum fee floor ($15.00) for smaller loads on accelerated tiers', () => {
    const grossAmountCents = 30000; // $300.00 (2.5% = $7.50 -> bumped to $15.00 minimum)
    const res = QuickPayFeeEngine.calculateSingleTier(grossAmountCents, 'INSTANT_SAME_DAY', undefined, 1500);

    expect(res.feeAmountCents).toBe(1500); // $15.00 floor applied
    expect(res.netPayoutCents).toBe(28500); // $285.00
  });

  it('supports custom fee percentage override for preferred volume carriers', () => {
    const grossAmountCents = 100000; // $1,000.00
    const res = QuickPayFeeEngine.calculateSingleTier(grossAmountCents, 'INSTANT_SAME_DAY', 1.8); // 1.8% preferred fee

    expect(res.feePercent).toBe(1.8);
    expect(res.feeAmountCents).toBe(1800); // $18.00
    expect(res.netPayoutCents).toBe(98200); // $982.00
  });

  it('evaluates all 3 tiers side-by-side with comparison cards and disclosures', () => {
    const result = QuickPayFeeEngine.calculateAllTiers({
      grossAmountCents: 80000,
      selectedTier: 'INSTANT_SAME_DAY',
    });

    expect(result.grossAmountCents).toBe(80000);
    expect(result.tierOptions.length).toBe(3);
    expect(result.tierOptions[0].tier).toBe('INSTANT_SAME_DAY');
    expect(result.tierOptions[0].netFormatted).toBe('$780.00');
    expect(result.tierOptions[1].tier).toBe('NEXT_DAY_ACH');
    expect(result.tierOptions[1].netFormatted).toBe('$784.00');
    expect(result.tierOptions[2].tier).toBe('STANDARD_NET_30');
    expect(result.tierOptions[2].netFormatted).toBe('$800.00');
    expect(result.plainLanguageDisclosure).toContain('Get paid $780.00 today');
  });
});
