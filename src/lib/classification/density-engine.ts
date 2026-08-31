import { ExtractedItem } from '../schema/extracted-rfq-schema';

export interface LineItemMetrics {
  itemId: string;
  volumeCuFt: number;
  densityPcf: number;
  recommendedNmfcClass: number;
  isOverlength: boolean;
  overlengthInches: number;
}

export interface ReclassificationRiskWarning {
  hasRisk: boolean;
  declaredClass: number | null;
  recommendedClass: number;
  deltaClass: number;
  carrierReweighFeeUsd: number;
  estimatedRebillPenaltyUsd: number;
  estimatedRebillRange: { minUsd: number; maxUsd: number };
  warningMessage: string | null;
  severity: 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH';
}

export interface ShipmentDensityMetrics {
  totalHandlingUnits: number;
  totalWeightLbs: number;
  totalVolumeCuFt: number;
  calculatedPcf: number;
  recommendedShipmentClass: number;
  hasOverlengthItems: boolean;
  maxItemLengthInches: number;
  linearFeet: number;
  itemMetrics: LineItemMetrics[];
  reclassificationRisk: ReclassificationRiskWarning;
}

export class DensityRiskEngine {
  public static readonly CLASS_MULTIPLIERS: Record<number, number> = {
    50: 1.0,
    55: 1.1,
    60: 1.2,
    65: 1.3,
    70: 1.4,
    77.5: 1.55,
    85: 1.7,
    92.5: 1.85,
    100: 2.0,
    110: 2.2,
    125: 2.5,
    150: 3.0,
    175: 3.5,
    200: 4.0,
    250: 5.0,
    300: 6.0,
    400: 8.0,
    500: 10.0,
  };

  /**
   * Calculate Cubic Feet for a single item: (L * W * H / 1728) * Units
   */
  public static calculateVolumeCuFt(
    lengthIn: number,
    widthIn: number,
    heightIn: number,
    handlingUnits: number = 1
  ): number {
    if (lengthIn <= 0 || widthIn <= 0 || heightIn <= 0 || handlingUnits <= 0) {
      throw new Error('Dimensions and handling units must be strictly positive');
    }
    const cuft = ((lengthIn * widthIn * heightIn) / 1728) * handlingUnits;
    return parseFloat(cuft.toFixed(2));
  }

  /**
   * Calculate Pounds Per Cubic Foot (PCF)
   */
  public static calculatePcf(weightLbs: number, volumeCuFt: number): number {
    if (weightLbs <= 0 || volumeCuFt <= 0) {
      throw new Error('Weight and Volume must be strictly positive');
    }
    return parseFloat((weightLbs / volumeCuFt).toFixed(2));
  }

  /**
   * Standard NMFC 11-Tier Density Matrix Cross-Reference
   */
  public static lookupNmfcClass(pcf: number): number {
    if (pcf < 1.0) return 500;
    if (pcf < 2.0) return 400;
    if (pcf < 4.0) return 300;
    if (pcf < 6.0) return 250;
    if (pcf < 8.0) return 175;
    if (pcf < 10.0) return 125;
    if (pcf < 12.0) return 100;
    if (pcf < 15.0) return 85;
    if (pcf < 22.5) return 70;
    if (pcf < 30.0) return 65;
    return 50; // >= 30 PCF
  }

  /**
   * Linear Foot Calculation for 53ft / 102in wide trailer (2 standard pallets across)
   */
  public static calculateLinearFeet(
    items: Array<{ length_inches: number; handling_units: number; is_stackable?: boolean }>
  ): number {
    let totalPalletSlots = 0;
    for (const item of items) {
      const units = item.is_stackable ? Math.ceil(item.handling_units / 2) : item.handling_units;
      totalPalletSlots += units;
    }
    const linearFeet = Math.ceil(totalPalletSlots / 2) * 4.0;
    return parseFloat(linearFeet.toFixed(2));
  }

