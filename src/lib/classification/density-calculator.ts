import { NmfcClass } from '../../db/schema';

export interface DensityCalculationInput {
  lengthIn: number;
  widthIn: number;
  heightIn: number;
  weightLbs: number;
  quantity?: number;
  isStackable?: boolean;
}

export interface ItemDensityResult {
  cubicFeetPerUnit: number;
  totalCubicFeet: number;
  pcf: number; // Pounds Per Cubic Foot
  estimatedNmfcClass: NmfcClass;
  linearFeetRequired: number;
  isVolumeLtlCandidate: boolean;
}

export interface ShipmentDensitySummary {
  totalPallets: number;
  totalWeightLbs: number;
  totalCubicFeet: number;
  effectiveShipmentPcf: number;
  recommendedShipmentClass: NmfcClass;
  totalLinearFeet: number;
  trailerSpaceUtilizationPercent: number; // Based on 53ft trailer (53 LF = 100%)
  volumeLtlFlags: {
    exceedsPalletThreshold: boolean; // >= 6 pallets
    exceedsWeightThreshold: boolean; // >= 6000 lbs
    exceedsLinearFeetThreshold: boolean; // > 12 linear feet
    exceedsCubicThreshold: boolean; // > 750 cu ft
    isVolumeLtl: boolean;
  };
}

export class LtlDensityCalculator {
  public static readonly CUBIC_INCHES_PER_CUBIC_FOOT = 1728;
  public static readonly STANDARD_TRAILER_WIDTH_INCHES = 96;
  public static readonly STANDARD_53FT_TRAILER_LINEAR_FEET = 53;
  public static readonly MAX_STACKABLE_HEIGHT_INCHES = 48; // Standard pallet height threshold for double stacking

  /**
   * Calculate Cubic Feet of a single handling unit
   * Formula: (Length * Width * Height) / 1728
   */
  public static calculateCubicFeet(lengthIn: number, widthIn: number, heightIn: number): number {
    if (lengthIn <= 0 || widthIn <= 0 || heightIn <= 0) {
      throw new Error(`Dimensions must be greater than 0: got ${lengthIn}x${widthIn}x${heightIn}`);
    }
    const cuft = (lengthIn * widthIn * heightIn) / this.CUBIC_INCHES_PER_CUBIC_FOOT;
    return parseFloat(cuft.toFixed(2));
  }

  /**
   * Calculate Pounds Per Cubic Foot (PCF) Density
   * Formula: Weight / Cubic Feet
   */
  public static calculatePcf(weightLbs: number, cubicFeet: number): number {
    if (weightLbs <= 0) {
      throw new Error(`Weight must be greater than 0: got ${weightLbs}`);
    }
    if (cubicFeet <= 0) {
      throw new Error(`Cubic feet must be greater than 0: got ${cubicFeet}`);
    }
    const pcf = weightLbs / cubicFeet;
    return parseFloat(pcf.toFixed(2));
  }

  /**
   * NMFC 11-Tier Density-to-Class Lookup Matrix
   * PCF >= 50       -> Class 50
   * 35 <= PCF < 50  -> Class 55
   * 30 <= PCF < 35  -> Class 60
   * 22.5 <= PCF < 30-> Class 65
   * 15 <= PCF < 22.5-> Class 70
   * 12 <= PCF < 15  -> Class 85
   * 10 <= PCF < 12  -> Class 92.5
   * 8 <= PCF < 10   -> Class 100
   * 6 <= PCF < 8    -> Class 125
   * 4 <= PCF < 6    -> Class 175
   * 2 <= PCF < 4    -> Class 250
   * PCF < 2         -> Class 400
   */
  public static lookupNmfcClass(pcf: number): NmfcClass {
    if (pcf >= 50) return '50';
    if (pcf >= 35) return '55';
    if (pcf >= 30) return '60';
    if (pcf >= 22.5) return '65';
    if (pcf >= 15) return '70';
    if (pcf >= 12) return '85';
    if (pcf >= 10) return '92.5';
    if (pcf >= 8) return '100';
    if (pcf >= 6) return '125';
    if (pcf >= 4) return '175';
    if (pcf >= 2) return '250';
    return '400';
  }

