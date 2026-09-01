import { z } from 'zod';
import { generateUuidV7 } from '../uuidv7';
import { dbClient } from '../../db/client';
import { CarrierFraudScore, CarrierFraudScoreSchema } from '../../db/schema';

export const CarrierFraudEvaluationInputSchema = z.object({
  tenantId: z.string().min(1),
  carrierScac: z.string().min(2).max(10),
  carrierName: z.string().min(1),
  dotNumber: z.string().min(1),
  mcNumber: z.string().min(1),
  
  // Authority & Safety
  operatingAuthorityStatus: z.enum(['ACTIVE', 'REVOKED', 'INACTIVE', 'SUSPENDED']).default('ACTIVE'),
  safetyRating: z.enum(['SATISFACTORY', 'CONDITIONAL', 'UNSATISFACTORY', 'NONE']).default('SATISFACTORY'),
  autoLiabilityCoverageDollars: z.number().nonnegative().default(1_000_000),
  cargoInsuranceCoverageDollars: z.number().nonnegative().default(100_000),
  driverOosRatePercent: z.number().nonnegative().default(3.2),
  vehicleOosRatePercent: z.number().nonnegative().default(12.5),
  
  // Fraud Heuristics
  daysSinceMcRegistration: z.number().int().nonnegative().default(365),
  daysSinceBankRoutingChange: z.number().int().nonnegative().default(180),
  hasFactoringNoticeOfAssignment: z.boolean().default(false),
  factoringCompany: z.string().optional().nullable(),
  hasFactoringWaiver: z.boolean().default(false),
  hasAddressPhoneRevokedMatch: z.boolean().default(false), // Chameleon indicator
});

export type CarrierFraudEvaluationInput = z.input<typeof CarrierFraudEvaluationInputSchema>;

export interface CarrierFraudEvaluationResult {
  isQuickPayEligible: boolean;
  fraudRiskScore: number; // 0 (clean) to 100 (extreme risk)
  safetyScore: number;    // 100 (pristine) to 0 (unsafe)
  riskTier: 'LOW' | 'MEDIUM' | 'HIGH' | 'BLOCKED';
  ineligibilityReasons: string[];
  warnings: string[];
  checks: {
    hasActiveAuthority: boolean;
    hasSufficientAutoLiability: boolean;
    hasSufficientCargoInsurance: boolean;
    isSatisfactorySafetyRating: boolean;
    isOosRateCompliant: boolean;
    isRecentRoutingNumberChange: boolean;
    isNewlyRegisteredMc: boolean;
    hasFactoringConflict: boolean;
    isChameleonCarrierRisk: boolean;
  };
  scoreRecord: CarrierFraudScore;
}

export class CarrierFraudScoringEngine {
  public static readonly MIN_AUTO_LIABILITY_DOLLARS = 1_000_000;
  public static readonly MIN_CARGO_INSURANCE_DOLLARS = 100_000;
  public static readonly MAX_DRIVER_OOS_PERCENT = 10.0;
  public static readonly MAX_VEHICLE_OOS_PERCENT = 25.0;
  public static readonly NEW_MC_THRESHOLD_DAYS = 90;
  public static readonly RECENT_ROUTING_CHANGE_THRESHOLD_DAYS = 30;

