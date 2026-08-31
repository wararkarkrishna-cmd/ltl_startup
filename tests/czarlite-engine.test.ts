import { describe, it, expect } from 'vitest';
import { CzarLiteTariffEngine } from '../src/lib/rating/czarlite-engine';
import { RateRequest } from '../src/lib/rating/carrier-adapter.interface';

describe('Phase 2.2: SMC3 / CzarLite Base Rate Tariff Engine', () => {
  const baseRequest: RateRequest = {
    tenantId: '01916362-7901-7080-867c-9b8895092a01',
    originZip: '90001', // Los Angeles CA
    originCity: 'Los Angeles',
    originState: 'CA',
    destZip: '60601', // Chicago IL
    destCity: 'Chicago',
    destState: 'IL',
    pickupDate: '2026-09-01',
    items: [
      {
        lengthIn: 48,
        widthIn: 40,
        heightIn: 48,
        weightLbs: 2000,
        quantity: 2,
        nmfcClass: '70',
      },
    ],
    accessorials: ['LIFTGATE_DELIVERY'],
    accountType: 'DIRECT_BYOC',
  };

  it('calculates realistic highway mileage with road circuity between US ZIPs', () => {
    const miles = CzarLiteTariffEngine.estimateHighwayMileage('90001', '60601');
    expect(miles).toBeGreaterThan(1500);
    expect(miles).toBeLessThan(2500);
  });

  it('computes undiscounted base CzarLite tariff, CWT, and discounted linehaul correctly', () => {
    const tariff = CzarLiteTariffEngine.calculateTariff(baseRequest, 0.80);

    expect(tariff.totalWeightLbs).toBe(4000); // 2 * 2000 lbs
    expect(tariff.cwt).toBe(40.0);
    expect(tariff.baseTariffCents).toBeGreaterThan(0);
    expect(tariff.discountPercent).toBe(0.80);
    expect(tariff.discountedLinehaulCents).toBeGreaterThan(0);
    expect(tariff.fuelSurchargePercent).toBe(0.285);
    expect(tariff.fuelSurchargeCents).toBe(Math.round(tariff.discountedLinehaulCents * 0.285));
    expect(tariff.accessorialFees['LIFTGATE_DELIVERY']).toBe(7500);
    expect(tariff.totalAccessorialCostCents).toBe(7500);
    expect(tariff.totalCarrierCostCents).toBe(
      tariff.discountedLinehaulCents + tariff.fuelSurchargeCents + tariff.totalAccessorialCostCents
    );
  });

  it('enforces Absolute Minimum Charge (AMC floor) on lightweight short-haul shipments', () => {
    const minRequest: RateRequest = {
      ...baseRequest,
      originZip: '90001',
      destZip: '90015', // Short local distance
      items: [
        {
          lengthIn: 20,
          widthIn: 20,
          heightIn: 20,
          weightLbs: 100,
          quantity: 1,
          nmfcClass: '50',
        },
      ],
      accessorials: [],
    };

    const directTariff = CzarLiteTariffEngine.calculateTariff(minRequest, 0.85);
    expect(directTariff.isMinimumChargeApplied).toBe(true);
    expect(directTariff.discountedLinehaulCents).toBe(CzarLiteTariffEngine.DIRECT_AMC_CENTS); // $175.00
  });

  it('adjusts base rate per CWT according to NMFC Class multiplier curve', () => {
    const dist = 1000;
    const cwtRateClass50 = CzarLiteTariffEngine.calculateBaseCwtRateCents(dist, '50');
    const cwtRateClass70 = CzarLiteTariffEngine.calculateBaseCwtRateCents(dist, '70');
    const cwtRateClass100 = CzarLiteTariffEngine.calculateBaseCwtRateCents(dist, '100');
    const cwtRateClass250 = CzarLiteTariffEngine.calculateBaseCwtRateCents(dist, '250');
    const cwtRateClass500 = CzarLiteTariffEngine.calculateBaseCwtRateCents(dist, '500');

    expect(cwtRateClass50).toBeLessThan(cwtRateClass70);
    expect(cwtRateClass70).toBeLessThan(cwtRateClass100);
    expect(cwtRateClass100).toBeLessThan(cwtRateClass250);
    expect(cwtRateClass250).toBeLessThan(cwtRateClass500);
  });

  it('automatically adds OVERLENGTH surcharge when item dimensions exceed 96 inches', () => {
    const overlengthReq: RateRequest = {
      ...baseRequest,
      items: [
        {
          lengthIn: 120, // 10 feet
          widthIn: 40,
          heightIn: 48,
          weightLbs: 1500,
          quantity: 1,
          nmfcClass: '70',
        },
      ],
      accessorials: [],
    };

    const tariff = CzarLiteTariffEngine.calculateTariff(overlengthReq, 0.80);
    expect(tariff.accessorialFees['OVERLENGTH']).toBe(12500); // $125.00
    expect(tariff.totalAccessorialCostCents).toBe(12500);
  });
});
