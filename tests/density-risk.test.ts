import { describe, it, expect } from 'vitest';
import { DensityRiskEngine } from '../src/lib/classification/density-engine';

describe('Phase 1: Density (PCF), NMFC & Risk Warning Engine', () => {
  describe('Cubic Feet & PCF Math', () => {
    it('calculates exact volume for 2 pallets 48x40x48', () => {
      // (48 * 40 * 48 / 1728) * 2 = 53.333 * 2 = 106.67 cu.ft
      const vol = DensityRiskEngine.calculateVolumeCuFt(48, 40, 48, 2);
      expect(vol).toBe(106.67);
    });

    it('calculates exact PCF density', () => {
      // 2000 lbs / 106.67 cu.ft = 18.75 PCF
      const pcf = DensityRiskEngine.calculatePcf(2000, 106.67);
      expect(pcf).toBe(18.75);
    });
  });

  describe('Standard NMFC 11-Tier Matrix Lookup', () => {
    it('maps all density tiers to exact NMFC classes', () => {
      expect(DensityRiskEngine.lookupNmfcClass(0.8)).toBe(500);  // < 1
      expect(DensityRiskEngine.lookupNmfcClass(1.5)).toBe(400);  // 1 to <2
      expect(DensityRiskEngine.lookupNmfcClass(3.0)).toBe(300);  // 2 to <4
      expect(DensityRiskEngine.lookupNmfcClass(5.0)).toBe(250);  // 4 to <6
      expect(DensityRiskEngine.lookupNmfcClass(7.0)).toBe(175);  // 6 to <8
      expect(DensityRiskEngine.lookupNmfcClass(9.0)).toBe(125);  // 8 to <10
      expect(DensityRiskEngine.lookupNmfcClass(11.0)).toBe(100); // 10 to <12
      expect(DensityRiskEngine.lookupNmfcClass(13.5)).toBe(85);  // 12 to <15
      expect(DensityRiskEngine.lookupNmfcClass(18.0)).toBe(70);  // 15 to <22.5
      expect(DensityRiskEngine.lookupNmfcClass(25.0)).toBe(65);  // 22.5 to <30
      expect(DensityRiskEngine.lookupNmfcClass(35.0)).toBe(50);  // >= 30
    });
  });

  describe('Overlength Detection', () => {
    it('flags items >= 96 inches as overlength', () => {
      const metrics = DensityRiskEngine.evaluateShipment([
        {
          item_id: '1',
          packaging_type: 'CRATE',
          handling_units: 1,
          length_inches: 120,
          width_inches: 40,
          height_inches: 48,
          total_weight_lbs: 2000,
          declared_class: 70,
          nmfc_code: null,
          commodity_description: 'Pipes',
          is_hazardous: false,
          is_stackable: false,
        },
      ]);

      expect(metrics.hasOverlengthItems).toBe(true);
      expect(metrics.maxItemLengthInches).toBe(120);
      expect(metrics.itemMetrics[0].isOverlength).toBe(true);
      expect(metrics.itemMetrics[0].overlengthInches).toBe(24);
    });
  });

  describe('Reclassification Risk & Financial Penalty Exposure', () => {
    it('detects high reclassification risk when declared Class 50 vs recommended Class 175', () => {
      // Declared Class 50, but lightweight freight has PCF 5.6 -> recommended Class 175
      const risk = DensityRiskEngine.evaluateReclassificationRisk(50, 175, 600, 350.0);

      expect(risk.hasRisk).toBe(true);
      expect(risk.declaredClass).toBe(50);
      expect(risk.recommendedClass).toBe(175);
      expect(risk.deltaClass).toBe(125);
      expect(risk.carrierReweighFeeUsd).toBe(35.0);
      expect(risk.estimatedRebillPenaltyUsd).toBeGreaterThan(500);
      expect(risk.severity).toBe('HIGH');
      expect(risk.warningMessage).toContain('High Risk of Reclassification!');
    });

    it('flags no risk when declared class matches or exceeds recommended class', () => {
      const risk = DensityRiskEngine.evaluateReclassificationRisk(70, 70, 2000, 350.0);
      expect(risk.hasRisk).toBe(false);
      expect(risk.estimatedRebillPenaltyUsd).toBe(0);
      expect(risk.severity).toBe('NONE');
    });
  });
});
