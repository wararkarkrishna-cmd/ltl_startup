import { describe, it, expect } from 'vitest';
import { RFQ_10_TEST_FIXTURES } from '../src/lib/fixtures/rfq-fixtures';
import { LtlFreightExtractor } from '../src/lib/extraction/llm-extractor';
import { DensityRiskEngine } from '../src/lib/classification/density-engine';

describe('Phase 1: 10 Realistic Freight RFQ Test Fixtures Benchmark', () => {
  it('contains exactly 10 realistic freight test fixtures across diverse categories', () => {
    expect(RFQ_10_TEST_FIXTURES).toHaveLength(10);
  });

  for (const fixture of RFQ_10_TEST_FIXTURES) {
    it(`evaluates fixture [${fixture.fixtureId}]: ${fixture.name}`, async () => {
      const extracted = await LtlFreightExtractor.extractRfq(fixture.rawText);

      // 1. Geography Verification
      expect(extracted.origin.zip).toBe(fixture.expectedData.originZip);
      expect(extracted.destination.zip).toBe(fixture.expectedData.destZip);

      // 2. Weight Verification (within +/- 1% tolerance)
      const weightDiff = Math.abs(extracted.totalWeightLbs - fixture.expectedData.totalWeightLbs);
      const isWeightAccurate = weightDiff / fixture.expectedData.totalWeightLbs <= 0.01;
      expect(isWeightAccurate).toBe(true);

      // 3. Density & NMFC Classification Mathematical Exactness
      const densityMetrics = DensityRiskEngine.evaluateShipment(
        extracted.items.map((it, idx) => ({
          item_id: `ITEM-${idx + 1}`,
          packaging_type: it.packagingType as any,
          handling_units: it.quantity,
          length_inches: it.lengthIn,
          width_inches: it.widthIn,
          height_inches: it.heightIn,
          total_weight_lbs: it.totalWeightLbs,
          declared_class: it.nmfcClass ? parseFloat(it.nmfcClass) : null,
          nmfc_code: null,
          commodity_description: it.commodityDescription,
          is_hazardous: it.isHazmat,
          is_stackable: it.isStackable,
        }))
      );

      expect(densityMetrics.recommendedShipmentClass).toBe(fixture.expectedData.recommendedClass);
      expect(densityMetrics.hasOverlengthItems).toBe(fixture.expectedData.hasOverlength);
    });
  }
});
