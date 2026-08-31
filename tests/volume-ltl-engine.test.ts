import { describe, it, expect } from 'vitest';
import { VolumeLtlEngine } from '../src/lib/classification/volume-ltl-engine';
import { RateItem } from '../src/lib/rating/carrier-adapter.interface';

describe('Phase 2.5: Volume LTL Threshold & Linear Foot Calculation Engine', () => {
  it('calculates linear feet using formula ceil(pallets / 2) * 4 ft for standard 48x40 pallets', () => {
    const singlePallet: RateItem[] = [
      { lengthIn: 48, widthIn: 40, heightIn: 48, weightLbs: 500, quantity: 1, nmfcClass: '70' },
    ];
    expect(VolumeLtlEngine.calculateLinearFeet(singlePallet)).toBe(4.0);

    const fourPallets: RateItem[] = [
      { lengthIn: 48, widthIn: 40, heightIn: 48, weightLbs: 2000, quantity: 4, nmfcClass: '70' },
    ];
    expect(VolumeLtlEngine.calculateLinearFeet(fourPallets)).toBe(8.0); // ceil(4/2)*4 = 8

    const sevenPallets: RateItem[] = [
      { lengthIn: 48, widthIn: 40, heightIn: 48, weightLbs: 3500, quantity: 7, nmfcClass: '70' },
    ];
    expect(VolumeLtlEngine.calculateLinearFeet(sevenPallets)).toBe(16.0); // ceil(7/2)*4 = 16
  });

  it('triggers Volume LTL flag when pallets >= 6 or weight > 5000 lbs', () => {
    const heavyShipment: RateItem[] = [
      { lengthIn: 48, widthIn: 40, heightIn: 48, weightLbs: 3000, quantity: 2, nmfcClass: '70' }, // 6000 lbs
    ];
    const evalHeavy = VolumeLtlEngine.evaluateShipment(heavyShipment);
    expect(evalHeavy.isVolumeLtl).toBe(true);
    expect(evalHeavy.triggerReasons.some((r) => r.includes('5,000 lbs'))).toBe(true);

    const sixPalletsShipment: RateItem[] = [
      { lengthIn: 48, widthIn: 40, heightIn: 48, weightLbs: 500, quantity: 6, nmfcClass: '70' },
    ];
    const evalSix = VolumeLtlEngine.evaluateShipment(sixPalletsShipment);
    expect(evalSix.isVolumeLtl).toBe(true);
    expect(evalSix.triggerReasons.some((r) => r.includes('6 pallets'))).toBe(true);
  });

  it('identifies High-Risk Cubic Capacity penalties when volume >= 750 cu ft and density < 6.0 PCF', () => {
    // 15 large lightweight pallets (48x40x80 @ 150 lbs each) -> 1,333 cu ft, PCF = 1.69
    const bulkyLightweight: RateItem[] = [
      { lengthIn: 48, widthIn: 40, heightIn: 80, weightLbs: 150, quantity: 15, nmfcClass: '250' },
    ];

    const evalBulky = VolumeLtlEngine.evaluateShipment(bulkyLightweight);
    expect(evalBulky.isVolumeLtl).toBe(true);
    expect(evalBulky.isCubicCapacityPenaltyRisk).toBe(true);
    expect(evalBulky.warningMessage).toContain('Cubic Capacity Rule Triggered');
    expect(evalBulky.recommendedAction).toBe('SPLIT_SHIPMENT_RECOMMENDED');
  });
});
