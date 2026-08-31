import { CarrierVettingRecord } from '../../db/schema';
import { generateUuidV7 } from '../uuidv7';

export interface VettingRequest {
  tenantId: string;
  carrierCode: string;
  carrierScac: string;
  carrierName: string;
  dotNumber: string;
  mcNumber: string;
  autoLiabilityCoverageDollars?: number;
  cargoInsuranceCoverageDollars?: number;
  safetyRatingOverride?: 'SATISFACTORY' | 'CONDITIONAL' | 'UNSATISFACTORY' | 'NONE';
  operatingAuthorityStatusOverride?: 'ACTIVE' | 'REVOKED' | 'INACTIVE';
  driverOosRatePercent?: number;
  vehicleOosRatePercent?: number;
}

export interface VettingEvaluationResult {
  isApproved: boolean;
  carrierScac: string;
  carrierName: string;
  dotNumber: string;
  mcNumber: string;
  safetyScore: number; // 0 to 100
  rejectionReasons: string[];
  operatingAuthorityStatus: 'ACTIVE' | 'REVOKED' | 'INACTIVE';
  safetyRating: 'SATISFACTORY' | 'CONDITIONAL' | 'UNSATISFACTORY' | 'NONE';
  autoLiabilityCoverageDollars: number;
  cargoInsuranceCoverageDollars: number;
  driverOosRatePercent: number;
  vehicleOosRatePercent: number;
  vettedAt: string;
}

export class FmcsaCarrierVettingEngine {
  public static readonly MIN_AUTO_LIABILITY_DOLLARS = 1_000_000; // $1M minimum
  public static readonly MIN_CARGO_INSURANCE_DOLLARS = 100_000;   // $100k minimum
  public static readonly MAX_DRIVER_OOS_RATE = 10.0;             // Max 10%
  public static readonly MAX_VEHICLE_OOS_RATE = 25.0;            // Max 25%

  /**
   * Vet Carrier Compliance against FMCSA Safety & Insurance Standards
   */
  public static evaluateCarrier(request: VettingRequest): VettingEvaluationResult {
    const rejectionReasons: string[] = [];

    const authorityStatus = request.operatingAuthorityStatusOverride || 'ACTIVE';
    const safetyRating = request.safetyRatingOverride || 'SATISFACTORY';
    const autoLiability = request.autoLiabilityCoverageDollars ?? 1_000_000;
    const cargoInsurance = request.cargoInsuranceCoverageDollars ?? 150_000;
    const driverOos = request.driverOosRatePercent ?? 3.5;
    const vehicleOos = request.vehicleOosRatePercent ?? 12.0;

    // 1. Operating Authority Check
    if (authorityStatus !== 'ACTIVE') {
      rejectionReasons.push(`Operating Authority is ${authorityStatus} (Active MC/DOT required).`);
    }

    // 2. Safety Rating Check
    if (safetyRating === 'UNSATISFACTORY') {
      rejectionReasons.push('Carrier has an UNSATISFACTORY FMCSA safety rating.');
    } else if (safetyRating === 'CONDITIONAL') {
      rejectionReasons.push('Carrier has a CONDITIONAL safety rating requiring management sign-off.');
    }

    // 3. Certificate of Insurance (COI) Minimums
    if (autoLiability < this.MIN_AUTO_LIABILITY_DOLLARS) {
      rejectionReasons.push(
        `Auto Liability coverage ($${autoLiability.toLocaleString()}) is below required $1,000,000 threshold.`
      );
    }
    if (cargoInsurance < this.MIN_CARGO_INSURANCE_DOLLARS) {
      rejectionReasons.push(
        `Cargo Insurance coverage ($${cargoInsurance.toLocaleString()}) is below required $100,000 threshold.`
      );
    }

    // 4. Out-of-Service (OOS) Rates
    if (driverOos > this.MAX_DRIVER_OOS_RATE) {
      rejectionReasons.push(`Driver OOS rate (${driverOos}%) exceeds national maximum threshold (10%).`);
    }
    if (vehicleOos > this.MAX_VEHICLE_OOS_RATE) {
      rejectionReasons.push(`Vehicle OOS rate (${vehicleOos}%) exceeds national maximum threshold (25%).`);
    }

    const isApproved = rejectionReasons.length === 0;

    // Calculate composite safety score (0 to 100)
    let safetyScore = 100;
    if (authorityStatus !== 'ACTIVE') safetyScore -= 50;
    if (safetyRating === 'UNSATISFACTORY') safetyScore -= 40;
    if (safetyRating === 'CONDITIONAL') safetyScore -= 20;
    if (autoLiability < this.MIN_AUTO_LIABILITY_DOLLARS) safetyScore -= 20;
    if (cargoInsurance < this.MIN_CARGO_INSURANCE_DOLLARS) safetyScore -= 15;
    if (driverOos > this.MAX_DRIVER_OOS_RATE) safetyScore -= 15;
    if (vehicleOos > this.MAX_VEHICLE_OOS_RATE) safetyScore -= 15;
    safetyScore = Math.max(0, safetyScore);

    return {
      isApproved,
      carrierScac: request.carrierScac,
      carrierName: request.carrierName,
      dotNumber: request.dotNumber,
      mcNumber: request.mcNumber,
      safetyScore,
      rejectionReasons,
      operatingAuthorityStatus: authorityStatus,
      safetyRating,
      autoLiabilityCoverageDollars: autoLiability,
      cargoInsuranceCoverageDollars: cargoInsurance,
      driverOosRatePercent: driverOos,
      vehicleOosRatePercent: vehicleOos,
      vettedAt: new Date().toISOString(),
    };
  }
}
