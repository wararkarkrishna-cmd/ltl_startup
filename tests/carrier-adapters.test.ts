import { describe, it, expect } from 'vitest';
import { XpoRatingAdapter } from '../src/lib/rating/adapters/xpo-adapter';
import { EstesRatingAdapter } from '../src/lib/rating/adapters/estes-adapter';
import { SaiaRatingAdapter } from '../src/lib/rating/adapters/saia-adapter';
import { AbfRatingAdapter } from '../src/lib/rating/adapters/abf-adapter';
import { RlRatingAdapter } from '../src/lib/rating/adapters/rl-adapter';
import { RateRequest } from '../src/lib/rating/carrier-adapter.interface';

describe('Phase 2.1: Direct BYOC Carrier Adapters (XPO, Estes, SAIA, ABF, R+L)', () => {
  const baseRequest: RateRequest = {
    tenantId: '01916362-7901-7080-867c-9b8895092a01',
    originZip: '75201', // Dallas TX
    originCity: 'Dallas',
    originState: 'TX',
    destZip: '30301', // Atlanta GA
    destCity: 'Atlanta',
    destState: 'GA',
    pickupDate: '2026-09-01',
    items: [
      {
        lengthIn: 48,
        widthIn: 40,
        heightIn: 48,
        weightLbs: 1200,
        quantity: 2,
        nmfcClass: '70',
      },
    ],
    accessorials: ['LIFTGATE_DELIVERY', 'RESIDENTIAL_DELIVERY'],
    accountType: 'DIRECT_BYOC',
  };

  const adapters = [
    new XpoRatingAdapter(),
    new EstesRatingAdapter(),
    new SaiaRatingAdapter(),
    new AbfRatingAdapter(),
    new RlRatingAdapter(),
  ];

  it('implements unified rate contract across all 5 tier-1 LTL carriers', async () => {
    for (const adapter of adapters) {
      const quote = await adapter.rate(baseRequest);

      expect(quote.carrierCode).toBe(adapter.carrierCode);
      expect(quote.carrierName).toBe(adapter.carrierName);
      expect(quote.carrierScac).toBe(adapter.carrierScac);
      expect(quote.accountType).toBe('DIRECT_BYOC');
      expect(quote.quoteNumber).toMatch(new RegExp(`^${adapter.carrierCode}-\\d+`));
      expect(quote.linehaulCostCents).toBeGreaterThan(0);
      expect(quote.fuelSurchargeCents).toBeGreaterThan(0);
      expect(quote.accessorialCostCents).toBe(7500 + 8500); // Liftgate ($75) + Residential ($85)
      expect(quote.totalCostCents).toBe(
        quote.linehaulCostCents + quote.fuelSurchargeCents + quote.accessorialCostCents
      );
      expect(quote.transitDays).toBeGreaterThanOrEqual(1);
      expect(quote.sourceTag).toContain('[DIRECT:');
    }
  });

  it('correctly returns wholesale discounts when accountType is PLATFORM_WHOLESALE', async () => {
    const wholesaleReq: RateRequest = {
      ...baseRequest,
      accountType: 'PLATFORM_WHOLESALE',
    };

    for (const adapter of adapters) {
      const directQuote = await adapter.rate(baseRequest);
      const wholesaleQuote = await adapter.rate(wholesaleReq);

      expect(wholesaleQuote.sourceTag).toContain('[PLATFORM WHOLESALE:');
      // Wholesale cost must be less than direct cost due to superior platform tier discount
      expect(wholesaleQuote.linehaulCostCents).toBeLessThan(directQuote.linehaulCostCents);
      expect(wholesaleQuote.totalCostCents).toBeLessThan(directQuote.totalCostCents);
    }
  });
});
