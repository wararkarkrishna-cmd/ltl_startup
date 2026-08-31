import { RateRequest, RateItem } from './carrier-adapter.interface';

export interface CzarLiteTariffResult {
  distanceMiles: number;
  totalWeightLbs: number;
  cwt: number; // Hundredweight
  effectiveClass: number;
  baseTariffCents: number; // Undiscounted CzarLite Base Rate
  discountPercent: number; // e.g. 0.82 for 82% discount
  discountedLinehaulCents: number; // max(BaseTariff * (1 - Discount), AMC)
  isMinimumChargeApplied: boolean;
  absoluteMinimumChargeCents: number;
  fuelSurchargePercent: number; // e.g. 0.285 for 28.5%
  fuelSurchargeCents: number;
  accessorialFees: Record<string, number>;
  totalAccessorialCostCents: number;
  totalCarrierCostCents: number;
  estimatedTransitDays: number;
}

export class CzarLiteTariffEngine {
  // Standard DOE Fuel Surcharge (28.5%)
  public static readonly DEFAULT_FUEL_SURCHARGE_RATE = 0.285;

  // Standard Absolute Minimum Charge (AMC) Floors
  public static readonly DIRECT_AMC_CENTS = 17500; // $175.00
  public static readonly WHOLESALE_AMC_CENTS = 14800; // $148.00

  // Standard Accessorial Fee Schedule (in Cents)
  public static readonly ACCESSORIAL_TARIFF_RATES: Record<string, number> = {
    LIFTGATE_DELIVERY: 7500,        // $75.00
    LIFTGATE_PICKUP: 7500,          // $75.00
    RESIDENTIAL_DELIVERY: 8500,     // $85.00
    RESIDENTIAL_PICKUP: 8500,       // $85.00
    INSIDE_DELIVERY: 9500,          // $95.00
    INSIDE_PICKUP: 9500,            // $95.00
    LIMITED_ACCESS_DELIVERY: 6500,  // $65.00
    LIMITED_ACCESS_PICKUP: 6500,    // $65.00
    APPOINTMENT_DELIVERY: 3500,     // $35.00
    APPOINTMENT_PICKUP: 3500,       // $35.00
    NOTIFY_BEFORE_DELIVERY: 2500,   // $25.00
    HAZMAT: 15000,                  // $150.00
    TRADESHOW: 25000,               // $250.00
    OVERLENGTH: 12500,              // $125.00
    FREEZE_PROTECTION: 6000,        // $60.00
    SORT_AND_SEGREGATE: 8000,       // $80.00
    CONSTRUCTION_SITE: 7500,        // $75.00
  };

  // Class Multipliers relative to Class 70 = 1.00
  public static readonly CLASS_MULTIPLIERS: Record<string, number> = {
    '50': 0.72,
    '55': 0.78,
    '60': 0.85,
    '65': 0.92,
    '70': 1.00,
    '77.5': 1.12,
    '85': 1.25,
    '92.5': 1.38,
    '100': 1.55,
    '110': 1.72,
    '125': 1.95,
    '150': 2.35,
    '175': 2.75,
    '200': 3.15,
    '250': 3.90,
    '300': 4.70,
    '400': 6.20,
    '500': 7.80,
  };

  // 3-Digit Sectional Center Facility (SCF) Geographic Centroids
  private static readonly SCF_CENTROIDS: Record<string, { lat: number; lon: number }> = {
    '0': { lat: 41.5, lon: -72.5 },  // New England (MA, CT, RI, NH, VT, ME, NJ)
    '1': { lat: 41.2, lon: -76.5 },  // NY, PA, DE
    '2': { lat: 36.5, lon: -79.5 },  // DC, MD, VA, NC, SC, WV
    '3': { lat: 31.0, lon: -84.0 },  // GA, FL, AL, TN, MS
    '4': { lat: 40.5, lon: -83.5 },  // OH, IN, KY, MI
    '5': { lat: 45.0, lon: -94.0 },  // IA, WI, MN, SD, ND, MT
    '6': { lat: 39.5, lon: -90.0 },  // IL, MO, KS, NE
    '7': { lat: 32.0, lon: -96.0 },  // LA, AR, OK, TX
    '8': { lat: 38.0, lon: -110.0 }, // CO, WY, ID, UT, AZ, NM, NV
    '9': { lat: 36.5, lon: -120.0 }, // CA, OR, WA, AK, HI
  };