  /**
   * Calculate Linear Feet Required for Line Item
   * Standard 53' trailer inside width = 96 inches.
   * Considers stackability constraints and piece orientation.
   */
  public static calculateLinearFeet(
    lengthIn: number,
    widthIn: number,
    heightIn: number,
    quantity: number = 1,
    isStackable: boolean = false
  ): number {
    if (quantity <= 0) return 0;

    // Check if standard 48x40 pallet
    const isStandardPallet =
      (Math.abs(lengthIn - 48) <= 2 && Math.abs(widthIn - 40) <= 2) ||
      (Math.abs(lengthIn - 40) <= 2 && Math.abs(widthIn - 48) <= 2);

    let effectiveQuantity = quantity;
    if (isStackable && heightIn <= this.MAX_STACKABLE_HEIGHT_INCHES) {
      // Double stacked reduces footprint by 50%
      effectiveQuantity = Math.ceil(quantity / 2);
    }

    if (isStandardPallet) {
      // Standard 48x40 pallets fit 2 wide in a 96" trailer (48" side-by-side or 40" pinwheeled)
      // Standard straight loading: 2 pallets per 4 linear feet
      const rows = Math.ceil(effectiveQuantity / 2);
      const linearFeet = rows * 4.0;
      return parseFloat(linearFeet.toFixed(2));
    }

    // Custom Dimensions Calculation:
    // Determine how many fit side-by-side across 96" width
    const fitAcrossUsingWidth = Math.max(1, Math.floor(this.STANDARD_TRAILER_WIDTH_INCHES / widthIn));
    const fitAcrossUsingLength = Math.max(1, Math.floor(this.STANDARD_TRAILER_WIDTH_INCHES / lengthIn));

    // Option 1: Load with length along trailer depth
    const rowsUsingWidth = Math.ceil(effectiveQuantity / fitAcrossUsingWidth);
    const depthUsingLength = rowsUsingWidth * (lengthIn / 12);

    // Option 2: Turn 90 degrees with width along trailer depth
    const rowsUsingLength = Math.ceil(effectiveQuantity / fitAcrossUsingLength);
    const depthUsingWidth = rowsUsingLength * (widthIn / 12);

    // Choose the more space-efficient loading orientation
    const minLinearFeet = Math.min(depthUsingLength, depthUsingWidth);
    return parseFloat(minLinearFeet.toFixed(2));
  }

  /**
   * Evaluate a single freight item
   */
  public static evaluateItem(item: DensityCalculationInput): ItemDensityResult {
    const qty = item.quantity && item.quantity > 0 ? item.quantity : 1;
    const cubicFeetPerUnit = this.calculateCubicFeet(item.lengthIn, item.widthIn, item.heightIn);
    const totalCubicFeet = parseFloat((cubicFeetPerUnit * qty).toFixed(2));
    const pcf = this.calculatePcf(item.weightLbs, cubicFeetPerUnit);
    const estimatedNmfcClass = this.lookupNmfcClass(pcf);
    const linearFeetRequired = this.calculateLinearFeet(
      item.lengthIn,
      item.widthIn,
      item.heightIn,
      qty,
      item.isStackable
    );

    const isVolumeLtlCandidate =
      qty >= 6 || item.weightLbs * qty >= 6000 || linearFeetRequired > 12 || totalCubicFeet > 750;

    return {
      cubicFeetPerUnit,
      totalCubicFeet,
      pcf,
      estimatedNmfcClass,
      linearFeetRequired,
      isVolumeLtlCandidate,
    };
  }

  /**
   * Evaluate complete multi-item shipment and detect Volume-LTL penalty zone thresholds
   */
  public static evaluateShipment(items: DensityCalculationInput[]): ShipmentDensitySummary {
    if (!items || items.length === 0) {
      throw new Error('At least 1 item is required to evaluate shipment density');
    }

    let totalPallets = 0;
    let totalWeightLbs = 0;
    let totalCubicFeet = 0;
    let totalLinearFeet = 0;

    for (const item of items) {
      const qty = item.quantity && item.quantity > 0 ? item.quantity : 1;
      const evalResult = this.evaluateItem(item);

      totalPallets += qty;
      totalWeightLbs += item.weightLbs * qty;
      totalCubicFeet += evalResult.totalCubicFeet;
      totalLinearFeet += evalResult.linearFeetRequired;
    }

    totalCubicFeet = parseFloat(totalCubicFeet.toFixed(2));
    totalWeightLbs = parseFloat(totalWeightLbs.toFixed(2));
    totalLinearFeet = parseFloat(totalLinearFeet.toFixed(2));

    const effectiveShipmentPcf = parseFloat((totalWeightLbs / totalCubicFeet).toFixed(2));
    const recommendedShipmentClass = this.lookupNmfcClass(effectiveShipmentPcf);

    const trailerSpaceUtilizationPercent = parseFloat(
      Math.min(100, (totalLinearFeet / this.STANDARD_53FT_TRAILER_LINEAR_FEET) * 100).toFixed(1)
    );

    const exceedsPalletThreshold = totalPallets >= 6;
    const exceedsWeightThreshold = totalWeightLbs >= 6000;
    const exceedsLinearFeetThreshold = totalLinearFeet > 12;
    const exceedsCubicThreshold = totalCubicFeet > 750;

    const isVolumeLtl =
      exceedsPalletThreshold ||
      exceedsWeightThreshold ||
      exceedsLinearFeetThreshold ||
      exceedsCubicThreshold;

    return {
      totalPallets,
      totalWeightLbs,
      totalCubicFeet,
      effectiveShipmentPcf,
      recommendedShipmentClass,
      totalLinearFeet,
      trailerSpaceUtilizationPercent,
      volumeLtlFlags: {
        exceedsPalletThreshold,
        exceedsWeightThreshold,
        exceedsLinearFeetThreshold,
        exceedsCubicThreshold,
        isVolumeLtl,
      },
    };
  }
}
