import { describe, it, expect } from 'vitest';
import { LtlDensityCalculator } from '../src/lib/classification/density-calculator';

describe('Phase 1.4: Algorithmic Density Calculator & NMFC Classification Engine', () => {
  describe('Cubic Feet & PCF Calculations', () => {
    it('calculates cubic feet for standard 48x40x48 pallet', () => {
      // (48 * 40 * 48) / 1728 = 92160 / 1728 = 53.33 cu.ft
      const cuft = LtlDensityCalculator.calculateCubicFeet(48, 40, 48);
      expect(cuft).toBe(53.33);
    });

    it('calculates PCF density accurately', () => {
      // 1200 lbs / 53.33 cu.ft = 22.50 PCF
      const cuft = LtlDensityCalculator.calculateCubicFeet(48, 40, 48);
      const pcf = LtlDensityCalculator.calculatePcf(1200, cuft);
      expect(pcf).toBe(22.5);
    });

    it('rejects invalid or non-positive dimensions/weights', () => {
      expect(() => LtlDensityCalculator.calculateCubicFeet(0, 40, 48)).toThrow();
      expect(() => LtlDensityCalculator.calculatePcf(-100, 50)).toThrow();
    });
  });

  describe('NMFC 11-Tier Density Matrix Classification', () => {
    it('correctly maps all 11 density tiers to exact NMFC classes', () => {
      // Tier 1: PCF >= 50 -> Class 50
      expect(LtlDensityCalculator.lookupNmfcClass(55.0)).toBe('50');
      expect(LtlDensityCalculator.lookupNmfcClass(50.0)).toBe('50');

      // Tier 2: 35 <= PCF < 50 -> Class 55
      expect(LtlDensityCalculator.lookupNmfcClass(42.0)).toBe('55');
      expect(LtlDensityCalculator.lookupNmfcClass(35.0)).toBe('55');

      // Tier 3: 30 <= PCF < 35 -> Class 60
      expect(LtlDensityCalculator.lookupNmfcClass(32.5)).toBe('60');

      // Tier 4: 22.5 <= PCF < 30 -> Class 65
      expect(LtlDensityCalculator.lookupNmfcClass(25.0)).toBe('65');
      expect(LtlDensityCalculator.lookupNmfcClass(22.5)).toBe('65');

      // Tier 5: 15 <= PCF < 22.5 -> Class 70
      expect(LtlDensityCalculator.lookupNmfcClass(18.0)).toBe('70');
      expect(LtlDensityCalculator.lookupNmfcClass(15.0)).toBe('70');

      // Tier 6: 12 <= PCF < 15 -> Class 85
      expect(LtlDensityCalculator.lookupNmfcClass(13.5)).toBe('85');

      // Tier 7: 10 <= PCF < 12 -> Class 92.5
      expect(LtlDensityCalculator.lookupNmfcClass(11.0)).toBe('92.5');

      // Tier 8: 8 <= PCF < 10 -> Class 100
      expect(LtlDensityCalculator.lookupNmfcClass(9.0)).toBe('100');

      // Tier 9: 6 <= PCF < 8 -> Class 125
      expect(LtlDensityCalculator.lookupNmfcClass(7.0)).toBe('125');

      // Tier 10: 4 <= PCF < 6 -> Class 175
      expect(LtlDensityCalculator.lookupNmfcClass(5.0)).toBe('175');

      // Tier 11: 2 <= PCF < 4 -> Class 250
      expect(LtlDensityCalculator.lookupNmfcClass(3.0)).toBe('250');

      // Bottom Tier: PCF < 2 -> Class 400
      expect(LtlDensityCalculator.lookupNmfcClass(1.5)).toBe('400');
    });
  });

  describe('Linear Feet & Trailer Stacking Algorithm', () => {
    it('calculates linear feet for non-stackable standard pallets', () => {
      // 2 pallets fit across width -> 4 pallets = 2 rows * 4ft = 8 linear feet
      const lf4 = LtlDensityCalculator.calculateLinearFeet(48, 40, 48, 4, false);
      expect(lf4).toBe(8.0);

      // 5 pallets = 3 rows * 4ft = 12 linear feet
      const lf5 = LtlDensityCalculator.calculateLinearFeet(48, 40, 48, 5, false);
      expect(lf5).toBe(12.0);
    });

    it('calculates linear feet reduction for double-stackable pallets', () => {
      // 4 stackable pallets height <= 48in -> effective 2 pallets = 1 row * 4ft = 4 linear feet
      const lfStackable = LtlDensityCalculator.calculateLinearFeet(48, 40, 44, 4, true);
      expect(lfStackable).toBe(4.0);
    });

    it('calculates linear feet for custom oversized crates', () => {
      // 1 crate 96x48x50 -> fits 1 across width -> 1 row * (48 / 12) = 4 linear feet
      const lfCustom = LtlDensityCalculator.calculateLinearFeet(96, 48, 50, 1, false);
      expect(lfCustom).toBe(4.0);
    });
  });

  describe('Volume-LTL Surcharge Threshold Detector', () => {
    it('flags Volume-LTL when linear feet > 12 ft', () => {
      const summary = LtlDensityCalculator.evaluateShipment([
        { lengthIn: 48, widthIn: 40, heightIn: 48, weightLbs: 800, quantity: 8 },
      ]);

      expect(summary.totalPallets).toBe(8);
      expect(summary.totalLinearFeet).toBe(16.0);
      expect(summary.volumeLtlFlags.exceedsPalletThreshold).toBe(true);
      expect(summary.volumeLtlFlags.exceedsLinearFeetThreshold).toBe(true);
      expect(summary.volumeLtlFlags.isVolumeLtl).toBe(true);
    });

    it('flags Volume-LTL when total weight >= 6,000 lbs', () => {
      const summary = LtlDensityCalculator.evaluateShipment([
        { lengthIn: 48, widthIn: 40, heightIn: 48, weightLbs: 3500, quantity: 2 },
      ]);

      expect(summary.totalWeightLbs).toBe(7000);
      expect(summary.volumeLtlFlags.exceedsWeightThreshold).toBe(true);
      expect(summary.volumeLtlFlags.isVolumeLtl).toBe(true);
    });

    it('identifies standard LTL loads below penalty thresholds', () => {
      const summary = LtlDensityCalculator.evaluateShipment([
        { lengthIn: 48, widthIn: 40, heightIn: 48, weightLbs: 600, quantity: 2 },
      ]);

      expect(summary.totalPallets).toBe(2);
      expect(summary.totalLinearFeet).toBe(4.0);
      expect(summary.volumeLtlFlags.isVolumeLtl).toBe(false);
    });
  });
});