  /**
   * Approximate Great-Circle Distance between two 5-digit US ZIP codes with road circuity
   */
  public static estimateHighwayMileage(originZip: string, destZip: string): number {
    const oPrefix = originZip.trim().charAt(0);
    const dPrefix = destZip.trim().charAt(0);

    const c1 = this.SCF_CENTROIDS[oPrefix] || { lat: 38.0, lon: -97.0 };
    const c2 = this.SCF_CENTROIDS[dPrefix] || { lat: 38.0, lon: -97.0 };

    // If within same major prefix region
    if (oPrefix === dPrefix) {
      const o3 = parseInt(originZip.substring(0, 3), 10) || 0;
      const d3 = parseInt(destZip.substring(0, 3), 10) || 0;
      const diff = Math.abs(o3 - d3);
      return Math.max(85, Math.min(650, diff * 12 + 65));
    }

    // Haversine formula (Earth radius in miles ~ 3958.8)
    const toRad = (deg: number) => (deg * Math.PI) / 180.0;
    const dLat = toRad(c2.lat - c1.lat);
    const dLon = toRad(c2.lon - c1.lon);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(c1.lat)) * Math.cos(toRad(c2.lat)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const directMiles = 3958.8 * c;

    // Apply standard 15% road circuity factor
    const roadMiles = Math.max(120, Math.round(directMiles * 1.15));
    return roadMiles;
  }

  /**
   * Calculate CzarLite Base Rate per CWT (in Cents)
   */
  public static calculateBaseCwtRateCents(distanceMiles: number, nmfcClass: string): number {
    const multiplier = this.CLASS_MULTIPLIERS[nmfcClass] || 1.00;
    const baseRatePerCwtDollars =
      (14.50 + 0.042 * distanceMiles + 0.0000085 * Math.pow(distanceMiles, 2)) * multiplier;
    return Math.round(baseRatePerCwtDollars * 100);
  }

  /**
   * Full CzarLite Tariff Calculation Engine
   */
  public static calculateTariff(
    request: RateRequest,
    discountPercent: number = 0.80,
    amcOverrideCents?: number
  ): CzarLiteTariffResult {
    const distanceMiles = this.estimateHighwayMileage(request.originZip, request.destZip);

    let totalWeightLbs = 0;
    let weightedClassSum = 0;
    let hasOverlength = false;

    for (const item of request.items) {
      const itemWeight = (item.weightLbs || 500) * (item.quantity || 1);
      const clsNum = parseFloat(item.nmfcClass) || 70;
      totalWeightLbs += itemWeight;
      weightedClassSum += itemWeight * clsNum;

      if (item.lengthIn > 96 || item.widthIn > 96 || item.heightIn > 96) {
        hasOverlength = true;
      }
    }

    if (totalWeightLbs <= 0) totalWeightLbs = 500;
    const effectiveClassNum = Math.round(weightedClassSum / totalWeightLbs);
    const effectiveClass = `${effectiveClassNum}`;
    const cwt = totalWeightLbs / 100.0;

    // 1. Base Tariff Calculation
    const baseCwtRateCents = this.calculateBaseCwtRateCents(distanceMiles, effectiveClass);
    const baseTariffCents = Math.round(cwt * baseCwtRateCents);

    // 2. Discount & AMC Floor
    const amcFloorCents =
      amcOverrideCents ||
      (request.accountType === 'PLATFORM_WHOLESALE'
        ? this.WHOLESALE_AMC_CENTS
        : this.DIRECT_AMC_CENTS);

    const rawDiscountedLinehaul = Math.round(baseTariffCents * (1 - discountPercent));
    const isMinimumChargeApplied = rawDiscountedLinehaul < amcFloorCents;
    const discountedLinehaulCents = Math.max(rawDiscountedLinehaul, amcFloorCents);

    // 3. Fuel Surcharge
    const fuelSurchargePercent = this.DEFAULT_FUEL_SURCHARGE_RATE;
    const fuelSurchargeCents = Math.round(discountedLinehaulCents * fuelSurchargePercent);

    // 4. Accessorial Fees
    const accessorialFees: Record<string, number> = {};
    let totalAccessorialCostCents = 0;

    for (const acc of request.accessorials) {
      const rate = this.ACCESSORIAL_TARIFF_RATES[acc] || 7500;
      accessorialFees[acc] = rate;
      totalAccessorialCostCents += rate;
    }

    if (hasOverlength && !accessorialFees['OVERLENGTH']) {
      const rate = this.ACCESSORIAL_TARIFF_RATES['OVERLENGTH'];
      accessorialFees['OVERLENGTH'] = rate;
      totalAccessorialCostCents += rate;
    }

    // 5. Total Carrier Cost
    const totalCarrierCostCents =
      discountedLinehaulCents + fuelSurchargeCents + totalAccessorialCostCents;

    // 6. Transit Days
    const estimatedTransitDays = Math.max(1, Math.ceil(distanceMiles / 450));

    return {
      distanceMiles,
      totalWeightLbs,
      cwt: parseFloat(cwt.toFixed(2)),
      effectiveClass: effectiveClassNum,
      baseTariffCents,
      discountPercent,
      discountedLinehaulCents,
      isMinimumChargeApplied,
      absoluteMinimumChargeCents: amcFloorCents,
      fuelSurchargePercent,
      fuelSurchargeCents,
      accessorialFees,
      totalAccessorialCostCents,
      totalCarrierCostCents,
      estimatedTransitDays,
    };
  }
}
