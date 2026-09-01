import { describe, it, expect } from 'vitest';
import {
  CarrierFraudScoringEngine,
  CarrierFraudEvaluationInput,
} from '../src/lib/quickpay/carrier-fraud-scoring-engine';

describe('Phase 6.1: Carrier Safety, Compliance & Fraud Risk Scoring Engine', () => {
  const baseCarrierInput: CarrierFraudEvaluationInput = {
    tenantId: '01916362-7901-7080-867c-9b8895092a01',
    carrierScac: 'SAIA',
    carrierName: 'SAIA LTL Freight',
    dotNumber: '123456',
    mcNumber: 'MC-987654',
    operatingAuthorityStatus: 'ACTIVE',
    safetyRating: 'SATISFACTORY',
    autoLiabilityCoverageDollars: 1_000_000,
    cargoInsuranceCoverageDollars: 100_000,
    driverOosRatePercent: 3.5,
    vehicleOosRatePercent: 12.0,
    daysSinceMcRegistration: 365,
    daysSinceBankRoutingChange: 180,
    hasFactoringNoticeOfAssignment: false,
    hasFactoringWaiver: false,
    hasAddressPhoneRevokedMatch: false,
  };

  it('approves a fully compliant carrier with low fraud score and unlocks QuickPay', () => {
    const result = CarrierFraudScoringEngine.evaluateCarrier(baseCarrierInput);

    expect(result.isQuickPayEligible).toBe(true);
    expect(result.riskTier).toBe('LOW');
    expect(result.fraudRiskScore).toBe(0);
    expect(result.safetyScore).toBe(100);
    expect(result.ineligibilityReasons.length).toBe(0);
  });

  it('blocks QuickPay when bank routing number was modified within last 30 days (Anti-Fraud Heuristic)', () => {
    const suspiciousInput: CarrierFraudEvaluationInput = {
      ...baseCarrierInput,
      daysSinceBankRoutingChange: 12, // Changed 12 days ago (< 30 days)
    };

    const result = CarrierFraudScoringEngine.evaluateCarrier(suspiciousInput);

    expect(result.isQuickPayEligible).toBe(false);
    expect(result.riskTier).toBe('HIGH');
    expect(result.fraudRiskScore).toBeGreaterThanOrEqual(40);
    expect(result.checks.isRecentRoutingNumberChange).toBe(true);
    expect(result.ineligibilityReasons.some((r) => r.includes('< 30-day'))).toBe(true);
  });

  it('flags chameleon carrier risk when phone/address matches a revoked authority', () => {
    const chameleonInput: CarrierFraudEvaluationInput = {
      ...baseCarrierInput,
      hasAddressPhoneRevokedMatch: true,
    };

    const result = CarrierFraudScoringEngine.evaluateCarrier(chameleonInput);

    expect(result.isQuickPayEligible).toBe(false);
    expect(result.riskTier).toBe('BLOCKED');
    expect(result.checks.isChameleonCarrierRisk).toBe(true);
    expect(result.ineligibilityReasons.some((r) => r.includes('Chameleon'))).toBe(true);
  });

  it('blocks payout when carrier has an un-waived Factoring Notice of Assignment (NOA)', () => {
    const factoredInput: CarrierFraudEvaluationInput = {
      ...baseCarrierInput,
      hasFactoringNoticeOfAssignment: true,
      factoringCompany: 'Triumph Factoring, LLC',
      hasFactoringWaiver: false,
    };

    const result = CarrierFraudScoringEngine.evaluateCarrier(factoredInput);

    expect(result.isQuickPayEligible).toBe(false);
    expect(result.checks.hasFactoringConflict).toBe(true);
    expect(result.ineligibilityReasons.some((r) => r.includes('Notice of Assignment (NOA)'))).toBe(true);
  });

  it('approves factored carrier when an authorized QuickPay waiver is present', () => {
    const waivedFactoredInput: CarrierFraudEvaluationInput = {
      ...baseCarrierInput,
      hasFactoringNoticeOfAssignment: true,
      factoringCompany: 'Triumph Factoring, LLC',
      hasFactoringWaiver: true, // Waiver granted
    };

    const result = CarrierFraudScoringEngine.evaluateCarrier(waivedFactoredInput);

    expect(result.isQuickPayEligible).toBe(true);
    expect(result.checks.hasFactoringConflict).toBe(false);
  });

  it('flags warning for newly registered MC authority (< 90 days old)', () => {
    const newMcInput: CarrierFraudEvaluationInput = {
      ...baseCarrierInput,
      daysSinceMcRegistration: 45, // 45 days old (< 90 days)
    };

    const result = CarrierFraudScoringEngine.evaluateCarrier(newMcInput);

    expect(result.checks.isNewlyRegisteredMc).toBe(true);
    expect(result.fraudRiskScore).toBe(30);
    expect(result.warnings.some((w) => w.includes('< 90-day'))).toBe(true);
  });
});
