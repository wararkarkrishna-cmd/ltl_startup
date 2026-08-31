import { RfqExtractionResult } from '../schema/rfq-extraction-schema';
import { LtlDensityCalculator } from '../classification/density-calculator';

export type ConfidenceTier = 'GREEN' | 'YELLOW' | 'RED';

export interface FieldConfidenceItem {
  fieldName: string;
  score: number; // 0.00 to 1.00
  tier: ConfidenceTier;
  isCritical: boolean;
  value: any;
  flaggedReason?: string;
}

export interface HitlEvaluationResult {
  overallConfidence: number;
  overallTier: ConfidenceTier;
  requiresHumanReview: boolean;
  blockDownstreamRating: boolean;
  criticalFieldCount: number;
  lowConfidenceFieldCount: number;
  fields: Record<string, FieldConfidenceItem>;
  escalationReasons: string[];
  volumeThresholdWarning?: {
    isVolumeLtl: boolean;
    reason: string;
    linearFeet: number;
    totalWeightLbs: number;
  };
}

export class HitlConfidenceEvaluator {
  public static readonly CRITICAL_FIELD_THRESHOLD = 0.90;
  public static readonly OVERALL_CONFIDENCE_THRESHOLD = 0.85;
  public static readonly LOW_CONFIDENCE_RED_THRESHOLD = 0.70;

  /**
   * Determine color tier from numerical score
   */
  public static getConfidenceTier(score: number): ConfidenceTier {
    if (score >= this.CRITICAL_FIELD_THRESHOLD) return 'GREEN';
    if (score >= this.LOW_CONFIDENCE_RED_THRESHOLD) return 'YELLOW';
    return 'RED';
  }