  /**
   * Evaluate Reclassification Risk & Financial Penalty Exposure
   */
  public static evaluateReclassificationRisk(
    declaredClass: number | null | undefined,
    recommendedClass: number,
    totalWeightLbs: number,
    baseRateUsd: number = 350.0
  ): ReclassificationRiskWarning {
    if (!declaredClass) {
      return {
        hasRisk: false,
        declaredClass: null,
        recommendedClass,
        deltaClass: 0,
        carrierReweighFeeUsd: 0,
        estimatedRebillPenaltyUsd: 0,
        estimatedRebillRange: { minUsd: 0, maxUsd: 0 },
        warningMessage: null,
        severity: 'NONE',
      };
    }

    const deltaClass = recommendedClass - declaredClass;
    const carrierReweighFeeUsd = 35.0;

    if (deltaClass <= 0) {
      return {
        hasRisk: false,
        declaredClass,
        recommendedClass,
        deltaClass,
        carrierReweighFeeUsd: 0,
        estimatedRebillPenaltyUsd: 0,
        estimatedRebillRange: { minUsd: 0, maxUsd: 0 },
        warningMessage: null,
        severity: 'NONE',
      };
    }

    const multRec = this.CLASS_MULTIPLIERS[recommendedClass] || 2.0;
    const multDec = this.CLASS_MULTIPLIERS[declaredClass] || 1.0;
    const multiplierDelta = Math.max(0, multRec - multDec);

    // Rate scaling based on weight
    const scaledBaseRate = Math.max(baseRateUsd, (totalWeightLbs / 1000) * 85.0);
    const estimatedPenalty = parseFloat((scaledBaseRate * multiplierDelta + carrierReweighFeeUsd).toFixed(2));
    const minUsd = Math.round(estimatedPenalty * 0.85);
    const maxUsd = Math.round(estimatedPenalty * 1.25);

    let severity: ReclassificationRiskWarning['severity'] = 'LOW';
    if (deltaClass >= 50 || estimatedPenalty >= 200) severity = 'HIGH';
    else if (deltaClass >= 20 || estimatedPenalty >= 100) severity = 'MEDIUM';

    const warningMessage = `High Risk of Reclassification! Quoting at Class ${declaredClass} instead of Class ${recommendedClass} carries an estimated $${minUsd}-$${maxUsd} re-bill exposure.`;

    return {
      hasRisk: true,
      declaredClass,
      recommendedClass,
      deltaClass,
      carrierReweighFeeUsd,
      estimatedRebillPenaltyUsd: estimatedPenalty,
      estimatedRebillRange: { minUsd, maxUsd },
      warningMessage,
      severity,
    };
  }

  /**
   * Evaluate Full Shipment Density Metrics
   */
  public static evaluateShipment(
    items: ExtractedItem[],
    declaredClassOverride?: number | null
  ): ShipmentDensityMetrics {
    if (!items || items.length === 0) {
      throw new Error('Cannot evaluate empty items array');
    }

    let totalHandlingUnits = 0;
    let totalWeightLbs = 0;
    let totalVolumeCuFt = 0;
    let maxItemLength = 0;
    let hasOverlength = false;

    const itemMetrics: LineItemMetrics[] = [];

    for (const item of items) {
      const vol = this.calculateVolumeCuFt(
        item.length_inches,
        item.width_inches,
        item.height_inches,
        item.handling_units
      );
      const density = this.calculatePcf(item.total_weight_lbs, vol);
      const recClass = this.lookupNmfcClass(density);
      const isOverlength = item.length_inches >= 96;

      if (isOverlength) hasOverlength = true;
      if (item.length_inches > maxItemLength) maxItemLength = item.length_inches;

      totalHandlingUnits += item.handling_units;
      totalWeightLbs += item.total_weight_lbs;
      totalVolumeCuFt += vol;

      itemMetrics.push({
        itemId: item.item_id,
        volumeCuFt: vol,
        densityPcf: density,
        recommendedNmfcClass: recClass,
        isOverlength,
        overlengthInches: Math.max(0, item.length_inches - 96),
      });
    }

    totalVolumeCuFt = parseFloat(totalVolumeCuFt.toFixed(2));
    totalWeightLbs = parseFloat(totalWeightLbs.toFixed(2));

    const aggregatePcf = this.calculatePcf(totalWeightLbs, totalVolumeCuFt);
    const recommendedShipmentClass = this.lookupNmfcClass(aggregatePcf);
    const linearFeet = this.calculateLinearFeet(items);

    // Determine declared class from override or primary item
    const declaredClass = declaredClassOverride ?? items[0]?.declared_class ?? null;
    const reclassificationRisk = this.evaluateReclassificationRisk(
      declaredClass,
      recommendedShipmentClass,
      totalWeightLbs
    );

    return {
      totalHandlingUnits,
      totalWeightLbs,
      totalVolumeCuFt,
      calculatedPcf: aggregatePcf,
      recommendedShipmentClass,
      hasOverlengthItems: hasOverlength,
      maxItemLengthInches: maxItemLength,
      linearFeet,
      itemMetrics,
      reclassificationRisk,
    };
  }
}
