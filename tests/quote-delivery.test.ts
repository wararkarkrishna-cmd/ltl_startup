import { describe, it, expect } from 'vitest';
import { QuoteDeliveryEngine } from '../src/lib/quoting/quote-delivery-engine';
import { Quote } from '../src/db/schema';

describe('Phase 3.1: Instant Customer-Facing Quote Generator & Action Tokens', () => {
  const tenantId = '01916362-7901-7080-867c-9b8895092a01';
  const quoteId = '01916362-7901-7080-867c-9b8895092q01';
  const shipmentId = '01916362-7901-7080-867c-9b8895092s01';

  it('generates cryptographically signed HMAC-SHA256 action tokens', () => {
    const tokenRecord = QuoteDeliveryEngine.generateActionToken({
      tenantId,
      quoteId,
      shipmentId,
      quotedPriceCents: 85000, // $850.00
      expiresInDays: 7,
    });

    expect(tokenRecord.token).toBeDefined();
    expect(tokenRecord.token).toContain('.');
    expect(tokenRecord.isUsed).toBe(false);

    const verification = QuoteDeliveryEngine.verifyActionToken(tokenRecord.token);
    expect(verification.isValid).toBe(true);
    expect(verification.isExpired).toBe(false);
    expect(verification.payload?.quoteId).toBe(quoteId);
    expect(verification.payload?.quotedPriceCents).toBe(85000);
  });

  it('detects and rejects forged or tampered quote action tokens', () => {
    const tokenRecord = QuoteDeliveryEngine.generateActionToken({
      tenantId,
      quoteId,
      shipmentId,
      quotedPriceCents: 85000,
    });

    const [payload, sig] = tokenRecord.token.split('.');
    const forgedToken = `${payload}.forgedSignature998877`;

    const result = QuoteDeliveryEngine.verifyActionToken(forgedToken);
    expect(result.isValid).toBe(false);
    expect(result.error).toContain('Invalid cryptographic signature');
  });

  it('renders complete branded HTML email template with 1-click CTA button', () => {
    const mockQuote: Quote = {
      id: quoteId,
      tenantId,
      shipmentId,
      carrierCode: 'SAIA',
      carrierName: 'SAIA LTL Freight',
      carrierScac: 'SAIA',
      accountType: 'PLATFORM_WHOLESALE',
      sourceTag: '[PLATFORM WHOLESALE: 88% TIER]',
      quoteNumber: 'Q-2026-982',
      linehaulCostCents: 50000,
      fuelSurchargeCents: 14000,
      accessorialCostCents: 7500,
      totalCarrierCostCents: 71500,
      appliedMarginPercent: 15.0,
      appliedMarginCents: 10725,
      quotedCustomerPriceCents: 82225,
      grossProfitCents: 10725,
      grossMarginPercent: 13.04,
      transitDays: 2,
      isGuaranteed: true,
      isSelected: false,
      accessorialFees: { LIFTGATE_DELIVERY: 7500 },
      rawCarrierResponse: null,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      createdAt: new Date(),
    };

    const emailHtml = QuoteDeliveryEngine.renderHtmlEmail({
      quote: mockQuote,
      originCity: 'Los Angeles',
      originState: 'CA',
      originZip: '90001',
      destCity: 'Chicago',
      destState: 'IL',
      destZip: '60601',
      pickupDate: '2026-09-01',
      totalPallets: 4,
      totalWeightLbs: 3200,
      accessorials: ['LIFTGATE_DELIVERY'],
      actionUrl: 'https://freight-os.com/quote/accept?token=sampleToken123',
    });

    expect(emailHtml).toContain('Formal Rate Quote');
    expect(emailHtml).toContain('$822.25');
    expect(emailHtml).toContain('SAIA LTL Freight');
    expect(emailHtml).toContain('Book This Shipment');
    expect(emailHtml).toContain('https://freight-os.com/quote/accept?token=sampleToken123');
  });
});