  /**
   * Evaluate complete extracted RFQ against safety and accuracy thresholds
   */
  public static evaluateRfq(rfq: RfqExtractionResult): HitlEvaluationResult {
    const fields: Record<string, FieldConfidenceItem> = {};
    const escalationReasons: string[] = [];

    // 1. Origin ZIP Code Evaluation (Critical Field)
    const originZipValid = /^\d{5}(-\d{4})?$|^[A-Za-z]\d[A-Za-z][ -]?\d[A-Za-z]\d$/.test(rfq.origin.zip);
    const originZipScore = originZipValid ? (rfq.confidenceScores?.originZip ?? 0.98) : 0.40;
    const originZipTier = this.getConfidenceTier(originZipScore);
    fields['origin.zip'] = {
      fieldName: 'Origin Postal Code',
      score: originZipScore,
      tier: originZipTier,
      isCritical: true,
      value: rfq.origin.zip,
      flaggedReason: !originZipValid ? 'Invalid postal code format' : undefined,
    };
    if (originZipScore < this.CRITICAL_FIELD_THRESHOLD) {
      escalationReasons.push(`Critical field 'Origin Postal Code' confidence (${originZipScore}) is below 0.90.`);
    }

    // 2. Destination ZIP Code Evaluation (Critical Field)
    const destZipValid = /^\d{5}(-\d{4})?$|^[A-Za-z]\d[A-Za-z][ -]?\d[A-Za-z]\d$/.test(rfq.destination.zip);
    const destZipScore = destZipValid ? (rfq.confidenceScores?.destZip ?? 0.98) : 0.40;
    const destZipTier = this.getConfidenceTier(destZipScore);
    fields['destination.zip'] = {
      fieldName: 'Destination Postal Code',
      score: destZipScore,
      tier: destZipTier,
      isCritical: true,
      value: rfq.destination.zip,
      flaggedReason: !destZipValid ? 'Invalid postal code format' : undefined,
    };
    if (destZipScore < this.CRITICAL_FIELD_THRESHOLD) {
      escalationReasons.push(`Critical field 'Destination Postal Code' confidence (${destZipScore}) is below 0.90.`);
    }

    // 3. Total Weight Evaluation (Critical Field)
    const weightValid = rfq.totalWeightLbs > 0 && rfq.totalWeightLbs < 45000;
    const weightScore = weightValid ? (rfq.confidenceScores?.totalWeight ?? 0.95) : 0.30;
    const weightTier = this.getConfidenceTier(weightScore);
    fields['totalWeightLbs'] = {
      fieldName: 'Total Shipment Weight',
      score: weightScore,
      tier: weightTier,
      isCritical: true,
      value: rfq.totalWeightLbs,
      flaggedReason: !weightValid ? 'Total weight is missing or exceeds legal axle limits' : undefined,
    };
    if (weightScore < this.CRITICAL_FIELD_THRESHOLD) {
      escalationReasons.push(`Critical field 'Total Shipment Weight' confidence (${weightScore}) is below 0.90.`);
    }

    // 4. Pallet / Piece Count Evaluation
    const palletsValid = rfq.totalPallets >= 1 && rfq.totalPallets <= 30;
    const palletScore = palletsValid ? (rfq.confidenceScores?.palletCount ?? 0.95) : 0.50;
    fields['totalPallets'] = {
      fieldName: 'Total Pallets / Handling Units',
      score: palletScore,
      tier: this.getConfidenceTier(palletScore),
      isCritical: false,
      value: rfq.totalPallets,
    };

    // 5. Line Item Dimensions Evaluation
    let dimValid = true;
    for (const item of rfq.items) {
      if (item.lengthIn <= 0 || item.widthIn <= 0 || item.heightIn <= 0) {
        dimValid = false;
        break;
      }
    }
    const dimScore = dimValid ? (rfq.confidenceScores?.dimensions ?? 0.94) : 0.45;
    fields['dimensions'] = {
      fieldName: 'Item Dimensions (L x W x H)',
      score: dimScore,
      tier: this.getConfidenceTier(dimScore),
      isCritical: false,
      value: `${rfq.items[0]?.lengthIn}x${rfq.items[0]?.widthIn}x${rfq.items[0]?.heightIn}`,
    };

    // 6. Accessorials Evaluation (Critical Field for Liftgate & Hazmat)
    const hasLiftgate = rfq.accessorials.includes('LG_PU') || rfq.accessorials.includes('LG_DEL');
    const hasHazmat = rfq.accessorials.includes('HAZMAT') || rfq.items.some((i) => i.isHazmat);
    const accessorialScore = rfq.confidenceScores?.accessorials ?? 0.92;
    fields['accessorials'] = {
      fieldName: 'Accessorial Services',
      score: accessorialScore,
      tier: this.getConfidenceTier(accessorialScore),
      isCritical: hasLiftgate || hasHazmat,
      value: rfq.accessorials,
    };

    if (hasHazmat && !rfq.items.some((i) => i.unNumber)) {
      escalationReasons.push('Hazardous Materials flagged without specified DOT UN identification number.');
    }

    // 7. Overall Composite Confidence Calculation
    const scores = Object.values(fields).map((f) => f.score);
    const calculatedOverall = parseFloat((scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(2));
    const overallScore = rfq.confidenceScores?.overall ? Math.min(rfq.confidenceScores.overall, calculatedOverall) : calculatedOverall;
    const overallTier = this.getConfidenceTier(overallScore);

    if (overallScore < this.OVERALL_CONFIDENCE_THRESHOLD) {
      escalationReasons.push(`Overall extraction confidence (${overallScore}) is below minimum threshold 0.85.`);
    }

    // 8. Density & Volume-LTL Threshold Warning Evaluation
    const densitySummary = LtlDensityCalculator.evaluateShipment(
      rfq.items.map((item) => ({
        lengthIn: item.lengthIn,
        widthIn: item.widthIn,
        heightIn: item.heightIn,
        weightLbs: item.unitWeightLbs,
        quantity: item.quantity,
        isStackable: item.isStackable,
      }))
    );

    let volumeWarning: HitlEvaluationResult['volumeThresholdWarning'];
    if (densitySummary.volumeLtlFlags.isVolumeLtl) {
      volumeWarning = {
        isVolumeLtl: true,
        reason: `Exceeds LTL standard parameters: ${densitySummary.totalLinearFeet} linear feet, ${densitySummary.totalWeightLbs} lbs (Volume-LTL surcharge risk).`,
        linearFeet: densitySummary.totalLinearFeet,
        totalWeightLbs: densitySummary.totalWeightLbs,
      };
    }

    const lowConfidenceFieldCount = Object.values(fields).filter((f) => f.tier === 'RED').length;
    const criticalFieldCount = Object.values(fields).filter((f) => f.isCritical).length;

    const requiresHumanReview = escalationReasons.length > 0 || rfq.requiresHumanReview || lowConfidenceFieldCount > 0;
    const blockDownstreamRating = requiresHumanReview;

    return {
      overallConfidence: overallScore,
      overallTier,
      requiresHumanReview,
      blockDownstreamRating,
      criticalFieldCount,
      lowConfidenceFieldCount,
      fields,
      escalationReasons,
      volumeThresholdWarning: volumeWarning,
    };
  }

  /**
   * Rating Gatekeeper: Enforces broker review before rating
   */
  public static canProceedToRating(evaluation: HitlEvaluationResult): { allowed: boolean; reason?: string } {
    if (evaluation.blockDownstreamRating) {
      return {
        allowed: false,
        reason: `Rating is blocked: Human review required. Escalations: ${evaluation.escalationReasons.join(' | ')}`,
      };
    }
    return { allowed: true };
  }
}
