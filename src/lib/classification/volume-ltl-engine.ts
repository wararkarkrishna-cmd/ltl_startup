import { RateItem } from '../rating/carrier-adapter.interface';

export interface VolumeLtlEvaluation {
  isVolumeLtl: boolean;
  totalPallets: number;
  totalWeightLbs: number;
  totalVolumeCuFt: number;
  totalLinearFeet: number;
  calculatedPcf: number;
  isCubicCapacityPenaltyRisk: boolean;
  triggerReasons: string[];
  warningMessage: string | null;
  recommendedAction: 'STANDARD_LTL' | 'VOLUME_LTL_SPOT_QUOTE' | 'SPLIT_SHIPMENT_RECOMMENDED';
}

export class VolumeLtlEngine {
  public static readonly WEIGHT_THRESHOLD_LBS = 5000;
  public static readonly PALLET_THRESHOLD = 6;
  public static readonly LINEAR_FEET_THRESHOLD = 12;
  public static readonly VOLUME_CUFT_THRESHOLD = 750;
  public static readonly CUBIC_CAPACITY_PCF_THRESHOLD = 6.0;

  /**
   * Calculate Trailer Linear Footage
   * For standard 48x40 pallets loaded 2-across: ceil(pallets / 2) * 4 ft
   */
  public static calculateLinearFeet(items: RateItem[]): number {
    let standardPalletCount = 0;
    let customLinearFeet = 0;

    for (const item of items) {
      const qty = item.quantity || 1;
      const l = item.lengthIn || 48;
      const w = item.widthIn || 40;

      // Check if standard 48x40 or 40x48 pallet
      const isStandardSize = (l <= 48 && w <= 48);
      if (isStandardSize) {
        standardPalletCount += qty;
      } else {
        // Overlength or custom oversized crate / skid: takes dedicated lengthwise trailer slot
        const lengthFeet = Math.max(l, w) / 12.0;
        customLinearFeet += lengthFeet * qty;
      }
    }

    const standardLinearFeet = Math.ceil(standardPalletCount / 2) * 4.0;
    return parseFloat((standardLinearFeet + customLinearFeet).toFixed(1));
  }

  /**
   * Calculate Total Volume in Cubic Feet
   */
  public static calculateTotalVolumeCuFt(items: RateItem[]): number {
    let totalCuFt = 0;
    for (const item of items) {
      const qty = item.quantity || 1;
      const l = item.lengthIn || 48;
      const w = item.widthIn || 40;
      const h = item.heightIn || 48;
      const itemCuFt = ((l * w * h) / 1728) * qty;
      totalCuFt += itemCuFt;
    }
    return parseFloat(totalCuFt.toFixed(2));
  }

  /**
   * Comprehensive Volume LTL & Cubic Capacity Evaluation
   */
  public static evaluateShipment(items: RateItem[]): VolumeLtlEvaluation {
    const totalPallets = items.reduce((sum, it) => sum + (it.quantity || 1), 0);
    const totalWeightLbs = items.reduce((sum, it) => sum + (it.weightLbs || 500) * (it.quantity || 1), 0);
    const totalVolumeCuFt = this.calculateTotalVolumeCuFt(items);
    const totalLinearFeet = this.calculateLinearFeet(items);
    const calculatedPcf = totalVolumeCuFt > 0 ? parseFloat((totalWeightLbs / totalVolumeCuFt).toFixed(2)) : 0;

    const triggerReasons: string[] = [];

    if (totalWeightLbs > this.WEIGHT_THRESHOLD_LBS) {
      triggerReasons.push(`Total Weight (${totalWeightLbs.toLocaleString()} lbs) exceeds 5,000 lbs threshold`);
    }
    if (totalPallets >= this.PALLET_THRESHOLD) {
      triggerReasons.push(`Total Pallet Count (${totalPallets}) meets/exceeds 6 pallets threshold`);
    }
    if (totalLinearFeet >= this.LINEAR_FEET_THRESHOLD) {
      triggerReasons.push(`Total Linear Footage (${totalLinearFeet} ft) meets/exceeds 12 ft threshold`);
    }
    if (totalVolumeCuFt >= this.VOLUME_CUFT_THRESHOLD) {
      triggerReasons.push(`Total Volume (${totalVolumeCuFt.toLocaleString()} cu ft) meets/exceeds 750 cu ft threshold`);
    }

    const isVolumeLtl = triggerReasons.length > 0;

    // Cubic Capacity / Low Density Penalty Risk (Rule 110: >= 750 cu ft and < 6.0 PCF)
    const isCubicCapacityPenaltyRisk = totalVolumeCuFt >= this.VOLUME_CUFT_THRESHOLD && calculatedPcf < this.CUBIC_CAPACITY_PCF_THRESHOLD;

    let warningMessage: string | null = null;
    let recommendedAction: 'STANDARD_LTL' | 'VOLUME_LTL_SPOT_QUOTE' | 'SPLIT_SHIPMENT_RECOMMENDED' = 'STANDARD_LTL';

    if (isCubicCapacityPenaltyRisk) {
      warningMessage = `HIGH RISK: Cubic Capacity Rule Triggered! Volume (${totalVolumeCuFt} cu ft) with low density (${calculatedPcf} PCF) will trigger carrier linear-foot/cubic minimum penalties ($850-$1,400 surcharge). Combinatorial Split or Volume-LTL Spot Quote strongly recommended.`;
      recommendedAction = 'SPLIT_SHIPMENT_RECOMMENDED';
    } else if (isVolumeLtl) {
      warningMessage = `Volume LTL Criteria Triggered (${totalPallets} pallets, ${totalLinearFeet} linear ft, ${totalWeightLbs.toLocaleString()} lbs). Standard LTL common carrier rates may face trailer space caps.`;
      recommendedAction = totalPallets >= 6 ? 'SPLIT_SHIPMENT_RECOMMENDED' : 'VOLUME_LTL_SPOT_QUOTE';
    }

    return {
      isVolumeLtl,
      totalPallets,
      totalWeightLbs,
      totalVolumeCuFt,
      totalLinearFeet,
      calculatedPcf,
      isCubicCapacityPenaltyRisk,
      triggerReasons,
      warningMessage,
      recommendedAction,
    };
  }
}
