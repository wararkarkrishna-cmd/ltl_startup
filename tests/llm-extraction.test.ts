import { describe, it, expect } from 'vitest';
import { LtlFreightExtractor } from '../src/lib/extraction/llm-extractor';
import { RfqExtractionResultSchema } from '../src/lib/schema/rfq-extraction-schema';

describe('Phase 1.3: LLM Extraction Pipeline with Strict JSON Schema Enforcement', () => {
  describe('Strict Zod Schema Enforcement', () => {
    it('successfully validates complete, structured RFQ extraction output', async () => {
      const rfText = `RFQ: Need rate for 4 pallets of industrial machine parts.
Origin: 1420 Olympic Blvd, Los Angeles, CA 90015
Destination: 500 N Michigan Ave, Chicago, IL 60611
Dimensions: 48x40x48 @ 1200 lbs each
Accessorials: Liftgate delivery required. Call receiver 24 hours prior.`;

      const result = await LtlFreightExtractor.extractRfq(rfText);

      // Validate against strict Zod schema
      const validated = RfqExtractionResultSchema.parse(result);

      expect(validated.origin.city).toBe('Los Angeles');
      expect(validated.origin.state).toBe('CA');
      expect(validated.origin.zip).toBe('90015');

      expect(validated.destination.city).toBe('Chicago');
      expect(validated.destination.state).toBe('IL');
      expect(validated.destination.zip).toBe('60611');

      expect(validated.totalPallets).toBe(4);
      expect(validated.totalWeightLbs).toBe(4800);
      expect(validated.items[0].quantity).toBe(4);
      expect(validated.items[0].lengthIn).toBe(48);
      expect(validated.items[0].widthIn).toBe(40);
      expect(validated.items[0].heightIn).toBe(48);
      expect(validated.items[0].unitWeightLbs).toBe(1200);

      expect(validated.accessorials).toContain('LG_DEL');
      expect(validated.accessorials).toContain('NOTIFY');
    });

    it('rejects empty input with descriptive error', async () => {
      await expect(LtlFreightExtractor.extractRfq('')).rejects.toThrow(/Cannot extract RFQ from empty content/i);
    });
  });

  describe('Freight Multiplier & Complex Line-Item Parsing', () => {
    it('correctly handles multiplier strings: "48x40x48 @ 1200# x 4"', async () => {
      const sample = 'Please quote 48x40x48 @ 1200# x 4 pallets from 90001 to 60601';
      const result = await LtlFreightExtractor.extractRfq(sample);

      expect(result.totalPallets).toBe(4);
      expect(result.items[0].quantity).toBe(4);
      expect(result.items[0].unitWeightLbs).toBe(1200);
      expect(result.totalWeightLbs).toBe(4800);
    });

    it('correctly handles total weight strings: "3 skids 2400 lbs total"', async () => {
      const sample = 'We have 3 skids 48x40x60, 2400 lbs total weight, shipping from 75201 to 30301';
      const result = await LtlFreightExtractor.extractRfq(sample);

      expect(result.totalPallets).toBe(3);
      expect(result.totalWeightLbs).toBe(2400);
      expect(result.items[0].unitWeightLbs).toBe(800);
    });

    it('extracts packaging types (CRATE, BOX, DRUM, PALLET)', async () => {
      const crateSample = '1 wooden crate 60x40x50 1500 lbs from 90001 to 60601';
      const resultCrate = await LtlFreightExtractor.extractRfq(crateSample);
      expect(resultCrate.items[0].packagingType).toBe('CRATE');

      const boxSample = '5 cartons 20x20x20 250 lbs total from 90001 to 60601';
      const resultBox = await LtlFreightExtractor.extractRfq(boxSample);
      expect(resultBox.items[0].packagingType).toBe('BOX');

      const drumSample = '4 drums 24x24x36 1800 lbs from 90001 to 60601';
      const resultDrum = await LtlFreightExtractor.extractRfq(drumSample);
      expect(resultDrum.items[0].packagingType).toBe('DRUM');
    });
  });

  describe('Accessorial Detection & Normalization', () => {
    it('detects multiple accessorials: Liftgate, Residential, Limited Access, Inside Delivery', async () => {
      const text = `Need LTL quote from Los Angeles CA 90001 to Austin TX 78701.
2 pallets 48x40x48 1600 lbs.
Consignee is a church construction site in a residential neighborhood with no loading dock.
Driver must bring inside second floor.`;

      const result = await LtlFreightExtractor.extractRfq(text);

      expect(result.accessorials).toContain('LG_DEL');     // "no loading dock"
      expect(result.accessorials).toContain('RES_DEL');    // "residential neighborhood"
      expect(result.accessorials).toContain('LIM_ACC');    // "church construction site"
      expect(result.accessorials).toContain('INS_DEL');    // "bring inside second floor"
    });

    it('detects Hazardous Materials notation and UN flags', async () => {
      const hazmatText = '1 pallet hazardous chemicals UN 1993 class 3, 850 lbs from 90001 to 60601';
      const result = await LtlFreightExtractor.extractRfq(hazmatText);

      expect(result.accessorials).toContain('HAZMAT');
      expect(result.items[0].isHazmat).toBe(true);
    });
  });

  describe('Confidence Scoring & Human-in-the-Loop Escalation', () => {
    it('calculates high confidence for clean RFQ without requiring human review', async () => {
      const cleanRfq = `Origin: Los Angeles, CA 90001
Destination: Chicago, IL 60601
Quantity: 2 pallets 48x40x48
Weight: 2000 lbs total`;

      const result = await LtlFreightExtractor.extractRfq(cleanRfq);

      expect(result.confidenceScores.originZip).toBeGreaterThanOrEqual(0.90);
      expect(result.confidenceScores.destZip).toBeGreaterThanOrEqual(0.90);
      expect(result.confidenceScores.overall).toBeGreaterThanOrEqual(0.85);
      expect(result.requiresHumanReview).toBe(false);
    });
  });
});
