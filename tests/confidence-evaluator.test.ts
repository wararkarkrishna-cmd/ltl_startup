import { describe, it, expect } from 'vitest';
import { HitlConfidenceEvaluator } from '../src/lib/confidence/confidence-evaluator';
import { RfqExtractionResult } from '../src/lib/schema/rfq-extraction-schema';

describe('Phase 1.6: HITL Confidence Scoring & Threshold Escalator', () => {
  const baseValidRfq: RfqExtractionResult = {
    shipperReference: 'RFQ-1001',
    origin: {
      name: 'Origin Plant',
      address1: '100 Main St',
      city: 'Los Angeles',
      state: 'CA',
      zip: '90001',
      country: 'US',
    },
    destination: {
      name: 'Dest Hub',
      address1: '200 State St',
      city: 'Chicago',
      state: 'IL',
      zip: '60601',
      country: 'US',
    },
    items: [
      {
        quantity: 2,
        packagingType: 'PALLET',
        lengthIn: 48,
        widthIn: 40,
        heightIn: 48,
        unitWeightLbs: 1000,
        totalWeightLbs: 2000,
        commodityDescription: 'Industrial Parts',
        isStackable: false,
        isHazmat: false,
      },
    ],
    totalPallets: 2,
    totalWeightLbs: 2000,
    accessorials: ['LG_DEL'],
    pickupDateReady: '2026-09-01',
    confidenceScores: {
      originZip: 0.98,
      destZip: 0.98,
      totalWeight: 0.95,
      palletCount: 0.95,
      dimensions: 0.94,
      accessorials: 0.92,
      overall: 0.95,
    },
    requiresHumanReview: false,
    extractedAt: new Date().toISOString(),
  };

  describe('Confidence Scoring & Color Tiers', () => {
    it('evaluates clean RFQ as GREEN tier and permits rating', () => {
      const evalResult = HitlConfidenceEvaluator.evaluateRfq(baseValidRfq);

      expect(evalResult.overallTier).toBe('GREEN');
      expect(evalResult.requiresHumanReview).toBe(false);
      expect(evalResult.blockDownstreamRating).toBe(false);

      const gateCheck = HitlConfidenceEvaluator.canProceedToRating(evalResult);
      expect(gateCheck.allowed).toBe(true);
    });

    it('escalates when critical origin ZIP is invalid format', () => {
      const invalidZipRfq: RfqExtractionResult = {
        ...baseValidRfq,
        origin: {
          ...baseValidRfq.origin,
          zip: '900', // Invalid 3-digit ZIP
        },
        confidenceScores: {
          ...baseValidRfq.confidenceScores,
          originZip: 0.40,
          overall: 0.75,
        },
      };

      const evalResult = HitlConfidenceEvaluator.evaluateRfq(invalidZipRfq);

      expect(evalResult.fields['origin.zip'].tier).toBe('RED');
      expect(evalResult.requiresHumanReview).toBe(true);
      expect(evalResult.blockDownstreamRating).toBe(true);
      expect(evalResult.escalationReasons.length).toBeGreaterThan(0);

      const gateCheck = HitlConfidenceEvaluator.canProceedToRating(evalResult);
      expect(gateCheck.allowed).toBe(false);
      expect(gateCheck.reason).toContain('Rating is blocked: Human review required');
    });

    it('escalates when critical weight confidence is low (< 0.90)', () => {
      const lowWeightRfq: RfqExtractionResult = {
        ...baseValidRfq,
        confidenceScores: {
          ...baseValidRfq.confidenceScores,
          totalWeight: 0.72,
        },
      };

      const evalResult = HitlConfidenceEvaluator.evaluateRfq(lowWeightRfq);

      expect(evalResult.fields['totalWeightLbs'].tier).toBe('YELLOW');
      expect(evalResult.requiresHumanReview).toBe(true);
      expect(evalResult.escalationReasons.some((r) => r.includes('Total Shipment Weight'))).toBe(true);
    });

    it('triggers Volume-LTL warning when linear feet > 12 ft', () => {
      const largeRfq: RfqExtractionResult = {
        ...baseValidRfq,
        totalPallets: 8,
        totalWeightLbs: 8000,
        items: [
          {
            quantity: 8,
            packagingType: 'PALLET',
            lengthIn: 48,
            widthIn: 40,
            heightIn: 48,
            unitWeightLbs: 1000,
            totalWeightLbs: 8000,
            commodityDescription: 'Heavy Machinery',
            isStackable: false,
            isHazmat: false,
          },
        ],
      };

      const evalResult = HitlConfidenceEvaluator.evaluateRfq(largeRfq);

      expect(evalResult.volumeThresholdWarning?.isVolumeLtl).toBe(true);
      expect(evalResult.volumeThresholdWarning?.linearFeet).toBe(16.0);
    });
  });
});