  /**
   * Evaluates FMCSA safety standards and fraud risk heuristics before unlocking QuickPay
   */
  public static evaluateCarrier(input: CarrierFraudEvaluationInput): CarrierFraudEvaluationResult {
    const validated = CarrierFraudEvaluationInputSchema.parse(input);
    const ineligibilityReasons: string[] = [];
    const warnings: string[] = [];

    let fraudRiskScore = 0;
    let safetyScore = 100;

    // 1. Operating Authority Check
    const hasActiveAuthority = validated.operatingAuthorityStatus === 'ACTIVE';
    if (!hasActiveAuthority) {
      ineligibilityReasons.push(`Operating Authority is ${validated.operatingAuthorityStatus} (Active MC/DOT required).`);
      fraudRiskScore += 50;
      safetyScore -= 50;
    }

    // 2. Safety Rating Check
    const isSatisfactorySafetyRating = validated.safetyRating !== 'UNSATISFACTORY';
    if (validated.safetyRating === 'UNSATISFACTORY') {
      ineligibilityReasons.push('Carrier has an UNSATISFACTORY FMCSA safety rating.');
      safetyScore -= 40;
      fraudRiskScore += 30;
    } else if (validated.safetyRating === 'CONDITIONAL') {
      warnings.push('Carrier has a CONDITIONAL safety rating requiring management exception sign-off.');
      safetyScore -= 20;
      fraudRiskScore += 10;
    }

    // 3. Insurance Coverage Minimums
    const hasSufficientAutoLiability = validated.autoLiabilityCoverageDollars >= this.MIN_AUTO_LIABILITY_DOLLARS;
    if (!hasSufficientAutoLiability) {
      ineligibilityReasons.push(
        `Auto Liability coverage ($${validated.autoLiabilityCoverageDollars.toLocaleString()}) is below required $1,000,000 threshold.`
      );
      safetyScore -= 25;
      fraudRiskScore += 20;
    }

    const hasSufficientCargoInsurance = validated.cargoInsuranceCoverageDollars >= this.MIN_CARGO_INSURANCE_DOLLARS;
    if (!hasSufficientCargoInsurance) {
      ineligibilityReasons.push(
        `Cargo Insurance coverage ($${validated.cargoInsuranceCoverageDollars.toLocaleString()}) is below required $100,000 threshold.`
      );
      safetyScore -= 20;
      fraudRiskScore += 15;
    }

    // 4. Out-of-Service (OOS) Rates
    const isDriverOosCompliant = validated.driverOosRatePercent <= this.MAX_DRIVER_OOS_PERCENT;
    const isVehicleOosCompliant = validated.vehicleOosRatePercent <= this.MAX_VEHICLE_OOS_PERCENT;
    const isOosRateCompliant = isDriverOosCompliant && isVehicleOosCompliant;

    if (!isDriverOosCompliant) {
      warnings.push(`Driver OOS rate (${validated.driverOosRatePercent}%) exceeds national benchmark (10%).`);
      safetyScore -= 15;
    }
    if (!isVehicleOosCompliant) {
      warnings.push(`Vehicle OOS rate (${validated.vehicleOosRatePercent}%) exceeds national benchmark (25%).`);
      safetyScore -= 15;
    }

    // 5. Fraud Heuristic: Bank Account Routing Number Changed Within Last 30 Days
    const isRecentRoutingNumberChange = validated.daysSinceBankRoutingChange < this.RECENT_ROUTING_CHANGE_THRESHOLD_DAYS;
    if (isRecentRoutingNumberChange) {
      ineligibilityReasons.push(
        `Bank routing information was modified ${validated.daysSinceBankRoutingChange} days ago (< 30-day anti-fraud hold required).`
      );
      fraudRiskScore += 40;
    }

    // 6. Fraud Heuristic: Newly Registered MC Number (< 90 Days Old)
    const isNewlyRegisteredMc = validated.daysSinceMcRegistration < this.NEW_MC_THRESHOLD_DAYS;
    if (isNewlyRegisteredMc) {
      warnings.push(
        `Carrier MC authority was established ${validated.daysSinceMcRegistration} days ago (< 90-day probationary period).`
      );
      fraudRiskScore += 30;
    }

    // 7. Fraud Heuristic: Chameleon Carrier Pattern (Matched phone/address with revoked DOT)
    const isChameleonCarrierRisk = validated.hasAddressPhoneRevokedMatch;
    if (isChameleonCarrierRisk) {
      ineligibilityReasons.push(
        'Carrier address/phone matches a previously revoked or high-risk DOT authority (Chameleon carrier risk).'
      );
      fraudRiskScore += 50;
    }

    // 8. Factoring Notice of Assignment (NOA) Check
    const hasFactoringConflict = validated.hasFactoringNoticeOfAssignment && !validated.hasFactoringWaiver;
    if (hasFactoringConflict) {
      ineligibilityReasons.push(
        `Carrier has an active Notice of Assignment (NOA) with ${validated.factoringCompany || 'Factoring Company'} without an authorized QuickPay waiver.`
      );
      fraudRiskScore += 25;
    }

    // Bounds normalization
    fraudRiskScore = Math.min(100, Math.max(0, fraudRiskScore));
    safetyScore = Math.min(100, Math.max(0, safetyScore));

    // Risk tier assignment
    let riskTier: 'LOW' | 'MEDIUM' | 'HIGH' | 'BLOCKED';
    if (!hasActiveAuthority || isChameleonCarrierRisk || fraudRiskScore >= 70) {
      riskTier = 'BLOCKED';
    } else if (fraudRiskScore >= 40 || ineligibilityReasons.length > 0) {
      riskTier = 'HIGH';
    } else if (fraudRiskScore >= 20 || warnings.length > 0) {
      riskTier = 'MEDIUM';
    } else {
      riskTier = 'LOW';
    }

    const isQuickPayEligible = ineligibilityReasons.length === 0 && riskTier !== 'BLOCKED' && riskTier !== 'HIGH';

    const scoreRecord: CarrierFraudScore = {
      id: generateUuidV7(),
      tenantId: validated.tenantId,
      carrierScac: validated.carrierScac,
      carrierName: validated.carrierName,
      dotNumber: validated.dotNumber,
      mcNumber: validated.mcNumber,
      hasActiveAuthority,
      hasSufficientAutoLiability,
      hasSufficientCargoInsurance,
      isSatisfactorySafetyRating,
      isOosRateCompliant,
      isRecentRoutingNumberChange,
      isNewlyRegisteredMc,
      hasFactoringNoticeOfAssignment: validated.hasFactoringNoticeOfAssignment,
      factoringCompany: validated.factoringCompany || null,
      hasFactoringWaiver: validated.hasFactoringWaiver,
      isChameleonCarrierRisk,
      fraudRiskScore,
      safetyScore,
      riskTier,
      isQuickPayEligible,
      ineligibilityReasons,
      assessedAt: new Date(),
    };

    return {
      isQuickPayEligible,
      fraudRiskScore,
      safetyScore,
      riskTier,
      ineligibilityReasons,
      warnings,
      checks: {
        hasActiveAuthority,
        hasSufficientAutoLiability,
        hasSufficientCargoInsurance,
        isSatisfactorySafetyRating,
        isOosRateCompliant,
        isRecentRoutingNumberChange,
        isNewlyRegisteredMc,
        hasFactoringConflict,
        isChameleonCarrierRisk,
      },
      scoreRecord,
    };
  }
}
