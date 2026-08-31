import { describe, it, expect } from 'vitest';
import { CombinatorialSplitOptimizer } from '../src/lib/optimization/split-optimizer';
import { RateRequest } from '../src/lib/rating/carrier-adapter.interface';

describe('Phase 2.7: Operational Friction & Risk Scoring Engine', () => {
  const tenantId = '01916362-7901-7080-867c-9b8895092a01';

  it('correctly calculates $45 extra pickup overhead and $25/day transit delta friction penalty', async () => {
    const request: Omit<RateRequest, 'accountType'> = {
      tenantId,
      originZip: '75201', // Dallas TX
      originCity: 'Dallas',
      originState: 'TX',
      destZip: '30301', // Atlanta GA
      destCity: 'Atlanta',
      destState: 'GA',
      pickupDate: '2026-09-01',
      items: [
        { lengthIn: 48, widthIn: 40, heightIn: 48, weightLbs: 1000, quantity: 4, nmfcClass: '70' },
        { lengthIn: 48, widthIn: 40, heightIn: 48, weightLbs: 1000, quantity: 4, nmfcClass: '70' },
      ],
      accessorials: ['APPOINTMENT_DELIVERY'], // Triggers $20 appointment risk
    };

    const result = await CombinatorialSplitOptimizer.optimizeShipment(request);

    expect(result.frictionBreakdown.extraPickupOverheadCents).toBe(4500); // $45.00
    expect(result.frictionBreakdown.appointmentRiskFactorCents).toBe(2000); // $20.00
    expect(result.frictionBreakdown.transitDeltaDaysPenaltyCents).toBe(
      result.transitDeltaDays * 2500
    );
    expect(result.operationalFrictionCents).toBe(
      4500 + 2000 + result.transitDeltaDays * 2500
    );
    expect(result.netSplitBenefitCents).toBe(
      result.grossSavingsCents - result.operationalFrictionCents
    );
  });

  it('strictly filters split recommendations unless Net Savings >= $75.00 and Transit Delta <= 1 day', async () => {
    // 2 small pallets: gross split savings is minor and will not cross the $75 hurdle
    const smallRequest: Omit<RateRequest, 'accountType'> = {
      tenantId,
      originZip: '90001',
      originCity: 'Los Angeles',
      originState: 'CA',
      destZip: '90015',
      destCity: 'Los Angeles',
      destState: 'CA',
      pickupDate: '2026-09-01',
      items: [
        { lengthIn: 48, widthIn: 40, heightIn: 48, weightLbs: 200, quantity: 2, nmfcClass: '50' },
      ],
      accessorials: [],
    };

    const result = await CombinatorialSplitOptimizer.optimizeShipment(smallRequest);

    // Because net benefit is below $75.00 after $45 pickup buffer, isRecommended MUST be false
    expect(result.isRecommended).toBe(false);
    expect(result.plainLanguageHeadline).toContain('Single Carrier Recommended');
  });
});
